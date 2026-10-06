import {
  CONNECTION_INSTANCES,
  CONNECTION_SLOT,
  CONNECTION_SLOTS,
  REGION_BY_ID,
  REGION_SLOT,
  REGION_SLOTS,
  regionAnchor,
} from '@/lib/brain/atlas';
import type { ConnectionInstance, ConnectionProfile, Vec3 } from '@/lib/brain/types';
import type {
  ActiveSignal,
  ParamMods,
  Scenario,
  ScenarioEvent,
  ScenarioReadout,
  SimFrame,
  SimParams,
} from './types';
import { DEFAULT_PARAMS } from './types';

/**
 * The simulation engine.
 *
 * `evaluate(scenario, time, params)` is a **pure function of time**. Nothing is
 * integrated frame to frame, which is what makes scrubbing, reversing and
 * jumping to an arbitrary timestamp produce exactly the state the timeline says
 * they should. The render layer writes the result straight into GPU textures
 * without going through React state.
 */

/* ------------------------------------------------------------------ *
 * Pathway resolution (precomputed once)
 * ------------------------------------------------------------------ */

/** `${source}>${target}` → the connection instances drawing that pathway. */
const PATHWAY_INDEX: Map<string, ConnectionInstance[]> = (() => {
  const m = new Map<string, ConnectionInstance[]>();
  for (const ci of CONNECTION_INSTANCES) {
    const { source, target, direction } = ci.connection;
    const push = (k: string) => {
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(ci);
    };
    push(`${source}>${target}`);
    if (direction === 'bidirectional' || direction === 'backward') push(`${target}>${source}`);
  }
  return m;
})();

const CONNECTION_BY_KEY: Map<string, ConnectionInstance> = new Map(
  CONNECTION_INSTANCES.map((ci) => [ci.key, ci]),
);

/** Default traversal time in seconds, by pathway character. */
const PROFILE_TRAVEL: Record<ConnectionProfile, number> = {
  fast: 0.5,
  slow: 1.5,
  burst: 0.34,
  sustained: 0.9,
  modulatory: 1.25,
};

function reverseCurve(c: [Vec3, Vec3, Vec3, Vec3]): [Vec3, Vec3, Vec3, Vec3] {
  return [c[3], c[2], c[1], c[0]];
}

/**
 * Resolve the curves a signal event should travel along. Falls back to a
 * synthesised arc when a scenario names a pathway the atlas does not contain —
 * scenarios are allowed to tell a story the connection graph does not enumerate.
 */
function resolveCurves(ev: ScenarioEvent): {
  curves: Array<[Vec3, Vec3, Vec3, Vec3]>;
  slots: number[];
  travel: number;
} {
  if (!ev.source || !ev.target) return { curves: [], slots: [], travel: 0 };

  let instances: ConnectionInstance[] | undefined;
  if (ev.via) {
    const direct = CONNECTION_BY_KEY.get(ev.via);
    instances = direct
      ? CONNECTION_INSTANCES.filter((ci) => ci.connection.id === direct.connection.id)
      : undefined;
  }
  instances ??= PATHWAY_INDEX.get(`${ev.source}>${ev.target}`);

  if (instances && instances.length > 0) {
    const forwardDeclared = instances[0].connection.source === ev.source;
    const flip = ev.reverse ? forwardDeclared : !forwardDeclared;
    const travel =
      ev.travel ?? PROFILE_TRAVEL[instances[0].connection.profile] ?? 0.6;
    return {
      curves: instances.map((ci) => (flip ? reverseCurve(ci.curve) : ci.curve)),
      slots: instances.map((ci) => ci.slot),
      travel,
    };
  }

  // Synthesised pathway: a gentle arc between the two anchors.
  const a = ev.reverse ? regionAnchor(ev.target) : regionAnchor(ev.source);
  const b = ev.reverse ? regionAnchor(ev.source) : regionAnchor(ev.target);
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const m = Math.hypot(mid[0], mid[1], mid[2]) || 1;
  const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const peak: Vec3 = [
    mid[0] + (mid[0] / m) * d * 0.18,
    mid[1] + (mid[1] / m) * d * 0.18,
    mid[2] + (mid[2] / m) * d * 0.18,
  ];
  const lerp = (p: Vec3, q: Vec3, t: number): Vec3 => [
    p[0] + (q[0] - p[0]) * t,
    p[1] + (q[1] - p[1]) * t,
    p[2] + (q[2] - p[2]) * t,
  ];
  return {
    curves: [[a, lerp(a, peak, 0.6), lerp(b, peak, 0.6), b]],
    slots: [],
    travel: ev.travel ?? 0.7,
  };
}

/** Cached per-event resolution — scenarios are static, so this is safe. */
const curveCache = new WeakMap<ScenarioEvent, ReturnType<typeof resolveCurves>>();
function curvesFor(ev: ScenarioEvent) {
  let v = curveCache.get(ev);
  if (!v) {
    v = resolveCurves(ev);
    curveCache.set(ev, v);
  }
  return v;
}

/* ------------------------------------------------------------------ *
 * Lab-dial modulation
 * ------------------------------------------------------------------ */

/**
 * Apply lab dials to a base value. Each coefficient says how strongly a dial
 * pushes the value; a dial at 0.5 is neutral, so the default lab state always
 * reproduces the scenario exactly as authored.
 */
export function modulate(base: number, mods: ParamMods | undefined, params: SimParams): number {
  if (!mods) return base;
  let v = base;
  for (const k in mods) {
    const coef = mods[k as keyof ParamMods];
    if (coef == null) continue;
    const p = params[k as keyof SimParams] ?? 0.5;
    v += coef * (p - 0.5) * 2 * base;
  }
  return Math.max(0, Math.min(1.35, v));
}

export function readoutValue(r: ScenarioReadout, params: SimParams): number {
  let v = r.base;
  for (const k in r.mods) {
    const coef = r.mods[k as keyof ParamMods];
    if (coef == null) continue;
    const p = params[k as keyof SimParams] ?? 0.5;
    v += coef * (p - 0.5) * 2;
  }
  return Math.max(0, Math.min(1, v));
}

/* ------------------------------------------------------------------ *
 * Envelopes
 * ------------------------------------------------------------------ */

const ATTACK = 0.14;
const DECAY = 1.5;

/**
 * Activation envelope: a fast attack, a flat hold, then an exponential tail.
 * The tail is what makes the brain look like it is still settling rather than
 * switching regions on and off.
 */
function envelope(dt: number, hold: number): number {
  if (dt < 0) return 0;
  if (dt < ATTACK) return dt / ATTACK;
  const after = dt - ATTACK - hold;
  if (after <= 0) return 1;
  return Math.exp(-after / (DECAY * 0.45));
}

function onsetPulse(dt: number): number {
  if (dt < 0 || dt > 0.9) return 0;
  return 1 - dt / 0.9;
}

/* ------------------------------------------------------------------ *
 * Bézier evaluation
 * ------------------------------------------------------------------ */

export function bezier(c: [Vec3, Vec3, Vec3, Vec3], t: number): Vec3 {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const d = 3 * u * t * t;
  const e = t * t * t;
  return [
    a * c[0][0] + b * c[1][0] + d * c[2][0] + e * c[3][0],
    a * c[0][1] + b * c[1][1] + d * c[2][1] + e * c[3][1],
    a * c[0][2] + b * c[1][2] + d * c[2][2] + e * c[3][2],
  ];
}

/** Ease the signal so it leaves and arrives with a sense of mass. */
function travelEase(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/* ------------------------------------------------------------------ *
 * The frame evaluator
 * ------------------------------------------------------------------ */

/** Reusable buffers — evaluate() runs every frame and must not allocate. */
export function createFrame(): SimFrame {
  return {
    time: 0,
    regionLevel: new Float32Array(REGION_SLOTS),
    regionOnset: new Float32Array(REGION_SLOTS),
    connectionLevel: new Float32Array(CONNECTION_SLOTS),
    signals: [],
    currentEvent: null,
    currentStage: null,
    activeEvents: [],
  };
}

function bump(arr: Float32Array, slot: number | undefined, v: number) {
  if (slot == null) return;
  if (v > arr[slot]) arr[slot] = v;
}

export function evaluate(
  scenario: Scenario,
  time: number,
  params: SimParams = DEFAULT_PARAMS,
  out: SimFrame = createFrame(),
): SimFrame {
  out.time = time;
  out.regionLevel.fill(0);
  out.regionOnset.fill(0);
  out.connectionLevel.fill(0);
  out.signals.length = 0;
  out.activeEvents.length = 0;
  out.currentEvent = null;

  const endOfScenario = scenario.duration;

  for (const ev of scenario.events) {
    const dt = time - ev.time;
    if (dt < -0.0001) continue;

    const resolved = curvesFor(ev);
    const travel = resolved.travel;
    const hold = ev.sustain ? Math.max(0, endOfScenario - ev.time) : (ev.hold ?? 1.1);
    const level = modulate(ev.intensity ?? 0.85, ev.mods, params);

    // Activation envelope on every region this event touches.
    const envSrc = envelope(dt, hold);
    // Targets light up as the signal arrives, not when it departs.
    const envDst = envelope(dt - travel * 0.82, hold);

    if (envSrc > 0.001) {
      if (ev.source) {
        bump(out.regionLevel, REGION_SLOT.get(ev.source), envSrc * level);
        bump(out.regionOnset, REGION_SLOT.get(ev.source), onsetPulse(dt) * level);
      }
      for (const r of ev.activate ?? []) {
        bump(out.regionLevel, REGION_SLOT.get(r), envSrc * level);
        bump(out.regionOnset, REGION_SLOT.get(r), onsetPulse(dt) * level);
      }
    }
    if (ev.target && envDst > 0.001) {
      bump(out.regionLevel, REGION_SLOT.get(ev.target), envDst * level);
      bump(out.regionOnset, REGION_SLOT.get(ev.target), onsetPulse(dt - travel * 0.82) * level);
    }

    // Pathway illumination persists a little after the signal passes, so you can
    // still read the route the activity took.
    if (ev.source && ev.target) {
      const pathEnv = envelope(dt, Math.max(hold, travel));
      for (const slot of resolved.slots) {
        bump(out.connectionLevel, slot, pathEnv * level);
      }
      if (ev.via) {
        bump(out.connectionLevel, CONNECTION_SLOT.get(ev.via), pathEnv * level);
      }
    }

    if (envSrc > 0.03 || envDst > 0.03) out.activeEvents.push(ev);
    if (dt >= 0) out.currentEvent = ev;

    // A travelling signal exists only while in flight.
    if (resolved.curves.length > 0 && dt >= 0 && dt <= travel) {
      const raw = travel > 0 ? dt / travel : 1;
      out.signals.push({
        eventId: ev.id,
        curves: resolved.curves,
        progress: travelEase(Math.min(1, raw)),
        intensity: level,
        color: ev.color ?? scenario.accent,
        head: bezier(resolved.curves[0], travelEase(Math.min(1, raw))),
        label: ev.title,
        kind: ev.kind ?? 'forward',
      });
    }
  }

  // Resting activity: the brain is never off. A low floor keeps regions present
  // in the Activity lens rather than vanishing between events.
  const floor = 0.035 + params.sensoryNoise * 0.03;
  for (let i = 0; i < out.regionLevel.length; i++) {
    if (out.regionLevel[i] < floor) out.regionLevel[i] = floor;
  }

  out.currentStage = stageAt(scenario, time);
  return out;
}

export function stageAt(scenario: Scenario, time: number) {
  let found = scenario.stages[0] ?? null;
  for (const s of scenario.stages) {
    if (time >= s.time) found = s;
    else break;
  }
  return found;
}

export function eventAt(scenario: Scenario, time: number): ScenarioEvent | null {
  let found: ScenarioEvent | null = null;
  for (const e of scenario.events) {
    if (time >= e.time) found = e;
    else break;
  }
  return found;
}

/** The next event strictly after `time`, for the skip-forward control. */
export function nextEvent(scenario: Scenario, time: number): ScenarioEvent | null {
  for (const e of scenario.events) if (e.time > time + 0.001) return e;
  return null;
}

export function prevEvent(scenario: Scenario, time: number): ScenarioEvent | null {
  let found: ScenarioEvent | null = null;
  for (const e of scenario.events) {
    if (e.time < time - 0.15) found = e;
    else break;
  }
  return found;
}

/** Events that form the causal backbone, in time order. */
export function causalEvents(scenario: Scenario): ScenarioEvent[] {
  return scenario.events.filter((e) => e.causal);
}

/**
 * Regions a region currently depends on, derived from the scenario rather than
 * the static graph — this is what the Causal Explorer traces backward.
 */
export function upstreamOf(scenario: Scenario, regionId: string, before: number): ScenarioEvent[] {
  return scenario.events.filter(
    (e) => e.target === regionId && e.time <= before + 0.001 && e.source,
  );
}

export function downstreamOf(scenario: Scenario, regionId: string, after: number): ScenarioEvent[] {
  return scenario.events.filter(
    (e) => e.source === regionId && e.time >= after - 0.001 && e.target,
  );
}

/** Validate a scenario against the atlas at load time; returns problems found. */
export function validateScenario(s: Scenario): string[] {
  const errs: string[] = [];
  const check = (id: string | undefined, where: string) => {
    if (id && !REGION_BY_ID.has(id)) errs.push(`${s.id}: unknown region "${id}" in ${where}`);
  };
  for (const e of s.events) {
    check(e.source, `event ${e.id}.source`);
    check(e.target, `event ${e.id}.target`);
    (e.activate ?? []).forEach((r) => check(r, `event ${e.id}.activate`));
    check(e.camera?.region, `event ${e.id}.camera`);
    if (e.time > s.duration) errs.push(`${s.id}: event ${e.id} at ${e.time}s exceeds duration`);
  }
  for (const n of s.causalChain) n.regions.forEach((r) => check(r, `causalChain ${n.id}`));
  return errs;
}

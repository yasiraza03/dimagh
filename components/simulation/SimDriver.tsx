'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CONNECTIONS, CONNECTION_SLOT, REGIONS, REGION_SLOT } from '@/lib/brain/atlas';
import { evaluate } from '@/lib/simulation/engine';
import { clock } from '@/lib/simulation/clock';
import { getScenario, withChoice, choicePoint } from '@/lib/simulation/scenarios';
import { renderState } from '@/lib/visualization/renderState';
import { computeMasks, scenarioRegionSet, updateEmphasis } from '@/lib/visualization/lens';
import { advanceLens, lensState, setLens } from '@/lib/visualization/lensState';
import { rig } from '@/lib/visualization/cameraRig';
import { PALETTE } from '@/lib/visualization/palette';
import { useBrainStore } from '@/store/brainStore';
import { useSimStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import type { ScenarioEvent } from '@/lib/simulation/types';

/**
 * The simulation driver.
 *
 * Exactly one of these lives inside the Canvas, and it is the only place where
 * per-frame work is coordinated:
 *
 *   1. advance the clock
 *   2. evaluate the scenario at the new time (pure function of time)
 *   3. write the result into the shared GPU buffers
 *   4. crossfade lens settings and visibility masks
 *   5. fire camera directives when the current event changes
 *   6. update the camera rig
 *
 * It renders nothing and never calls setState during a frame. Everything the
 * DOM needs is read back from the throttled clock snapshot instead.
 */

/** Regions whose activity we treat as the arousal signal for the atmosphere. */
const AROUSAL_SOURCES = ['amygdala', 'locus_coeruleus', 'insula', 'hypothalamus']
  .map((id) => REGION_SLOT.get(id))
  .filter((v): v is number => v != null);

export function SimDriver() {
  const camera = useThree((s) => s.camera);

  const scenarioId = useSimStore((s) => s.scenarioId);
  const choiceId = useSimStore((s) => s.choiceId);
  const params = useSimStore((s) => s.params);
  const followSignal = useSimStore((s) => s.followSignal);
  const setShowOutcome = useSimStore((s) => s.setShowOutcome);

  const lens = useBrainStore((s) => s.lens);
  const isolated = useBrainStore((s) => s.isolated);
  const matches = useBrainStore((s) => s.matches);
  const selected = useBrainStore((s) => s.selected);
  const hovered = useBrainStore((s) => s.hovered);
  const shellOpacity = useBrainStore((s) => s.shellOpacity);

  const reducedMotion = useUIStore((s) => s.reducedMotion);

  const scenario = useMemo(() => {
    const base = scenarioId ? getScenario(scenarioId) : undefined;
    return base ? withChoice(base, choiceId) : undefined;
  }, [scenarioId, choiceId]);

  const scenarioRegions = useMemo(
    () => (scenario ? scenarioRegionSet(scenario.events) : undefined),
    [scenario],
  );

  // The engine writes straight into the arrays the shaders use as uniforms.
  // Wiring them once avoids a copy and makes the data flow unambiguous.
  useEffect(() => {
    renderState.frame.regionLevel = renderState.regionAct;
    renderState.frame.regionOnset = renderState.regionOnset;
  }, []);

  /* ---- lens ---- */
  useEffect(() => {
    setLens(lens);
  }, [lens]);

  useEffect(() => {
    lensState.shellOverride = shellOpacity >= 0.999 ? null : shellOpacity;
  }, [shellOpacity]);

  /* ---- masks ---- */
  // Deliberately does NOT depend on `hovered`. See updateEmphasis().
  useEffect(() => {
    computeMasks({ lens, isolated, matches, selected, scenarioRegions });
  }, [lens, isolated, matches, selected, scenarioRegions]);

  /* ---- hover / selection highlight ---- */
  useEffect(() => {
    updateEmphasis(selected, hovered);
  }, [selected, hovered]);

  /* ---- scenario load ---- */
  useEffect(() => {
    if (!scenario) return;
    renderState.accent.copy(PALETTE[scenario.accent] ?? PALETTE.cyan);
    const gate = choiceId ? null : choicePoint(scenario);
    clock.load(scenario.duration, gate);
    lastEventRef.current = null;
    outcomeFiredRef.current = false;
    rig.overview(1.6);
  }, [scenario, choiceId]);

  useEffect(() => {
    rig.reducedMotion = reducedMotion;
  }, [reducedMotion]);

  const lastEventRef = useRef<string | null>(null);
  const outcomeFiredRef = useRef(false);

  useFrame((_, deltaRaw) => {
    const dt = Math.min(deltaRaw, 1 / 20);
    renderState.elapsed += dt;

    advanceLens(dt);
    clock.advance(dt);
    renderState.time = clock.time;

    if (scenario) {
      evaluate(scenario, clock.time, params, renderState.frame);
      applyConnectionLevels();
      fireCameraDirective(scenario.events);

      if (clock.completed && !outcomeFiredRef.current) {
        outcomeFiredRef.current = true;
        // setState from a frame is fine here: it happens once per scenario.
        setShowOutcome(true);
      }
    } else {
      idleActivity();
    }

    crossfadeMasks(dt);
    updateArousal();

    if (followSignal && renderState.hasFollowHead) {
      rig.follow(renderState.followHead, 1);
    } else if (!followSignal && rig.isScripted === false) {
      rig.follow(null);
    }

    rig.update(camera as never, dt);
  });

  /* ------------------------------------------------------------------ *
   * Per-frame helpers. Declared inside the component so they close over
   * the refs, but allocation-free.
   * ------------------------------------------------------------------ */

  function applyConnectionLevels() {
    const { connData, connTexture, frame } = renderState;
    const src = frame.connectionLevel;
    for (let i = 0; i < src.length; i++) {
      connData[i * 4] = src[i];
    }
    connTexture.needsUpdate = true;
  }

  function crossfadeMasks(dt: number) {
    const k = 1 - Math.exp(-dt * 5);
    const { regionMask, regionMaskGoal, connData, connMaskGoal, connTexture } = renderState;
    for (let i = 0; i < regionMask.length; i++) {
      regionMask[i] += (regionMaskGoal[i] - regionMask[i]) * k;
    }
    let changed = false;
    for (let i = 0; i < connMaskGoal.length; i++) {
      const cur = connData[i * 4 + 1];
      const next = cur + (connMaskGoal[i] - cur) * k;
      if (Math.abs(next - cur) > 1e-4) changed = true;
      connData[i * 4 + 1] = next;
    }
    if (changed) connTexture.needsUpdate = true;
  }

  function updateArousal() {
    let a = 0;
    for (const slot of AROUSAL_SOURCES) {
      const v = renderState.regionAct[slot];
      if (v > a) a = v;
    }
    const goal = Math.min(1, Math.max(0, (a - 0.12) * 1.25));
    renderState.arousal += (goal - renderState.arousal) * 0.06;
  }

  function fireCameraDirective(events: ScenarioEvent[]) {
    const ev = renderState.frame.currentEvent;
    const id = ev?.id ?? null;
    if (id === lastEventRef.current) return;
    lastEventRef.current = id;

    // Refresh what the labels should name. Only on an event boundary, never
    // per frame.
    const focus = renderState.focusRegions;
    focus.clear();
    if (ev) {
      if (ev.source) focus.add(ev.source);
      if (ev.target) focus.add(ev.target);
      for (const r of ev.activate ?? []) focus.add(r);
    }

    if (!ev?.camera) return;
    // Scrubbing re-fires the directive, which is what you want: landing on an
    // event should always put you where that event wants you.
    if (!useSimStore.getState().followSignal) rig.apply(ev.camera);
  }

  /**
   * With no scenario loaded the brain still has to look alive. A slow, smooth,
   * deterministic wander across regions and pathways — low amplitude, so it
   * never competes with real scenario activity.
   */
  function idleActivity() {
    const t = renderState.elapsed;
    const { regionAct, regionOnset, connData, connTexture } = renderState;
    regionOnset.fill(0);
    // In the closing sequence every region converges on one shared rhythm —
    // the whole brain reading as a single object rather than many parts.
    const fin = renderState.finale;
    const unison = 0.22 + 0.78 * Math.pow(0.5 + 0.5 * Math.sin(t * 1.55), 3);

    for (let i = 0; i < REGIONS.length; i++) {
      const p = i * 1.618;
      const wander =
        0.06 +
        0.055 * (0.5 + 0.5 * Math.sin(t * 0.33 + p)) +
        0.045 * (0.5 + 0.5 * Math.sin(t * 0.17 + p * 2.3)) +
        0.05 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.09 + p * 0.7), 6);
      regionAct[i] = wander + (unison - wander) * fin;
    }
    for (let i = 0; i < CONNECTIONS.length; i++) {
      const p = i * 2.399;
      const wander = 0.04 + 0.16 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.21 + p), 5);
      connData[i * 4] = wander + (unison * 0.85 - wander) * fin;
    }
    connTexture.needsUpdate = true;
    renderState.frame.signals.length = 0;
    renderState.frame.currentEvent = null;
    // Nothing is being explained, so nothing is named except what you point at.
    if (renderState.focusRegions.size > 0) renderState.focusRegions.clear();
  }

  return null;
}

/** Jump the clock to an event and put the camera where that event wants it. */
export function jumpToEvent(scenarioId: string, eventId: string) {
  const s = getScenario(scenarioId);
  if (!s) return;
  const ev =
    s.events.find((e) => e.id === eventId) ??
    s.choices?.options.flatMap((o) => o.events).find((e) => e.id === eventId);
  if (!ev) return;
  clock.seek(ev.time);
  if (ev.camera) rig.apply(ev.camera);
  else if (ev.target) rig.focusRegion(ev.target);
  else if (ev.source) rig.focusRegion(ev.source);
}

/** Jump to a named stage. */
export function jumpToStage(scenarioId: string, stageId: string) {
  const s = getScenario(scenarioId);
  const stage = s?.stages.find((x) => x.id === stageId);
  if (stage) clock.seek(stage.time);
}

export { CONNECTION_SLOT };

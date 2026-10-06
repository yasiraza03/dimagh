import regionsData from '@/data/brain/regions.json';
import connectionsData from '@/data/brain/connections.json';
import type {
  BrainConnection,
  BrainRegion,
  ConnectionInstance,
  RegionInstance,
  Vec3,
} from './types';

/**
 * The atlas: a single, module-level, immutable resolution of the brain data.
 *
 * This is computed once when the module is first imported — never per render and
 * never per frame. Curves, mirrored instances and data-texture slot indices are
 * all derived here so that render code only ever reads flat arrays.
 */

export const REGIONS: BrainRegion[] = (regionsData.regions as BrainRegion[]).slice();
export const CONNECTIONS: BrainConnection[] = (
  connectionsData.connections as BrainConnection[]
).slice();

/** Data-texture widths. Powers of two, comfortably above the real counts. */
export const REGION_SLOTS = 64;
export const CONNECTION_SLOTS = 128;

if (REGIONS.length > REGION_SLOTS) {
  throw new Error(`dimagh: ${REGIONS.length} regions exceeds REGION_SLOTS=${REGION_SLOTS}`);
}
if (CONNECTIONS.length > CONNECTION_SLOTS) {
  throw new Error(
    `dimagh: ${CONNECTIONS.length} connections exceeds CONNECTION_SLOTS=${CONNECTION_SLOTS}`,
  );
}

export const REGION_BY_ID: ReadonlyMap<string, BrainRegion> = new Map(
  REGIONS.map((r) => [r.id, r]),
);
export const CONNECTION_BY_ID: ReadonlyMap<string, BrainConnection> = new Map(
  CONNECTIONS.map((c) => [c.id, c]),
);

/** Stable slot index per region id — the x coordinate in the activity texture. */
export const REGION_SLOT: ReadonlyMap<string, number> = new Map(
  REGIONS.map((r, i) => [r.id, i]),
);
export const CONNECTION_SLOT: ReadonlyMap<string, number> = new Map(
  CONNECTIONS.map((c, i) => [c.id, i]),
);

export function region(id: string): BrainRegion | undefined {
  return REGION_BY_ID.get(id);
}

export function regionName(id: string): string {
  return REGION_BY_ID.get(id)?.name ?? id;
}

export function regionAbbr(id: string): string {
  return REGION_BY_ID.get(id)?.abbr ?? id.toUpperCase().slice(0, 4);
}

/* ------------------------------------------------------------------ *
 * Region instances (bilateral mirroring)
 * ------------------------------------------------------------------ */

function mirrorX(p: Vec3): Vec3 {
  return [-p[0], p[1], p[2]];
}

export const REGION_INSTANCES: RegionInstance[] = REGIONS.flatMap((r): RegionInstance[] => {
  const slot = REGION_SLOT.get(r.id)!;
  if (r.lateralized === 'bilateral') {
    return [
      { region: r, key: `${r.id}:R`, side: 'right' as const, position: r.position, slot },
      { region: r, key: `${r.id}:L`, side: 'left' as const, position: mirrorX(r.position), slot },
    ];
  }
  return [{ region: r, key: r.id, side: 'mid' as const, position: r.position, slot }];
});

/**
 * The position used when something needs *one* location for a region: camera
 * targets, connection endpoints, label anchors.
 */
export function regionAnchor(id: string): Vec3 {
  return REGION_BY_ID.get(id)?.position ?? [0, 0, 0];
}

/* ------------------------------------------------------------------ *
 * Connection geometry
 * ------------------------------------------------------------------ */

/** Deterministic pseudo-random in [0,1) from a string — keeps curves stable. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function len(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Build a cubic Bézier that bows away from the brain's centre so that long-range
 * pathways arc over the surface instead of cutting straight through the middle.
 * Deep (subcortical) endpoints bow much less, which keeps them reading as
 * internal rather than as surface tracts.
 */
function buildCurve(
  a: Vec3,
  b: Vec3,
  key: string,
  bowScale: number,
): [Vec3, Vec3, Vec3, Vec3] {
  const d = len(a, b);
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const m = Math.hypot(mid[0], mid[1], mid[2]) || 1;
  const outward: Vec3 = [mid[0] / m, mid[1] / m, mid[2] / m];

  // A deterministic lateral jitter so parallel pathways between neighbouring
  // regions stay visually separable instead of z-fighting into one line.
  const j = (hash01(key) - 0.5) * 0.12 * d;
  const bow = d * 0.3 * bowScale;

  const peak: Vec3 = [
    mid[0] + outward[0] * bow + j,
    mid[1] + outward[1] * bow,
    mid[2] + outward[2] * bow - j * 0.6,
  ];

  const p1: Vec3 = [
    a[0] + (peak[0] - a[0]) * 0.62,
    a[1] + (peak[1] - a[1]) * 0.62,
    a[2] + (peak[2] - a[2]) * 0.62,
  ];
  const p2: Vec3 = [
    b[0] + (peak[0] - b[0]) * 0.62,
    b[1] + (peak[1] - b[1]) * 0.62,
    b[2] + (peak[2] - b[2]) * 0.62,
  ];
  return [a, p1, p2, b];
}

function bowScaleFor(src: BrainRegion, dst: BrainRegion): number {
  const deep = (r: BrainRegion) => r.depth === 'subcortical' || r.depth === 'peripheral';
  if (deep(src) && deep(dst)) return 0.18;
  if (deep(src) || deep(dst)) return 0.45;
  return 1;
}

export const CONNECTION_INSTANCES: ConnectionInstance[] = CONNECTIONS.flatMap((c) => {
  const src = REGION_BY_ID.get(c.source);
  const dst = REGION_BY_ID.get(c.target);
  if (!src || !dst) return [];
  const slot = CONNECTION_SLOT.get(c.id)!;
  const bow = bowScaleFor(src, dst);

  const primary: ConnectionInstance = {
    connection: c,
    key: c.id,
    curve: buildCurve(src.position, dst.position, c.id, bow),
    length: len(src.position, dst.position),
    slot,
  };

  // Mirror pathways whose endpoints both exist on both sides, so the network
  // reads as a whole brain rather than one hemisphere. The twin shares the
  // parent's activation slot — it is the same conceptual pathway.
  const mirrorable = (r: BrainRegion) =>
    r.lateralized === 'bilateral' || r.lateralized === 'midline';
  if (mirrorable(src) && mirrorable(dst) && !(src.lateralized === 'midline' && dst.lateralized === 'midline')) {
    const mirrored: ConnectionInstance = {
      connection: c,
      key: `${c.id}:L`,
      curve: buildCurve(mirrorX(src.position), mirrorX(dst.position), `${c.id}:L`, bow),
      length: primary.length,
      slot,
    };
    return [primary, mirrored];
  }
  return [primary];
});

/** Outgoing / incoming adjacency, for the causal explorer and network search. */
export const OUTGOING: ReadonlyMap<string, BrainConnection[]> = (() => {
  const m = new Map<string, BrainConnection[]>();
  for (const c of CONNECTIONS) {
    if (c.direction === 'backward') continue;
    if (!m.has(c.source)) m.set(c.source, []);
    m.get(c.source)!.push(c);
    if (c.direction === 'bidirectional') {
      if (!m.has(c.target)) m.set(c.target, []);
      m.get(c.target)!.push(c);
    }
  }
  return m;
})();

export const INCOMING: ReadonlyMap<string, BrainConnection[]> = (() => {
  const m = new Map<string, BrainConnection[]>();
  for (const c of CONNECTIONS) {
    const add = (k: string) => {
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    };
    if (c.direction === 'backward') add(c.source);
    else add(c.target);
    if (c.direction === 'bidirectional') add(c.source);
  }
  return m;
})();

/** Every connection touching a region, regardless of direction. */
export function connectionsFor(regionId: string): BrainConnection[] {
  return CONNECTIONS.filter((c) => c.source === regionId || c.target === regionId);
}

/** All distinct functional systems named across the atlas. */
export const ALL_SYSTEMS: string[] = Array.from(
  new Set(REGIONS.flatMap((r) => r.systems)),
).sort();

/** Regions grouped by category, in a stable display order. */
export const CATEGORY_ORDER: string[] = [
  'sensory',
  'visual',
  'auditory',
  'attention',
  'executive',
  'language',
  'memory',
  'emotion',
  'motor',
  'subcortical',
  'arousal',
  'effector',
];

export function regionsByCategory(): Array<{ category: string; regions: BrainRegion[] }> {
  return CATEGORY_ORDER.map((category) => ({
    category,
    regions: REGIONS.filter((r) => r.category === category),
  })).filter((g) => g.regions.length > 0);
}

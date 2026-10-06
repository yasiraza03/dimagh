'use client';

import { CONNECTIONS, CONNECTION_SLOT, REGIONS, REGION_SLOT } from '@/lib/brain/atlas';
import { LENS_SYSTEMS } from '@/store/brainStore';
import type { LensMode } from '@/lib/simulation/types';
import { renderState } from './renderState';

/**
 * Lens render configuration.
 *
 * Switching lens does far more than recolour the brain: shell opacity, how much
 * of the activity field shows through, pathway visibility, particle density,
 * camera idle behaviour and label policy all change. That is the difference
 * between a filter and a different way of looking at the same object.
 */
export interface LensRender {
  /** Cortical shell alpha. */
  shellOpacity: number;
  /** How strongly the activity field reads on the surface. */
  activityGain: number;
  /** Inner volume brightness. */
  coreGain: number;
  /** Resting alpha of the pathway network. */
  connectionBase: number;
  /** Travelling-pulse amplitude on pathways. */
  connectionPulse: number;
  /** Ambient dust opacity. */
  dustOpacity: number;
  /** Region marker opacity. */
  markerOpacity: number;
  /** Per-lobe anatomical tint. */
  anatomyTint: number;
  /** Equal-fold contour lines. */
  contours: number;
  /** Idle camera drift, radians/sec. */
  autoOrbit: number;
  /** Only draw descending (feedback) pathways. */
  feedbackOnly: boolean;
  /** Show 3D labels by default in this lens. */
  labels: boolean;
}

export const LENS_RENDER: Record<LensMode, LensRender> = {
  anatomy: {
    shellOpacity: 1,
    activityGain: 0.1,
    coreGain: 0.12,
    connectionBase: 0.0,
    connectionPulse: 0,
    dustOpacity: 0.1,
    markerOpacity: 0.3,
    anatomyTint: 1,
    contours: 1,
    autoOrbit: 0.03,
    feedbackOnly: false,
    labels: true,
  },
  activity: {
    shellOpacity: 0.78,
    activityGain: 1.0,
    coreGain: 0.85,
    connectionBase: 0.07,
    connectionPulse: 1,
    dustOpacity: 0.35,
    markerOpacity: 0.9,
    anatomyTint: 0.15,
    contours: 0.3,
    autoOrbit: 0.035,
    feedbackOnly: false,
    labels: true,
  },
  network: {
    shellOpacity: 0.1,
    activityGain: 0.55,
    coreGain: 0.35,
    connectionBase: 0.3,
    connectionPulse: 1.2,
    dustOpacity: 0.6,
    markerOpacity: 1,
    anatomyTint: 0,
    contours: 0,
    autoOrbit: 0.06,
    feedbackOnly: false,
    labels: false,
  },
  attention: {
    shellOpacity: 0.42,
    activityGain: 1.15,
    coreGain: 0.7,
    connectionBase: 0.14,
    connectionPulse: 1.4,
    dustOpacity: 0.28,
    markerOpacity: 1,
    anatomyTint: 0.05,
    contours: 0.15,
    autoOrbit: 0.025,
    feedbackOnly: false,
    labels: true,
  },
  memory: {
    shellOpacity: 0.5,
    activityGain: 1.0,
    coreGain: 1.0,
    connectionBase: 0.16,
    connectionPulse: 0.8,
    dustOpacity: 0.45,
    markerOpacity: 1,
    anatomyTint: 0.05,
    contours: 0.1,
    autoOrbit: 0.03,
    feedbackOnly: false,
    labels: true,
  },
  emotion: {
    shellOpacity: 0.46,
    activityGain: 1.3,
    coreGain: 1.15,
    connectionBase: 0.15,
    connectionPulse: 1.7,
    dustOpacity: 0.5,
    markerOpacity: 1,
    anatomyTint: 0,
    contours: 0,
    autoOrbit: 0.05,
    feedbackOnly: false,
    labels: true,
  },
  prediction: {
    shellOpacity: 0.34,
    activityGain: 1.05,
    coreGain: 0.8,
    connectionBase: 0.22,
    connectionPulse: 1.5,
    dustOpacity: 0.3,
    markerOpacity: 0.95,
    anatomyTint: 0,
    contours: 0,
    autoOrbit: 0.028,
    feedbackOnly: true,
    labels: true,
  },
};

const DIM = 0.14;

/**
 * Recompute the visibility masks. Called when the lens, an isolated system, a
 * search query or the selection changes — never per frame. The driver then
 * crossfades the live mask toward these goals.
 */
export function computeMasks(opts: {
  lens: LensMode;
  isolated: string | null;
  matches: string[];
  selected: string | null;
  /** Regions named by the active scenario; these stay lit in every lens. */
  scenarioRegions?: Set<string>;
}) {
  const { lens, isolated, matches, selected, scenarioRegions } = opts;
  const lensSystems = LENS_SYSTEMS[lens];
  const matchSet = matches.length > 0 ? new Set(matches) : null;

  const regionGoal = renderState.regionMaskGoal;
  regionGoal.fill(0);

  const visible = new Set<string>();

  for (const r of REGIONS) {
    const slot = REGION_SLOT.get(r.id)!;
    let v = 1;

    // Nodes outside the brain — the retina, the optic pathway, the musculature
    // — sit well beyond the cerebral envelope, so their pathways read as
    // antennae sticking out of the silhouette. They are hidden unless the
    // active scenario actually routes through them (or you ask for them).
    const external = r.depth === 'peripheral' || r.depth === 'effector';
    if (external) v = 0;

    if (lensSystems) {
      const inLens = r.systems.some((s) => lensSystems.includes(s));
      // Min, not assignment: a lens must be able to dim a region further but
      // never to un-hide an external node that was zeroed above.
      if (!inLens) v = Math.min(v, DIM);
    }
    if (isolated) {
      v = r.systems.includes(isolated) ? 1 : Math.min(v, DIM * 0.7);
    }
    if (matchSet) {
      v = matchSet.has(r.id) ? 1 : Math.min(v, DIM * 0.7);
    }
    // A scenario always wins: if the story names a region, it stays readable.
    if (scenarioRegions?.has(r.id)) v = Math.max(v, 0.85);
    if (selected === r.id) v = 1;
    if (matchSet?.has(r.id)) v = 1;

    regionGoal[slot] = v;
    if (v > 0.6) visible.add(r.id);
  }

  // A pathway is only as visible as its dimmer endpoint, so dimming a region
  // automatically dims everything that depends on it.
  const connGoal = renderState.connMaskGoal;
  connGoal.fill(0);
  for (const c of CONNECTIONS) {
    const slot = CONNECTION_SLOT.get(c.id)!;
    const a = regionGoal[REGION_SLOT.get(c.source)!] ?? DIM;
    const b = regionGoal[REGION_SLOT.get(c.target)!] ?? DIM;
    let v = Math.min(a, b);
    if (LENS_RENDER[lens].feedbackOnly && c.direction === 'forward') {
      v *= 0.12;
    }
    // Emphasise pathways attached to the selected region.
    if (selected && (c.source === selected || c.target === selected)) v = 1;
    connGoal[slot] = v;
  }

  return visible;
}

/**
 * Hover and selection highlight, kept deliberately separate from the masks.
 *
 * Emphasis changes on every pointer move across the brain. Folding it into
 * computeMasks meant each of those moves rewrote the visibility of all 35
 * regions and 79 pathways, which the driver then crossfaded — so the whole
 * brain pulsed as the cursor travelled. Emphasis writes one float per region
 * and triggers no crossfade at all.
 */
export function updateEmphasis(selected: string | null, hovered: string | null) {
  const emphasis = renderState.regionEmphasis;
  emphasis.fill(0);
  if (selected) {
    const slot = REGION_SLOT.get(selected);
    if (slot != null) emphasis[slot] = 1;
  }
  if (hovered && hovered !== selected) {
    const slot = REGION_SLOT.get(hovered);
    if (slot != null) emphasis[slot] = 0.6;
  }
}

/** Regions a scenario touches, for the mask override above. */
export function scenarioRegionSet(events: Array<{ source?: string; target?: string; activate?: string[] }>) {
  const s = new Set<string>();
  for (const e of events) {
    if (e.source) s.add(e.source);
    if (e.target) s.add(e.target);
    for (const r of e.activate ?? []) s.add(r);
  }
  return s;
}

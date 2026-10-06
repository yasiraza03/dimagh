'use client';

import { LENS_RENDER, type LensRender } from './lens';
import type { LensMode } from '@/lib/simulation/types';

/**
 * Live, smoothed lens settings.
 *
 * Changing lens is a visual transition, not a switch: every numeric setting
 * crossfades toward the new lens's value. Keeping the interpolated values in one
 * module object means each GPU layer reads a single number per frame instead of
 * subscribing to store changes and re-rendering.
 */

type NumericKeys = {
  [K in keyof LensRender]: LensRender[K] extends number ? K : never;
}[keyof LensRender];

const NUMERIC: NumericKeys[] = [
  'shellOpacity',
  'activityGain',
  'coreGain',
  'connectionBase',
  'connectionPulse',
  'dustOpacity',
  'markerOpacity',
  'anatomyTint',
  'contours',
  'autoOrbit',
];

export const lensState = {
  cur: { ...LENS_RENDER.anatomy } as LensRender,
  goal: { ...LENS_RENDER.anatomy } as LensRender,
  /** Manual shell-opacity override from the transparency slider, or null. */
  shellOverride: null as number | null,
};

export function setLens(mode: LensMode) {
  lensState.goal = { ...LENS_RENDER[mode] };
  // Booleans switch immediately; only the numbers crossfade.
  lensState.cur.feedbackOnly = lensState.goal.feedbackOnly;
  lensState.cur.labels = lensState.goal.labels;
}

/** Frame-rate-independent crossfade toward the active lens. */
export function advanceLens(dt: number, instant = false) {
  const k = instant ? 1 : 1 - Math.exp(-dt * 4.5);
  for (const key of NUMERIC) {
    const c = lensState.cur[key] as number;
    const g = lensState.goal[key] as number;
    (lensState.cur[key] as number) = c + (g - c) * k;
  }
}

/** Shell opacity actually used, accounting for the manual override. */
export function effectiveShellOpacity(): number {
  return lensState.shellOverride != null
    ? lensState.shellOverride
    : lensState.cur.shellOpacity;
}

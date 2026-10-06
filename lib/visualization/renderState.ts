'use client';

import { Color, Vector3 } from 'three';
import { REGIONS, REGION_SLOTS, CONNECTIONS, CONNECTION_SLOTS } from '@/lib/brain/atlas';
import { createFrame } from '@/lib/simulation/engine';
import type { SimFrame } from '@/lib/simulation/types';
import { PALETTE_HEX } from './palette';
import { createConnectionTexture } from './connectionGeometry';

/**
 * The render state bridge.
 *
 * One component (SimDriver) evaluates the simulation each frame and writes the
 * result here; every GPU layer reads the *same* typed arrays as its uniform
 * values. Because three re-uploads uniform values on each draw, mutating these
 * buffers in place is all that is needed — no React state, no per-frame
 * allocation, and no copying between layers.
 */

function regionUniformArrays() {
  // xyz = position, w = radius
  const geom = new Float32Array(REGION_SLOTS * 4);
  // rgb = colour, a = bilateral flag
  const col = new Float32Array(REGION_SLOTS * 4);
  const tmp = new Color();
  for (let i = 0; i < REGIONS.length; i++) {
    const r = REGIONS[i];
    geom[i * 4] = r.position[0];
    geom[i * 4 + 1] = r.position[1];
    geom[i * 4 + 2] = r.position[2];
    geom[i * 4 + 3] = r.radius;
    tmp.set(PALETTE_HEX[r.color] ?? PALETTE_HEX.cyan);
    col[i * 4] = tmp.r;
    col[i * 4 + 1] = tmp.g;
    col[i * 4 + 2] = tmp.b;
    col[i * 4 + 3] = r.lateralized === 'bilateral' ? 1 : 0;
  }
  return { geom, col };
}

const { geom, col } = regionUniformArrays();
const conn = createConnectionTexture();

export interface RenderState {
  /** Freshly evaluated simulation frame. Reused; never reallocated. */
  frame: SimFrame;
  /** Scenario time, mirrored here so layers need not touch the clock. */
  time: number;
  /** Monotonic wall-clock seconds, for ambient animation. */
  elapsed: number;

  /* ---- region uniforms ---- */
  regionGeom: Float32Array;
  regionCol: Float32Array;
  regionAct: Float32Array;
  regionOnset: Float32Array;
  /** Current visibility mask, chasing maskGoal so lens changes crossfade. */
  regionMask: Float32Array;
  regionMaskGoal: Float32Array;

  /* ---- connection state texture ---- */
  connTexture: typeof conn.texture;
  connData: Float32Array;
  connMaskGoal: Float32Array;

  /** Per-region hover/selection emphasis, 0–1. */
  regionEmphasis: Float32Array;

  /** Scene-wide accent, driven by the active scenario. */
  accent: Color;
  /** 0–1 arousal, raises warmth and tempo in the Emotion lens. */
  arousal: number;
  /** Head of the signal the camera is following, if any. */
  followHead: Vector3;
  hasFollowHead: boolean;
  /**
   * 0–1 blend into the closing "living mind" state, where every region pulses
   * in unison instead of wandering independently. Driven by scroll position.
   */
  finale: number;
  /**
   * The regions the current step is actually about.
   *
   * This is what gets labelled. Labelling by activity level instead meant nine
   * names on screen at all times — most of them left over from earlier steps,
   * all of them re-ranking several times a second. Naming only what the step is
   * about is both calmer and far more useful.
   */
  focusRegions: Set<string>;
}

export const renderState: RenderState = {
  frame: createFrame(),
  time: 0,
  elapsed: 0,

  regionGeom: geom,
  regionCol: col,
  regionAct: new Float32Array(REGION_SLOTS),
  regionOnset: new Float32Array(REGION_SLOTS),
  regionMask: new Float32Array(REGION_SLOTS).fill(1),
  regionMaskGoal: new Float32Array(REGION_SLOTS).fill(1),

  connTexture: conn.texture,
  connData: conn.data,
  connMaskGoal: new Float32Array(CONNECTION_SLOTS).fill(1),

  regionEmphasis: new Float32Array(REGION_SLOTS),

  accent: new Color(PALETTE_HEX.cyan),
  arousal: 0,
  followHead: new Vector3(),
  hasFollowHead: false,
  finale: 0,
  focusRegions: new Set<string>(),
};

/**
 * Reset the animated state to a quiet baseline (used when entering or leaving a
 * scenario).
 *
 * It deliberately does **not** touch `regionMaskGoal` or `connMaskGoal`. Those
 * are owned by computeMasks(), and a page's reset effect and the driver's mask
 * effect run in an order React does not guarantee — when the reset landed last
 * it restored every mask to 1, which is why pathways to the eye and the
 * musculature kept reappearing as spikes outside the silhouette.
 */
export function resetRenderState() {
  renderState.regionAct.fill(0.04);
  renderState.regionOnset.fill(0);
  renderState.regionEmphasis.fill(0);
  renderState.arousal = 0;
  renderState.hasFollowHead = false;
  renderState.finale = 0;
  renderState.focusRegions.clear();
  for (let i = 0; i < CONNECTION_SLOTS; i++) {
    renderState.connData[i * 4] = 0;
  }
  renderState.connTexture.needsUpdate = true;
}

/** Number of regions compiled into the shaders' loop bound. */
export const REGION_COUNT = REGIONS.length;
export const CONNECTION_COUNT = CONNECTIONS.length;

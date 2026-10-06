import { Color } from 'three';
import type { PaletteKey } from '@/lib/brain/types';

/**
 * The WebGL-side mirror of the Tailwind palette. Keeping one source of truth for
 * both the DOM and the GPU is why a region's inspector chip and its glow in the
 * scene are always the same colour.
 */
export const PALETTE_HEX: Record<PaletteKey, string> = {
  // Monochrome by design. The palette keys still carry meaning — they are used
  // everywhere from region chips to pathway tubes — but they are separated by
  // luminance and a trace of temperature rather than by hue. On a near-black
  // substrate a greyscale ramp reads cleaner than seven competing colours, and
  // it keeps the brain itself the only thing on screen with any presence.
  cyan: '#e9eef2',   // sensory / visual — coolest, brightest
  threat: '#ffffff', // salience / emotion — pure white, the loudest signal
  amber: '#ded6c9',  // auditory / arousal — warm light
  bone: '#f2ede4',   // neutral
  green: '#c9d1cc',  // language
  violet: '#b7b4bd', // memory
  orange: '#cdc5be', // motor / executive — warm mid
  blue: '#99a0a8',   // attention — coolest mid, recedes
};

/** Pre-built THREE.Color instances. Never mutate these; use `.clone()`. */
export const PALETTE: Record<PaletteKey, Color> = Object.fromEntries(
  Object.entries(PALETTE_HEX).map(([k, v]) => [k, new Color(v)]),
) as Record<PaletteKey, Color>;

export function paletteColor(key: PaletteKey | undefined, fallback: PaletteKey = 'cyan'): Color {
  return (PALETTE[key ?? fallback] ?? PALETTE[fallback]).clone();
}

export function paletteHex(key: PaletteKey | undefined, fallback: PaletteKey = 'cyan'): string {
  return PALETTE_HEX[key ?? fallback] ?? PALETTE_HEX[fallback];
}

/** Tailwind text-colour class per palette key, for DOM chips and labels. */
export const PALETTE_TEXT_CLASS: Record<PaletteKey, string> = {
  cyan: 'text-signal-cyan',
  orange: 'text-signal-orange',
  violet: 'text-signal-violet',
  threat: 'text-signal-threat',
  blue: 'text-signal-blue',
  amber: 'text-signal-amber',
  green: 'text-signal-green',
  bone: 'text-bone',
};

/**
 * Category → palette mapping, used when a visual needs to colour by functional
 * family rather than by the region's own accent.
 */
export const CATEGORY_COLOR: Record<string, PaletteKey> = {
  sensory: 'cyan',
  visual: 'cyan',
  auditory: 'amber',
  motor: 'orange',
  memory: 'violet',
  emotion: 'threat',
  attention: 'blue',
  executive: 'orange',
  language: 'green',
  subcortical: 'blue',
  arousal: 'amber',
  effector: 'orange',
};

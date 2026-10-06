'use client';

/**
 * 3D label bridge.
 *
 * Labels are DOM, not canvas — the brief is explicit that educational content
 * must not be locked inside WebGL, and real text is also selectable,
 * screen-readable and crisp at any zoom.
 *
 * A projector inside the Canvas writes screen coordinates here each frame; an
 * overlay outside the Canvas reads them in its own rAF loop and moves a fixed
 * pool of divs imperatively. Neither side ever triggers a React re-render.
 */

/**
 * A step names at most a few regions, plus whatever you are pointing at. Nine
 * slots was never a cap — it was room for clutter.
 */
export const MAX_LABELS = 6;

export interface LabelSlot {
  regionId: string | null;
  abbr: string;
  name: string;
  /** Screen position in CSS pixels, relative to the canvas container. */
  x: number;
  y: number;
  /** 0 when the label should be hidden. */
  opacity: number;
  /** Activation level, used for the small level bar. */
  level: number;
  /** True when this is the selected or hovered region. */
  emphasised: boolean;
  /** Behind the brain — drawn dimmer so depth still reads. */
  behind: boolean;
  color: string;
}

function emptySlot(): LabelSlot {
  return {
    regionId: null,
    abbr: '',
    name: '',
    x: 0,
    y: 0,
    opacity: 0,
    level: 0,
    emphasised: false,
    behind: false,
    color: '#4fd8e8',
  };
}

export const labelSlots: LabelSlot[] = Array.from({ length: MAX_LABELS }, emptySlot);

/** Set by the projector; the overlay hides itself entirely when false. */
export const labelConfig = { enabled: true, version: 0 };

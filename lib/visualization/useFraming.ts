'use client';

import { useEffect } from 'react';
import { rig } from './cameraRig';

/**
 * Tell the camera how much of the canvas a page's panels are covering.
 *
 * Panels are drawn over a full-bleed canvas, so a brain framed in the centre of
 * the *canvas* is not framed in the centre of what you can actually see. Each
 * page declares the width it has covered on the left and right and the height
 * covered top and bottom, in CSS pixels; this converts that into the world-space
 * shift the rig needs and keeps it current as the window resizes or a panel
 * opens and closes.
 *
 * The conversion is approximate on purpose — it only has to put the brain in
 * roughly the right place, and an exact projection would have to track the
 * camera distance every frame for no visible benefit.
 */
export function useFraming(cover: {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  /** Disable while a full-screen overlay is up. */
  enabled?: boolean;
}) {
  const { left = 0, right = 0, top = 0, bottom = 0, enabled = true } = cover;

  useEffect(() => {
    if (!enabled) {
      rig.setFraming(0, 0);
      return;
    }

    const apply = () => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;

      // Below the large breakpoint the panels stack beneath the canvas rather
      // than covering it, so no offset is wanted.
      if (w < 1024) {
        rig.setFraming(0, 0);
        return;
      }

      // Net uncovered centre, as a fraction of the viewport, times a world-unit
      // span that roughly matches the brain's framed size.
      const SPAN = 2.4;
      const dx = ((right - left) / w) * SPAN * 0.5;
      const dy = ((top - bottom) / h) * SPAN * 0.5;
      rig.setFraming(dx, -dy);
    };

    apply();
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      rig.setFraming(0, 0);
    };
  }, [left, right, top, bottom, enabled]);
}

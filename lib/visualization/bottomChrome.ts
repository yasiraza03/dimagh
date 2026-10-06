'use client';

import { useEffect } from 'react';

/**
 * Bottom-chrome reservation.
 *
 * The disclaimer badge and the settings rail are `fixed` to the viewport, which
 * means they would sit on top of a page's own bottom bar — the scenario
 * player's transport, for instance. CSS custom properties do not inherit into
 * elements outside the subtree that sets them, so the reservation is published
 * on the document element and the two global badges offset themselves from it.
 *
 * Pages that own the bottom of the screen call this with their bar's height.
 */
const VAR = '--chrome-bottom';

export function useBottomChrome(px: number) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(VAR, `${Math.max(0, Math.round(px))}px`);
    return () => {
      root.style.removeProperty(VAR);
    };
  }, [px]);
}

/** Inline style for a viewport-fixed element that must clear the bottom bar. */
export const CLEARS_BOTTOM_CHROME: React.CSSProperties = {
  bottom: `calc(1rem + var(${VAR}, 0px))`,
};

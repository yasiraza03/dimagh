'use client';

import { useEffect, useRef } from 'react';

/**
 * Document scroll progress, as a hairline under the navigation.
 *
 * Driven imperatively from a rAF loop reading scrollY — a scroll listener into
 * React state would re-render the whole header on every wheel tick, which is
 * exactly the kind of thing that makes a scroll-heavy page feel heavy.
 */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let last = -1;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = barRef.current;
      if (!el) return;
      const max =
        (document.documentElement.scrollHeight || 0) - window.innerHeight;
      const p = max > 4 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      const rounded = Math.round(p * 1000);
      if (rounded === last) return;
      last = rounded;
      el.style.transform = `scaleX(${p})`;
      el.style.opacity = max > 4 ? '1' : '0';
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden"
      aria-hidden
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-gradient-to-r from-signal-cyan via-signal-violet to-signal-orange opacity-0 transition-opacity duration-300"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}

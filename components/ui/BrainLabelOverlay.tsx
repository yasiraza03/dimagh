'use client';

import { useEffect, useRef } from 'react';
import { labelConfig, labelSlots, MAX_LABELS } from '@/lib/visualization/labelState';
import { useBrainStore } from '@/store/brainStore';
import { rig } from '@/lib/visualization/cameraRig';

/**
 * DOM label overlay.
 *
 * A fixed pool of nine label elements, moved imperatively from the projected
 * coordinates the Canvas writes each frame. No React re-renders are involved in
 * the motion, and because the labels are real DOM they stay crisp, selectable
 * and reachable by assistive technology — which canvas text would not be.
 */
export function BrainLabelOverlay() {
  const hostRef = useRef<HTMLDivElement>(null);
  const nodes = useRef<Array<HTMLButtonElement | null>>([]);
  const lastVersion = useRef(-1);
  const select = useBrainStore((s) => s.select);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (labelConfig.version === lastVersion.current) return;
      lastVersion.current = labelConfig.version;

      for (let i = 0; i < MAX_LABELS; i++) {
        const el = nodes.current[i];
        const slot = labelSlots[i];
        if (!el) continue;
        if (!labelConfig.enabled || slot.opacity <= 0.01 || !slot.regionId) {
          if (el.style.visibility !== 'hidden') {
            el.style.visibility = 'hidden';
            el.setAttribute('aria-hidden', 'true');
            el.tabIndex = -1;
          }
          continue;
        }
        el.style.visibility = 'visible';
        el.removeAttribute('aria-hidden');
        el.tabIndex = 0;
        el.style.transform = `translate3d(${slot.x.toFixed(1)}px, ${slot.y.toFixed(1)}px, 0)`;
        el.style.opacity = slot.opacity.toFixed(2);
        el.dataset.region = slot.regionId;
        el.dataset.emphasised = slot.emphasised ? 'true' : 'false';

        const abbr = el.querySelector<HTMLElement>('[data-abbr]');
        const name = el.querySelector<HTMLElement>('[data-name]');
        const bar = el.querySelector<HTMLElement>('[data-bar]');
        if (abbr && abbr.textContent !== slot.abbr) abbr.textContent = slot.abbr;
        if (name && name.textContent !== slot.name) name.textContent = slot.name;
        if (abbr) abbr.style.color = slot.color;
        if (bar) {
          bar.style.width = `${Math.round(Math.min(1, slot.level) * 100)}%`;
          bar.style.background = slot.color;
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-label="Region labels"
    >
      {Array.from({ length: MAX_LABELS }).map((_, i) => (
        <button
          key={i}
          ref={(el) => {
            nodes.current[i] = el;
          }}
          type="button"
          className="group pointer-events-auto absolute left-0 top-0 -translate-y-1/2 cursor-pointer text-left focus:outline-none"
          style={{ visibility: 'hidden' }}
          onClick={(e) => {
            if (rig.didDrag) return;
            const id = (e.currentTarget as HTMLElement).dataset.region;
            if (id) {
              select(id);
              rig.focusRegion(id);
            }
          }}
        >
          <span className="flex items-center gap-2 pl-3">
            <span className="h-px w-5 bg-bone/30 group-hover:bg-bone/70" />
            <span className="rounded-sm border border-white/[0.07] bg-void-900/70 px-2 py-1 backdrop-blur-sm transition-colors group-hover:border-white/20 group-focus-visible:border-signal-cyan">
              <span
                data-abbr
                className="block font-mono text-[10px] leading-none tracking-instrument"
              />
              <span
                data-name
                className="mt-1 block max-w-[11rem] truncate text-[11px] leading-tight text-bone-dim group-data-[emphasised=true]:text-bone"
              />
              <span className="mt-1.5 block h-[2px] w-full overflow-hidden rounded-full bg-white/10">
                <span data-bar className="block h-full transition-[width] duration-150" />
              </span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

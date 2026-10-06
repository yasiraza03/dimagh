'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { clock } from '@/lib/simulation/clock';
import { useClock } from '@/lib/simulation/useClock';
import { eventAt } from '@/lib/simulation/engine';
import { regionName } from '@/lib/brain/atlas';
import { rig } from '@/lib/visualization/cameraRig';
import { useBrainStore } from '@/store/brainStore';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import type { Scenario } from '@/lib/simulation/types';

/**
 * The Causal Explorer.
 *
 * Answers "why did this happen?" by walking the scenario's causal backbone in
 * either direction. Each link is a real boundary in the model where information
 * changed form, and selecting one seeks the timeline to that moment and sends
 * the camera to the regions involved — so the chain is not a diagram beside the
 * simulation, it is a way of driving it.
 */

export function CausalExplorer({
  scenario,
  onClose,
}: {
  scenario: Scenario;
  onClose: () => void;
}) {
  const { time } = useClock();
  const [direction, setDirection] = useState<'backward' | 'forward'>('backward');
  const select = useBrainStore((s) => s.select);

  const current = useMemo(() => eventAt(scenario, time), [scenario, time]);

  // Which link in the chain corresponds to roughly "now".
  const activeIndex = useMemo(() => {
    let idx = -1;
    scenario.causalChain.forEach((node, i) => {
      const ev = node.event
        ? scenario.events.find((e) => e.id === node.event)
        : undefined;
      if (ev && time >= ev.time) idx = i;
    });
    return idx;
  }, [scenario, time]);

  const chain = useMemo(
    () =>
      direction === 'backward'
        ? [...scenario.causalChain].reverse()
        : scenario.causalChain,
    [scenario, direction],
  );

  const accent = PALETTE_HEX[scenario.accent];

  const goto = (nodeEvent: string | undefined, regions: string[]) => {
    if (nodeEvent) {
      const ev = scenario.events.find((e) => e.id === nodeEvent);
      if (ev) {
        clock.pause();
        clock.seek(ev.time);
        if (ev.camera) rig.apply(ev.camera);
        else if (ev.target) rig.focusRegion(ev.target);
        return;
      }
    }
    if (regions[0]) {
      select(regions[0]);
      rig.focusRegion(regions[0]);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] p-4">
        <div className="min-w-0">
          <p className="instrument">Causal explorer</p>
          <p className="mt-1 truncate text-[12px] text-bone-dim">
            {current ? current.title : scenario.title}
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn-icon shrink-0">
          <span className="sr-only">Close causal explorer</span>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>

      <div className="flex gap-1 border-b border-white/[0.07] p-3">
        {(['backward', 'forward'] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            aria-pressed={direction === d}
            className={clsx(
              'flex-1 border px-2 py-1.5 font-mono text-[9.5px] uppercase tracking-instrument transition-colors',
              direction === d
                ? 'border-white/30 bg-white/[0.06] text-bone'
                : 'border-white/[0.09] text-bone-faint hover:border-white/20',
            )}
          >
            Trace {d}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <p className="mb-4 text-[11.5px] leading-relaxed text-bone-faint">
          {direction === 'backward'
            ? 'Working backwards from what happened. Each step is what the one above it needed.'
            : 'Working forwards from the start. Each step is what the one above it set off.'}
        </p>

        <ol className="relative">
          {/* The spine. */}
          <span
            className="absolute left-[7px] top-2 bottom-2 w-px bg-white/[0.1]"
            aria-hidden
          />

          {chain.map((node, i) => {
            const trueIndex = scenario.causalChain.indexOf(node);
            const isActive = trueIndex === activeIndex;
            const reached =
              direction === 'backward'
                ? trueIndex <= activeIndex
                : trueIndex <= activeIndex;
            return (
              <li key={node.id} className="relative pb-5 pl-7">
                <span
                  className="absolute left-0 top-[5px] flex h-[15px] w-[15px] items-center justify-center"
                  aria-hidden
                >
                  <span
                    className="block h-[7px] w-[7px] rounded-full transition-all"
                    style={{
                      background: reached ? accent : 'rgba(255,255,255,0.2)',
                      boxShadow: isActive ? `0 0 0 3px ${accent}33` : undefined,
                    }}
                  />
                </span>

                {i > 0 && (
                  <span
                    className="absolute -top-3.5 left-[3.5px] font-mono text-[11px] text-bone-faint/70"
                    aria-hidden
                  >
                    {direction === 'backward' ? '↑' : '↓'}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => goto(node.event, node.regions)}
                  className="block w-full text-left"
                >
                  <span
                    className={clsx(
                      'block text-[13px] leading-snug transition-colors',
                      isActive ? 'text-bone' : reached ? 'text-bone-dim' : 'text-bone-faint',
                    )}
                  >
                    {node.label}
                  </span>
                  <span className="mt-1 block text-[11.5px] leading-[1.6] text-bone-faint">
                    {node.detail}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {node.regions.map((r) => (
                      <span
                        key={r}
                        className="border border-white/[0.08] px-1.5 py-[2px] font-mono text-[8.5px] uppercase tracking-wider2 text-bone-faint"
                      >
                        {regionName(r)}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="border-t border-white/[0.07] p-3">
        <p className="text-[10.5px] leading-relaxed text-bone-faint">
          &ldquo;Caused&rdquo; here means &ldquo;this step needed that one&rdquo;
          in our simplified model. In a real brain these steps overlap heavily
          rather than happening one after another.
        </p>
      </div>
    </div>
  );
}

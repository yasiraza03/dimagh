'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import { eventAt, stageAt } from '@/lib/simulation/engine';
import { useClock } from '@/lib/simulation/useClock';
import { regionName, regionAbbr } from '@/lib/brain/atlas';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import { rig } from '@/lib/visualization/cameraRig';
import { useBrainStore } from '@/store/brainStore';
import { useUIStore } from '@/store/uiStore';
import { Timecode } from '@/components/ui/primitives';
import type { Scenario } from '@/lib/simulation/types';

/**
 * The running explanation.
 *
 * This is the component that makes the whole product educational rather than
 * decorative: at every moment it names what is happening, where, and why, in
 * plain text that exists outside the canvas. Science mode adds the detail and
 * the caveat.
 */

const KIND_LABEL: Record<string, { label: string; color: string }> = {
  forward: { label: 'Feed-forward', color: PALETTE_HEX.cyan },
  feedback: { label: 'Feedback', color: PALETTE_HEX.violet },
  modulatory: { label: 'Modulatory', color: PALETTE_HEX.amber },
  burst: { label: 'Burst', color: PALETTE_HEX.threat },
  loop: { label: 'Recurrent', color: PALETTE_HEX.green },
};

export function ExplanationPanel({
  scenario,
  onExplainCause,
}: {
  scenario: Scenario;
  onExplainCause: () => void;
}) {
  const { time } = useClock();
  const scienceMode = useUIStore((s) => s.scienceMode);
  const select = useBrainStore((s) => s.select);

  const ev = useMemo(() => eventAt(scenario, time), [scenario, time]);
  const stage = useMemo(() => stageAt(scenario, time), [scenario, time]);

  if (!ev) {
    return (
      <div className="p-5">
        <p className="instrument mb-3">Ready</p>
        <p className="prose-sci">{scenario.intro}</p>
      </div>
    );
  }

  const kind = KIND_LABEL[ev.kind ?? 'forward'];
  const regions = [
    ...(ev.source ? [ev.source] : []),
    ...(ev.target ? [ev.target] : []),
    ...(ev.activate ?? []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="instrument truncate">{stage?.label ?? 'Event'}</p>
        <Timecode t={ev.time} className="shrink-0 text-[10px] text-bone-faint" />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider2"
          style={{ borderColor: `${kind.color}55`, color: kind.color }}
        >
          <span
            className="h-1 w-1 rounded-full"
            style={{ background: kind.color }}
            aria-hidden
          />
          {kind.label}
        </span>
      </div>

      <h2 className="display-md text-bone">{ev.title}</h2>

      {/* Pathway, when this event moves a signal. */}
      {ev.source && ev.target && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-bone-faint">
          <button
            type="button"
            onClick={() => {
              select(ev.source!);
              rig.focusRegion(ev.source!);
            }}
            className="border border-white/[0.1] px-1.5 py-0.5 uppercase tracking-instrument transition-colors hover:border-white/30 hover:text-bone"
          >
            {regionAbbr(ev.source)}
          </button>
          <span aria-hidden>{ev.kind === 'feedback' ? '←' : '→'}</span>
          <button
            type="button"
            onClick={() => {
              select(ev.target!);
              rig.focusRegion(ev.target!);
            }}
            className="border border-white/[0.1] px-1.5 py-0.5 uppercase tracking-instrument transition-colors hover:border-white/30 hover:text-bone"
          >
            {regionAbbr(ev.target)}
          </button>
        </p>
      )}

      <p className="prose-sci mt-4">{ev.explanation}</p>

      {scienceMode && ev.science && (
        <div className="mt-4 border-l-2 border-signal-violet/40 pl-3">
          <p className="instrument-sm mb-1.5 text-signal-violet">Science</p>
          <p className="text-[12.5px] leading-[1.7] text-bone-dim">{ev.science}</p>
        </div>
      )}

      {regions.length > 0 && (
        <div className="mt-5">
          <p className="instrument-sm mb-2">Regions involved</p>
          <div className="flex flex-wrap gap-1.5">
            {regions.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  select(r);
                  rig.focusRegion(r);
                }}
                className="border border-white/[0.09] px-2 py-1 text-left text-[11px] text-bone-dim
                           transition-colors hover:border-white/25 hover:text-bone"
              >
                {regionName(r)}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onExplainCause}
        className={clsx('btn mt-5 w-full justify-between')}
      >
        Why did this happen?
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M1 5h7.5M5.5 2L8.5 5 5.5 8" stroke="currentColor" strokeWidth="1.1" fill="none" />
        </svg>
      </button>
    </div>
  );
}

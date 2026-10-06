'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import { clock } from '@/lib/simulation/clock';
import { useClock } from '@/lib/simulation/useClock';
import { rig } from '@/lib/visualization/cameraRig';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import { Timecode } from '@/components/ui/primitives';
import { regionAbbr } from '@/lib/brain/atlas';
import type { Scenario } from '@/lib/simulation/types';

/**
 * The full event list.
 *
 * The timeline is for feel; this is for study. Every step in the scenario,
 * grouped by stage, each one a jump target. Useful on its own and essential on
 * mobile, where the dense marker track is hard to hit precisely.
 */
export function EventInspector({ scenario }: { scenario: Scenario }) {
  const { time } = useClock();

  const grouped = useMemo(() => {
    const byStage = new Map<string, typeof scenario.events>();
    for (const ev of scenario.events) {
      const key = ev.stage ?? 'other';
      if (!byStage.has(key)) byStage.set(key, []);
      byStage.get(key)!.push(ev);
    }
    return scenario.stages
      .map((s) => ({ stage: s, events: byStage.get(s.id) ?? [] }))
      .filter((g) => g.events.length > 0)
      .concat(
        byStage.has('other')
          ? [{ stage: { id: 'other', label: 'Other', time: 0 }, events: byStage.get('other')! }]
          : [],
      );
  }, [scenario]);

  const accent = PALETTE_HEX[scenario.accent];

  return (
    <div className="p-4">
      <p className="instrument mb-3">All steps — {scenario.events.length}</p>

      <div className="space-y-4">
        {grouped.map(({ stage, events }) => (
          <div key={stage.id}>
            <p className="instrument-sm mb-1.5 text-bone-dim">{stage.label}</p>
            <ul className="space-y-px">
              {events.map((ev) => {
                const passed = time >= ev.time;
                const isCurrent =
                  passed &&
                  !scenario.events.some((o) => o.time > ev.time && time >= o.time);
                return (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() => {
                        clock.pause();
                        clock.seek(ev.time);
                        if (ev.camera) rig.apply(ev.camera);
                        else if (ev.target) rig.focusRegion(ev.target);
                      }}
                      className={clsx(
                        'group flex w-full items-baseline gap-2.5 border-l-2 py-1.5 pl-2.5 pr-1 text-left transition-colors',
                        isCurrent
                          ? 'bg-white/[0.04]'
                          : 'border-transparent hover:bg-white/[0.02]',
                      )}
                      style={isCurrent ? { borderColor: accent } : undefined}
                    >
                      <Timecode
                        t={ev.time}
                        className={clsx(
                          'w-[46px] shrink-0 text-[9.5px]',
                          passed ? 'text-bone-dim' : 'text-bone-faint/60',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={clsx(
                            'block truncate text-[12px] leading-snug',
                            isCurrent
                              ? 'text-bone'
                              : passed
                                ? 'text-bone-dim'
                                : 'text-bone-faint',
                          )}
                        >
                          {ev.title}
                        </span>
                        {ev.source && ev.target && (
                          <span className="mt-0.5 block font-mono text-[8.5px] uppercase tracking-wider2 text-bone-faint/70">
                            {regionAbbr(ev.source)}{' '}
                            {ev.kind === 'feedback' ? '←' : '→'}{' '}
                            {regionAbbr(ev.target)}
                          </span>
                        )}
                      </span>
                      {ev.causal && (
                        <span
                          className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: passed ? accent : 'rgba(255,255,255,0.18)' }}
                          title="Part of the causal backbone"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-4 border-t border-white/[0.07] pt-3 text-[10.5px] leading-relaxed text-bone-faint">
        We have stretched the timings out so you can watch. In a real brain most
        of this is over in a fraction of a second.
      </p>
    </div>
  );
}

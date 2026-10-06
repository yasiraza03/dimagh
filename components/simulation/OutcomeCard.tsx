'use client';

import Link from 'next/link';
import { clock } from '@/lib/simulation/clock';
import { useSimStore } from '@/store/simulationStore';
import { useBrainStore } from '@/store/brainStore';
import { useUIStore } from '@/store/uiStore';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import type { Scenario } from '@/lib/simulation/types';

/**
 * The post-scenario card.
 *
 * The one place the project is allowed to make its argument directly: you have
 * just watched a process you will never experience, and the interesting part is
 * precisely that you did not experience it.
 */
export function OutcomeCard({ scenario }: { scenario: Scenario }) {
  const setShowOutcome = useSimStore((s) => s.setShowOutcome);
  const choiceId = useSimStore((s) => s.choiceId);
  const setLens = useBrainStore((s) => s.setLens);
  const toggleScience = useUIStore((s) => s.toggleScienceMode);
  const scienceMode = useUIStore((s) => s.scienceMode);

  const accent = PALETTE_HEX[scenario.accent];
  const chosen = scenario.choices?.options.find((o) => o.id === choiceId);

  return (
    <div className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-void-900 p-4 pt-20">
      <div className="w-full max-w-2xl animate-fade-up py-8">
        <p className="instrument mb-5" style={{ color: accent }}>
          You just experienced
        </p>

        <h2 className="display-xl text-bone">{scenario.outcome.headline}</h2>

        <p className="prose-sci mt-8 max-w-xl text-[14.5px]">
          {scenario.outcome.body}
        </p>

        {chosen && (
          <div className="mt-6 border-l-2 pl-4" style={{ borderColor: `${accent}55` }}>
            <p className="instrument-sm mb-1.5">Your branch — {chosen.label}</p>
            <p className="text-[12.5px] leading-[1.7] text-bone-dim">{chosen.outcome}</p>
          </div>
        )}

        <div className="mt-9 border-t border-white/[0.07] pt-7">
          <p className="instrument mb-3">The interesting part</p>
          <p className="max-w-xl text-balance text-[16px] leading-[1.7] text-bone">
            {scenario.outcome.insight}
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setShowOutcome(false);
              clock.seek(0);
              clock.forward();
              clock.play();
            }}
            className="btn btn-primary"
          >
            Replay
          </button>

          {scenario.choices && choiceId && (
            <button
              type="button"
              onClick={() => {
                setShowOutcome(false);
                useSimStore.getState().clearChoice();
              }}
              className="btn"
            >
              Try another choice
            </button>
          )}

          <Link href="/experience" className="btn">
            Explore another process
          </Link>

          <button
            type="button"
            onClick={() => {
              setShowOutcome(false);
              setLens('network');
            }}
            className="btn"
          >
            Trace the network
          </button>

          {!scienceMode && (
            <button
              type="button"
              onClick={() => {
                toggleScience();
                setShowOutcome(false);
              }}
              className="btn"
            >
              Open science mode
            </button>
          )}

          <Link href="/lab" className="btn">
            Enter the lab
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setShowOutcome(false)}
          className="mt-8 font-mono text-[10px] uppercase tracking-instrument text-bone-faint
                     transition-colors hover:text-bone"
        >
          ← Back to the simulation
        </button>
      </div>
    </div>
  );
}

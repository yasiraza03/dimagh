'use client';

import { clock } from '@/lib/simulation/clock';
import { useSimStore } from '@/store/simulationStore';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import type { Scenario } from '@/lib/simulation/types';

/**
 * The decision point.
 *
 * Playback genuinely stops here — the clock's gate mechanism prevents it
 * advancing past this moment until a branch is chosen, so the pause is part of
 * the simulation rather than a modal thrown over a still-running animation.
 */
export function ChoicePrompt({ scenario }: { scenario: Scenario }) {
  const choose = useSimStore((s) => s.choose);
  const choices = scenario.choices;
  if (!choices) return null;

  const accent = PALETTE_HEX[scenario.accent];

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-32 sm:pb-28">
      <div className="panel w-full max-w-2xl animate-fade-up p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inset-0 rounded-full"
              style={{ background: accent }}
            />
            <span
              className="absolute inset-0 animate-pulse-ring rounded-full"
              style={{ background: accent, opacity: 0.4 }}
            />
          </span>
          <p className="instrument">Simulation paused — decision point</p>
        </div>

        <h3 className="display-md text-bone">{choices.prompt}</h3>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {choices.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                choose(opt.id);
                // Releasing the gate and resuming is what makes the branch feel
                // like a continuation rather than a restart.
                clock.openGate();
                clock.play();
              }}
              className="group border border-white/[0.12] bg-white/[0.02] p-3.5 text-left
                         transition-all duration-200 hover:border-white/35 hover:bg-white/[0.06]
                         focus-visible:border-signal-cyan"
            >
              <span className="block font-mono text-[11px] uppercase tracking-instrument text-bone">
                {opt.label}
              </span>
              <span className="mt-1.5 block text-[11.5px] leading-[1.55] text-bone-faint">
                {opt.description}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-4 text-[10.5px] leading-relaxed text-bone-faint">
          Each branch runs a different downstream pathway. Withholding an action
          is itself a branch — and not the empty one.
        </p>
      </div>
    </div>
  );
}

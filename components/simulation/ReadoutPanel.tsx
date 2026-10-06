'use client';

import { readoutValue } from '@/lib/simulation/engine';
import { PARAM_KEYS, PARAM_LABELS, type ParamKey } from '@/lib/simulation/types';
import { useSimStore } from '@/store/simulationStore';
import { Meter } from '@/components/ui/primitives';
import type { Scenario } from '@/lib/simulation/types';

/**
 * Lab dials and the conceptual readouts they drive.
 *
 * Every number here is explicitly a *conceptual index* on a 0–100 scale, not a
 * physiological quantity, and the panel says so where it cannot be missed. That
 * restraint is the difference between an honest model and a fake instrument
 * readout.
 */

const PARAM_HINT: Record<ParamKey, string> = {
  attention: 'How hard you are concentrating.',
  distraction: 'How much else is competing for you.',
  novelty: 'How surprising or unfamiliar this is.',
  memoryLoad: 'How much you are already trying to hold in mind.',
  sensoryNoise: 'How unclear what you can see or hear is.',
  difficulty: 'How hard the task is.',
};

export function ReadoutPanel({
  scenario,
  compact = false,
}: {
  scenario: Scenario;
  compact?: boolean;
}) {
  const params = useSimStore((s) => s.params);
  const setParam = useSimStore((s) => s.setParam);
  const resetParams = useSimStore((s) => s.resetParams);
  const dirty = useSimStore((s) => s.paramsDirty);

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="instrument">Parameters</p>
        {dirty && (
          <button
            type="button"
            onClick={resetParams}
            className="font-mono text-[9px] uppercase tracking-instrument text-signal-amber
                       transition-colors hover:text-bone"
          >
            Reset
          </button>
        )}
      </div>

      <div className={compact ? 'space-y-2.5' : 'space-y-3.5'}>
        {PARAM_KEYS.map((k) => (
          <div key={k}>
            <label className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="instrument text-bone-dim">{PARAM_LABELS[k]}</span>
              <span className="font-mono text-[10px] tabular-nums text-bone-faint">
                {Math.round(params[k] * 100)}
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={params[k]}
              onChange={(e) => setParam(k, Number(e.target.value))}
              className="slider"
              aria-describedby={`hint-${k}`}
            />
            {!compact && (
              <p id={`hint-${k}`} className="mt-1 text-[10.5px] text-bone-faint">
                {PARAM_HINT[k]}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-white/[0.07] pt-4">
        <p className="instrument mb-1">Modelled outcomes</p>
        <p className="mb-3 text-[10.5px] leading-relaxed text-bone-faint">
          Scores out of 100, worked out from the dials above. They describe
          how this model behaves — they are not measurements, and they say
          nothing about you.
        </p>

        {scenario.readouts.map((r) => (
          <Meter
            key={r.id}
            label={r.label}
            value={readoutValue(r, params)}
            caption={compact ? undefined : r.note}
            accent={scenario.accent}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

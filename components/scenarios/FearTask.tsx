'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useClock } from '@/lib/simulation/useClock';
import { stageAt } from '@/lib/simulation/engine';
import { renderState } from '@/lib/visualization/renderState';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import { useUIStore } from '@/store/uiStore';
import type { Scenario } from '@/lib/simulation/types';

/**
 * The threat scenario companion.
 *
 * A dark corridor, an ambiguous shape, and an arousal indicator that follows the
 * simulation's modelled autonomic response.
 *
 * The indicator pulses, and it is labelled unambiguously as a visual device for
 * the modelled response — it is not reading anything from you, and no number
 * here is a physiological measurement. That restraint matters more in this
 * scenario than anywhere else in the project.
 */
export function FearTask({ scenario }: { scenario: Scenario }) {
  const { time } = useClock();
  const stage = useMemo(() => stageAt(scenario, time), [scenario, time]);
  const stageId = stage?.id ?? 'ambient';
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const [arousal, setArousal] = useState(0);
  const pulseRef = useRef<HTMLSpanElement>(null);

  // Mirror the scene's modelled arousal into the DOM on a slow timer — this is
  // an indicator, not an animation, so 10 Hz is plenty.
  useEffect(() => {
    const id = window.setInterval(() => setArousal(renderState.arousal), 100);
    return () => window.clearInterval(id);
  }, []);

  const resolved = ['slow', 'regulate'].includes(stageId);
  const committed = ['fast', 'body'].includes(stageId);

  // Beat interval shortens with modelled arousal.
  const beatMs = Math.round(1100 - arousal * 520);

  return (
    <div className="p-4">
      <div
        className="relative mb-3 h-[150px] overflow-hidden border border-white/[0.06]"
        style={{
          background: `radial-gradient(ellipse at 50% 70%, #10131c 0%, #05060a 70%)`,
        }}
      >
        {/* The corridor. */}
        <svg viewBox="0 0 180 140" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a1f2e" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#05060a" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Perspective lines. */}
          {[0, 1, 2, 3].map((i) => (
            <g key={i} opacity={0.5 - i * 0.1}>
              <line x1={-20 + i * 14} y1="140" x2="72" y2="58" stroke="#262c3d" strokeWidth="0.6" />
              <line x1={200 - i * 14} y1="140" x2="108" y2="58" stroke="#262c3d" strokeWidth="0.6" />
            </g>
          ))}
          <rect x="68" y="52" width="44" height="40" fill="url(#wall)" />

          {/* The ambiguous shape. */}
          <g
            className={clsx(
              'transition-opacity duration-700',
              stageId === 'ambient' ? 'opacity-0' : 'opacity-100',
            )}
          >
            <path
              d="M88 58 c-7 4 -9 14 -8 22 c1 9 -2 16 -3 22 c-1 6 3 10 9 10 c7 0 11 -4 11 -11 c0 -8 2 -16 3 -24 c1 -9 -3 -17 -12 -19z"
              fill={resolved ? '#2b3140' : '#161a24'}
              stroke={committed ? PALETTE_HEX.threat : resolved ? '#39404f' : '#242a38'}
              strokeWidth={committed ? 1.2 : 0.7}
              opacity={resolved ? 0.9 : 1}
            />
            {resolved && (
              <text
                x="90"
                y="118"
                textAnchor="middle"
                fontSize="7"
                fill="#6f6a62"
                fontFamily="ui-monospace, monospace"
                letterSpacing="1"
              >
                A COAT ON A CHAIR
              </text>
            )}
          </g>

          {/* Threat highlight during the fast route. */}
          {committed && !reducedMotion && (
            <rect
              x="0"
              y="0"
              width="180"
              height="140"
              fill={PALETTE_HEX.threat}
              opacity="0.05"
            >
              <animate
                attributeName="opacity"
                values="0.02;0.1;0.02"
                dur="1.1s"
                repeatCount="indefinite"
              />
            </rect>
          )}
        </svg>

        <p className="absolute left-2 top-2 font-mono text-[8px] uppercase tracking-wider2 text-bone-faint">
          {stage?.label ?? 'low light'}
        </p>
      </div>

      {/* Arousal indicator. */}
      <div className="mb-3 flex items-center gap-3 border border-white/[0.07] px-3 py-2.5">
        <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          <span
            ref={pulseRef}
            className="absolute inset-0 rounded-full"
            style={{
              background: PALETTE_HEX.threat,
              opacity: 0.25 + arousal * 0.6,
              animation: reducedMotion
                ? undefined
                : `pulse-ring ${beatMs}ms ease-out infinite`,
            }}
          />
          <span
            className="relative h-1.5 w-1.5 rounded-full"
            style={{ background: PALETTE_HEX.threat }}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="instrument-sm">Modelled autonomic response</p>
          <span className="mt-1 block h-[3px] w-full overflow-hidden bg-white/[0.07]">
            <span
              className="block h-full transition-[width] duration-200"
              style={{
                width: `${Math.round(arousal * 100)}%`,
                background: PALETTE_HEX.threat,
              }}
            />
          </span>
        </div>
      </div>

      <p className="text-[11.5px] leading-[1.6] text-bone-dim">
        {stageId === 'ambient' &&
          'Low light, unfamiliar space. Arousal is already elevated before anything has happened.'}
        {stageId === 'onset' && 'Movement in the periphery. Low detail, high urgency.'}
        {stageId === 'fast' &&
          'A fast, coarse route has reached relevance-detection circuitry. Recognition has not finished.'}
        {stageId === 'body' &&
          'The body is committed. Heart rate, breathing and attention have all changed on evidence that has not been evaluated.'}
        {stageId === 'slow' &&
          'The cortical route resolves it. A coat on a chair. The information was always on its way — it was just slower.'}
        {stageId === 'regulate' &&
          'You know there is no threat. Your body takes several more minutes to agree, which is why the feeling outlasts the realisation.'}
      </p>

      <p className="mt-3 text-[10.5px] leading-relaxed text-bone-faint">
        The pulsing indicator is a <strong>visual device for the modelled
        response</strong> in this scenario. It is not reading your heart rate,
        nothing here is a physiological measurement, and this scenario describes a
        transient response in a healthy system — it is not a model of anxiety
        disorders and not clinical information.
      </p>
    </div>
  );
}

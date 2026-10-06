'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { clock } from '@/lib/simulation/clock';
import { useClock } from '@/lib/simulation/useClock';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import type { Scenario } from '@/lib/simulation/types';

/**
 * The circular sleep timeline.
 *
 * A night laid out as a dial, with the hypnogram wrapped around it. Time
 * compression changes how much of the night the dial represents, which is the
 * point: eight hours is not two four-hour halves, because the stage
 * distribution shifts dramatically between them.
 *
 * The waveform inside is a stylised illustration of changing synchronisation
 * between states. It is explicitly not generated from a model of cortical
 * electrical activity, and this is not an EEG simulator.
 */

const STAGES = [
  { id: 'awake', label: 'Awake', color: PALETTE_HEX.bone, level: 0 },
  { id: 'rem', label: 'REM', color: PALETTE_HEX.violet, level: 1 },
  { id: 'n1', label: 'N1', color: PALETTE_HEX.cyan, level: 2 },
  { id: 'n2', label: 'N2', color: PALETTE_HEX.blue, level: 3 },
  { id: 'n3', label: 'N3', color: PALETTE_HEX.green, level: 4 },
] as const;

const COMPRESSION = [
  { id: '10m', label: '10 min', hours: 0.17, note: 'Barely into the first descent. Most of this window is N1 and early N2.' },
  { id: '1h', label: '1 hour', hours: 1, note: 'One partial cycle. Deep N3 dominates, which is typical of the early night.' },
  { id: '8h', label: '8 hours', hours: 8, note: 'Four to six cycles. Deep sleep is front-loaded; REM periods lengthen toward morning.' },
] as const;

/**
 * A representative hypnogram. Stage proportions shift across the night: N3
 * early, REM late. Generated rather than hand-drawn so compression works.
 */
function hypnogram(hours: number, samples = 180): number[] {
  const out: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * hours; // hours into the night
    const cyclePos = (t % 1.5) / 1.5; // ~90 minute cycles
    const nightFraction = hours > 0 ? t / Math.max(hours, 1e-6) : 0;

    // Deep sleep pressure falls across the night; REM pressure rises.
    const deepWeight = Math.max(0, 1 - nightFraction * 1.25);
    const remWeight = Math.min(1, nightFraction * 1.5);

    let level: number;
    if (t < 0.08) level = 0; // awake
    else if (cyclePos < 0.1) level = 2; // N1
    else if (cyclePos < 0.35) level = 3; // N2
    else if (cyclePos < 0.62) level = 3 + deepWeight; // N2→N3
    else if (cyclePos < 0.78) level = 3; // back to N2
    else level = 3 - remWeight * 2; // into REM
    out.push(Math.max(0, Math.min(4, level)));
  }
  return out;
}

export function SleepDial({ scenario }: { scenario: Scenario }) {
  const { time, duration } = useClock();
  const [compression, setCompression] = useState<(typeof COMPRESSION)[number]['id']>('8h');
  const comp = COMPRESSION.find((c) => c.id === compression)!;

  const trace = useMemo(() => hypnogram(comp.hours), [comp.hours]);

  // Map scenario time onto the dial.
  const progress = duration > 0 ? time / duration : 0;
  const angle = progress * Math.PI * 2 - Math.PI / 2;

  const R_OUT = 44;
  const R_IN = 20;

  const points = trace
    .map((level, i) => {
      const a = (i / trace.length) * Math.PI * 2 - Math.PI / 2;
      const r = R_IN + ((4 - level) / 4) * (R_OUT - R_IN);
      return `${(50 + Math.cos(a) * r).toFixed(2)},${(50 + Math.sin(a) * r).toFixed(2)}`;
    })
    .join(' ');

  const currentStage = scenario.stages.reduce(
    (acc, s) => (time >= s.time ? s : acc),
    scenario.stages[0],
  );

  return (
    <div className="p-4">
      <div className="relative mb-3 flex h-[172px] items-center justify-center overflow-hidden border border-white/[0.06] bg-void-900">
        <svg viewBox="0 0 100 100" className="h-full" aria-hidden>
          {/* Stage rings. */}
          {STAGES.map((s) => {
            const r = R_IN + ((4 - s.level) / 4) * (R_OUT - R_IN);
            return (
              <circle
                key={s.id}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="0.18"
                opacity="0.16"
              />
            );
          })}

          {/* Hypnogram. */}
          <polygon
            points={points}
            fill="none"
            stroke={PALETTE_HEX.blue}
            strokeWidth="0.7"
            opacity="0.85"
            vectorEffect="non-scaling-stroke"
          />

          {/* Elapsed sweep. */}
          <path
            d={`M 50 50 L ${50 + Math.cos(-Math.PI / 2) * R_OUT} ${
              50 + Math.sin(-Math.PI / 2) * R_OUT
            } A ${R_OUT} ${R_OUT} 0 ${progress > 0.5 ? 1 : 0} 1 ${
              50 + Math.cos(angle) * R_OUT
            } ${50 + Math.sin(angle) * R_OUT} Z`}
            fill={`${PALETTE_HEX.violet}14`}
          />

          {/* Playhead. */}
          <line
            x1="50"
            y1="50"
            x2={50 + Math.cos(angle) * R_OUT}
            y2={50 + Math.sin(angle) * R_OUT}
            stroke="#fff"
            strokeWidth="0.4"
          />
          <circle
            cx={50 + Math.cos(angle) * R_OUT}
            cy={50 + Math.sin(angle) * R_OUT}
            r="1.4"
            fill="#fff"
          />

          {/* Stylised synchronisation waveform in the hub. */}
          <g>
            {Array.from({ length: 40 }).map((_, i) => {
              const x = 32 + (i / 39) * 36;
              // Deep sleep: slow and large. REM/wake: fast and small.
              const depth = currentStage?.id === 'n3' ? 1 : currentStage?.id === 'n2' ? 0.6 : 0.2;
              const freq = 1 + (1 - depth) * 7;
              const amp = 1.4 + depth * 4.2;
              const y = 50 + Math.sin(i * freq * 0.5 + time * 3) * amp;
              return (
                <rect
                  key={i}
                  x={x}
                  y={y - 0.2}
                  width="0.55"
                  height="0.4"
                  fill={PALETTE_HEX.cyan}
                  opacity="0.75"
                />
              );
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute left-2 top-2">
          <p className="font-mono text-[8px] uppercase tracking-wider2 text-bone-faint">
            {comp.label} compressed
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-instrument text-signal-violet">
            {currentStage?.label ?? 'awake'}
          </p>
        </div>
      </div>

      <div className="mb-3 flex gap-1">
        {COMPRESSION.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCompression(c.id);
              clock.seek(0);
            }}
            aria-pressed={compression === c.id}
            className={clsx(
              'flex-1 border px-2 py-1.5 font-mono text-[9px] uppercase tracking-instrument transition-colors',
              compression === c.id
                ? 'border-signal-blue/50 bg-signal-blue/[0.1] text-signal-blue'
                : 'border-white/[0.09] text-bone-faint hover:border-white/25',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <p className="text-[11.5px] leading-[1.6] text-bone-dim">{comp.note}</p>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {STAGES.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: s.color }}
              aria-hidden
            />
            <span className="font-mono text-[8.5px] uppercase tracking-wider2 text-bone-faint">
              {s.label}
            </span>
          </span>
        ))}
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-bone-faint">
        <strong>This is not an EEG simulator.</strong> The dial trace is a
        representative hypnogram generated for this page, and the waveform in the
        hub is a stylised indication that synchronisation changes between states —
        not a model of cortical electrical activity, and not anyone&rsquo;s
        recording.
      </p>
    </div>
  );
}

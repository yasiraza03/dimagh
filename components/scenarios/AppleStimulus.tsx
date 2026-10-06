'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import { useClock } from '@/lib/simulation/useClock';
import { stageAt } from '@/lib/simulation/engine';
import type { Scenario } from '@/lib/simulation/types';

/**
 * The visual stimulus for the flagship scenario.
 *
 * Synchronised to scenario time: the apple appears, freezes, then decomposes
 * into the feature channels early visual cortex actually carries — and
 * crucially, it decomposes into *abstractions*, not into prettier pictures of an
 * apple. The whole point of the stage is that there is no apple in V1.
 */

const CHANNELS = [
  {
    id: 'colour',
    label: 'Colour',
    note: 'Surface colour, partly corrected for the light falling on it.',
  },
  {
    id: 'edge',
    label: 'Edges',
    note: 'Where luminance changes sharply.',
  },
  {
    id: 'orientation',
    label: 'Orientation',
    note: 'Local edge angle, by population of tuned cells.',
  },
  {
    id: 'shape',
    label: 'Shape',
    note: 'Enclosed region — a candidate object boundary.',
  },
  {
    id: 'space',
    label: 'Position',
    note: 'Where in the visual field, in retinotopic coordinates.',
  },
] as const;

/** A simple apple silhouette, reused by every channel. */
function AppleShape({
  fill,
  stroke,
  strokeWidth = 1.4,
  showStem = true,
}: {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  showStem?: boolean;
}) {
  return (
    <g>
      <path
        d="M32 14c-3.6 0-6 1.6-8 1.6S19.6 14 16 14C9.4 14 4 20.2 4 29.6 4 41 12.6 54 20 54c2.8 0 4-1.4 6-1.4s3.2 1.4 6 1.4c7.4 0 16-13 16-24.4C48 20.2 42.6 14 36 14h-4z"
        transform="translate(-2 -6) scale(1.02)"
        fill={fill ?? 'none'}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {showStem && (
        <path
          d="M24 9c0-4 2.5-6.5 6-7"
          fill="none"
          stroke={stroke ?? fill}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

function ChannelTile({
  id,
  active,
}: {
  id: (typeof CHANNELS)[number]['id'];
  active: boolean;
}) {
  return (
    <svg
      viewBox="0 0 48 52"
      className={clsx(
        'h-full w-full transition-opacity duration-500',
        active ? 'opacity-100' : 'opacity-25',
      )}
      aria-hidden
    >
      {id === 'colour' && (
        <>
          {/* Deliberately blurred: colour is carried without shape. */}
          <defs>
            <filter id="blurC">
              <feGaussianBlur stdDeviation="3.4" />
            </filter>
          </defs>
          <g filter="url(#blurC)">
            <AppleShape fill="#d6303c" showStem={false} />
          </g>
          <circle cx="18" cy="24" r="4" fill="#ff7a3d" opacity="0.5" />
        </>
      )}

      {id === 'edge' && <AppleShape stroke="#4fd8e8" strokeWidth={1.1} />}

      {id === 'orientation' && (
        <>
          <defs>
            <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse">
              <path d="M0 5L5 0" stroke="#8b6cff" strokeWidth="0.9" />
            </pattern>
            <clipPath id="clipA">
              <AppleShape fill="#fff" showStem={false} />
            </clipPath>
          </defs>
          <g clipPath="url(#clipA)">
            <rect width="48" height="52" fill="url(#hatch)" />
          </g>
          {/* A few orientation samples along the contour. */}
          {[
            [10, 28, 70],
            [24, 10, 5],
            [38, 30, -65],
            [24, 46, 2],
          ].map(([x, y, a]) => (
            <line
              key={`${x}-${y}`}
              x1={x - 3}
              y1={y}
              x2={x + 3}
              y2={y}
              stroke="#8b6cff"
              strokeWidth="1.3"
              transform={`rotate(${a} ${x} ${y})`}
            />
          ))}
        </>
      )}

      {id === 'shape' && <AppleShape fill="#f2ede4" showStem={false} />}

      {id === 'space' && (
        <>
          <rect
            x="2"
            y="4"
            width="44"
            height="44"
            fill="none"
            stroke="#262c3d"
            strokeWidth="0.8"
          />
          <path d="M24 4v44M2 26h44" stroke="#262c3d" strokeWidth="0.6" />
          <circle cx="22" cy="28" r="7" fill="none" stroke="#3b6bff" strokeWidth="1.2" />
          <circle cx="22" cy="28" r="1.6" fill="#3b6bff" />
        </>
      )}
    </svg>
  );
}

export function AppleStimulus({ scenario }: { scenario: Scenario }) {
  const { time } = useClock();
  const stage = useMemo(() => stageAt(scenario, time), [scenario, time]);
  const id = stage?.id ?? 'input';

  const split = id === 'features';
  const converged = ['object', 'meaning', 'decision', 'action'].includes(id);

  return (
    <div className="p-4">
      <div className="relative mb-3 flex h-[132px] items-center justify-center overflow-hidden border border-white/[0.06] bg-void-900">
        {/* The whole stimulus, before and after decomposition. */}
        <svg
          viewBox="0 0 48 52"
          className={clsx(
            'h-[108px] transition-all duration-700 ease-cine',
            split ? 'scale-75 opacity-0' : 'scale-100 opacity-100',
          )}
          aria-hidden
        >
          <defs>
            <radialGradient id="appleBody" cx="36%" cy="30%">
              <stop offset="0%" stopColor="#ff6b5e" />
              <stop offset="55%" stopColor="#d6303c" />
              <stop offset="100%" stopColor="#7d1420" />
            </radialGradient>
          </defs>
          <AppleShape fill="url(#appleBody)" stroke="#2a0d12" strokeWidth={0.8} />
          <ellipse cx="17" cy="21" rx="4.5" ry="6" fill="#fff" opacity="0.18" />
        </svg>

        {/* Feature channels, revealed during the feature-processing stage. */}
        <div
          className={clsx(
            'absolute inset-0 grid grid-cols-5 gap-1 p-2 transition-opacity duration-700',
            split ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          {CHANNELS.map((c) => (
            <div key={c.id} className="flex flex-col">
              <div className="min-h-0 flex-1">
                <ChannelTile id={c.id} active={split} />
              </div>
              <span className="mt-1 block truncate text-center font-mono text-[7.5px] uppercase tracking-wider2 text-bone-faint">
                {c.label}
              </span>
            </div>
          ))}
        </div>

        {/* Convergence indicator. */}
        {converged && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-signal-violet" aria-hidden />
            <span className="font-mono text-[8px] uppercase tracking-wider2 text-signal-violet">
              object representation
            </span>
          </div>
        )}

        {id === 'input' && (
          <div className="absolute left-2 top-2 flex items-center gap-1.5">
            <span className="h-1 w-1 animate-pulse rounded-full bg-signal-cyan" aria-hidden />
            <span className="font-mono text-[8px] uppercase tracking-wider2 text-signal-cyan">
              stimulus present
            </span>
          </div>
        )}
      </div>

      <p className="text-[11.5px] leading-[1.6] text-bone-dim">
        {split
          ? 'The same input, as early visual cortex carries it: separable channels, none of which is a picture of an apple.'
          : converged
            ? 'Those channels have been recombined into a representation that stays stable across viewpoint, size and lighting.'
            : 'A stimulus. Nothing has interpreted it yet — this is still just light with structure.'}
      </p>

      {split && (
        <ul className="mt-3 space-y-1">
          {CHANNELS.map((c) => (
            <li key={c.id} className="flex gap-2 text-[10.5px] leading-snug text-bone-faint">
              <span className="w-[62px] shrink-0 font-mono uppercase tracking-wider2">
                {c.label}
              </span>
              <span className="flex-1">{c.note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

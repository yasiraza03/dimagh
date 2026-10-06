'use client';

import { useState } from 'react';

/**
 * Checker-shadow.
 *
 * Two squares painted with the identical grey value, one in apparent shadow.
 * The "bridge" connects them with a band of that same grey — which is the only
 * way to make the equality undeniable, because side by side the context still
 * wins.
 */

const GREY = '#8a8a8a';
const LIGHT = '#b4b4b4';
const DARK = '#5e5e5e';

export function CheckerShadow() {
  const [bridge, setBridge] = useState(false);
  const [shadowOff, setShadowOff] = useState(false);

  const cells: Array<{ x: number; y: number; light: boolean }> = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 8; x++) {
      cells.push({ x, y, light: (x + y) % 2 === 0 });
    }
  }

  const S = 30;
  // Target A: a "light" cell outside the shadow. Target B: a "dark" cell inside.
  const A = { x: 1, y: 1 };
  const B = { x: 5, y: 3 };

  const isTarget = (x: number, y: number) =>
    (x === A.x && y === A.y) || (x === B.x && y === B.y);

  return (
    <div>
      <div className="mb-4 flex justify-center border border-white/[0.07] bg-void-900 p-4">
        <svg viewBox="0 0 240 180" className="h-[180px]" aria-hidden>
          <defs>
            <linearGradient id="shadowGrad" x1="0" y1="0" x2="1" y2="0.4">
              <stop offset="0%" stopColor="#000" stopOpacity="0.42" />
              <stop offset="70%" stopColor="#000" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </linearGradient>
          </defs>

          {cells.map(({ x, y, light }) => (
            <rect
              key={`${x}-${y}`}
              x={x * S}
              y={y * S}
              width={S}
              height={S}
              fill={isTarget(x, y) ? GREY : light ? LIGHT : DARK}
            />
          ))}

          {/* The cast shadow. Everything to the right of the cylinder. */}
          {!shadowOff && (
            <>
              <polygon points="120,0 240,0 240,180 96,180" fill="url(#shadowGrad)" />
              {/* The cylinder casting it. */}
              <rect x="96" y="-20" width="26" height="60" fill="#3a3a3a" />
              <ellipse cx="109" cy="40" rx="13" ry="5" fill="#2e2e2e" />
            </>
          )}

          {/* The bridge: a band of the identical grey crossing the boundary. */}
          {bridge && (
            <rect
              x={A.x * S + 6}
              y={A.y * S + S / 2 - 7}
              width={(B.x - A.x) * S + S - 12}
              height={14}
              fill={GREY}
            />
          )}

          {/* Target markers. */}
          {[A, B].map((t, i) => (
            <g key={i}>
              <rect
                x={t.x * S + 1}
                y={t.y * S + 1}
                width={S - 2}
                height={S - 2}
                fill="none"
                stroke="#4fd8e8"
                strokeWidth="1.2"
              />
              <text
                x={t.x * S + S / 2}
                y={t.y * S - 3}
                textAnchor="middle"
                fontSize="9"
                fill="#4fd8e8"
                fontFamily="ui-monospace, monospace"
              >
                {i === 0 ? 'A' : 'B'}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setBridge((v) => !v)}
          className="btn flex-1"
        >
          {bridge ? 'Remove the bridge' : 'Connect A and B'}
        </button>
        <button
          type="button"
          onClick={() => setShadowOff((v) => !v)}
          className="btn flex-1"
        >
          {shadowOff ? 'Restore the shadow' : 'Remove the shadow'}
        </button>
      </div>

      <div className="mt-4 border-l-2 border-signal-cyan/40 pl-3">
        <p className="text-[12.5px] leading-[1.7] text-bone-dim">
          A and B are both filled with <code className="font-mono text-bone">{GREY}</code>
          . Exactly the same value, every channel.
        </p>
        <p className="mt-2 text-[12px] leading-[1.7] text-bone-faint">
          {bridge
            ? 'With the bridge in place the equality is undeniable — the band does not change colour as it crosses the shadow boundary, because nothing about it changes.'
            : shadowOff
              ? 'With the shadow removed, the two squares finally look similar. The difference you saw was being supplied by the illumination estimate, not by the pixels.'
              : 'They do not look similar, and they will not start looking similar because you now know they are. Your visual system is estimating the surface, not reporting the light.'}
        </p>
      </div>
    </div>
  );
}

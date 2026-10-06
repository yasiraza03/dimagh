'use client';

import { useState } from 'react';

/**
 * Müller-Lyer.
 *
 * You adjust the top shaft until the two look equal, then the measurement is
 * revealed. Making you commit to a setting before the reveal is what turns this
 * from a picture of an illusion into an experiment you ran — your own
 * adjustment is the data.
 */
export function MullerLyer() {
  const [adjust, setAdjust] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const BASE = 180;
  const topLength = BASE + adjust;
  const errorPct = (adjust / BASE) * 100;

  const fin = (x: number, y: number, dir: 1 | -1, out: boolean) => {
    const d = 16;
    const a = out ? 1 : -1;
    return `M ${x} ${y} l ${dir * a * d} ${-d} M ${x} ${y} l ${dir * a * d} ${d}`;
  };

  return (
    <div>
      <div className="mb-4 border border-white/[0.07] bg-void-900 p-5">
        <svg viewBox="0 0 260 120" className="h-[140px] w-full" aria-hidden>
          {/* Top shaft — adjustable, outward fins. */}
          <g transform="translate(130, 38)">
            <line
              x1={-topLength / 2}
              y1="0"
              x2={topLength / 2}
              y2="0"
              stroke="#f2ede4"
              strokeWidth="1.6"
            />
            <path
              d={fin(-topLength / 2, 0, 1, true)}
              stroke="#f2ede4"
              strokeWidth="1.6"
              fill="none"
            />
            <path
              d={fin(topLength / 2, 0, -1, true)}
              stroke="#f2ede4"
              strokeWidth="1.6"
              fill="none"
            />
          </g>

          {/* Bottom shaft — fixed, inward fins. */}
          <g transform="translate(130, 86)">
            <line x1={-BASE / 2} y1="0" x2={BASE / 2} y2="0" stroke="#f2ede4" strokeWidth="1.6" />
            <path d={fin(-BASE / 2, 0, 1, false)} stroke="#f2ede4" strokeWidth="1.6" fill="none" />
            <path d={fin(BASE / 2, 0, -1, false)} stroke="#f2ede4" strokeWidth="1.6" fill="none" />
          </g>

          {revealed && (
            <>
              <line
                x1={130 - topLength / 2}
                y1="30"
                x2={130 - BASE / 2}
                y2="94"
                stroke="#4fd8e8"
                strokeWidth="0.8"
                strokeDasharray="3 3"
              />
              <line
                x1={130 + topLength / 2}
                y1="30"
                x2={130 + BASE / 2}
                y2="94"
                stroke="#4fd8e8"
                strokeWidth="0.8"
                strokeDasharray="3 3"
              />
            </>
          )}
        </svg>
      </div>

      <label className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="instrument text-bone-dim">
          Adjust the top line until they look equal
        </span>
        <span className="font-mono text-[10px] tabular-nums text-bone-faint">
          {adjust > 0 ? '+' : ''}
          {adjust}px
        </span>
      </label>
      <input
        type="range"
        min={-50}
        max={50}
        step={1}
        value={adjust}
        onChange={(e) => {
          setAdjust(Number(e.target.value));
          setRevealed(false);
        }}
        className="slider"
      />

      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="btn mt-4 w-full"
      >
        {revealed ? 'Hide the measurement' : 'Reveal the measurement'}
      </button>

      {revealed && (
        <div className="mt-4 border-l-2 border-signal-cyan/40 pl-3">
          <p className="text-[12.5px] leading-[1.7] text-bone-dim">
            {Math.abs(adjust) < 4 ? (
              <>
                You set them within {Math.abs(adjust)}px of equal — unusually
                accurate. The shafts are the same length when the slider is at
                zero.
              </>
            ) : (
              <>
                You made the top line{' '}
                <strong className="text-bone">
                  {Math.abs(adjust)}px {adjust > 0 ? 'longer' : 'shorter'}
                </strong>{' '}
                ({Math.abs(errorPct).toFixed(1)}%) to make it look equal. At zero
                the two shafts are pixel-identical.
              </>
            )}
          </p>
          <p className="mt-2 text-[12px] leading-[1.7] text-bone-faint">
            Set the slider back to zero and look again. Knowing they are equal
            does not make them look equal — the inference is happening below the
            level your knowledge can reach.
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';

/**
 * Kanizsa triangle.
 *
 * The rotation control is the experiment: the same amount of ink, the same
 * three discs, and the triangle appears and disappears purely as a function of
 * configuration. Nothing is added or removed.
 */
export function Kanizsa() {
  const [rotation, setRotation] = useState(0);
  const [showProof, setShowProof] = useState(false);

  const R = 26;
  const discs = [
    { x: 110, y: 38, base: 0 },
    { x: 56, y: 128, base: 120 },
    { x: 164, y: 128, base: 240 },
  ];

  /** A disc with a 90° wedge removed, pointing at the triangle's centre. */
  const pacman = (cx: number, cy: number, angleDeg: number) => {
    const a = (angleDeg * Math.PI) / 180;
    const half = (90 * Math.PI) / 180 / 2;
    const x1 = cx + Math.cos(a - half) * R;
    const y1 = cy + Math.sin(a - half) * R;
    const x2 = cx + Math.cos(a + half) * R;
    const y2 = cy + Math.sin(a + half) * R;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 1 1 ${x2} ${y2} Z`;
  };

  const intact = rotation === 0;

  return (
    <div>
      <div className="mb-4 flex justify-center border border-white/[0.07] bg-void-900 p-4">
        <svg viewBox="0 0 220 180" className="h-[180px]" aria-hidden>
          {/* Proof overlay: the "triangle" region, filled with the background. */}
          {showProof && (
            <polygon
              points="110,46 62,122 158,122"
              fill="#05060a"
              stroke="#ff7a3d"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          )}

          {discs.map((d, i) => {
            // Base angle points the wedge at the centre; rotation turns it away.
            const angle = d.base + 60 + rotation;
            return (
              <path
                key={i}
                d={pacman(d.x, d.y, angle)}
                fill="#f2ede4"
                transform-origin={`${d.x} ${d.y}`}
              />
            );
          })}

          {showProof && (
            <text
              x="110"
              y="104"
              textAnchor="middle"
              fontSize="8"
              fill="#ff7a3d"
              fontFamily="ui-monospace, monospace"
              letterSpacing="1"
            >
              BACKGROUND
            </text>
          )}
        </svg>
      </div>

      <label className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="instrument text-bone-dim">Rotate the inducers</span>
        <span className="font-mono text-[10px] tabular-nums text-bone-faint">
          {rotation}°
        </span>
      </label>
      <input
        type="range"
        min={0}
        max={180}
        step={5}
        value={rotation}
        onChange={(e) => setRotation(Number(e.target.value))}
        className="slider"
      />

      <button
        type="button"
        onClick={() => setShowProof((v) => !v)}
        className="btn mt-4 w-full"
      >
        {showProof ? 'Hide the overlay' : 'Show what is actually there'}
      </button>

      <div className="mt-4 border-l-2 border-signal-cyan/40 pl-3">
        <p className="text-[12.5px] leading-[1.7] text-bone-dim">
          {intact
            ? 'A bright triangle with crisp edges, sitting slightly in front of the discs. Many people also see its interior as brighter than the background.'
            : rotation < 60
              ? 'Partially rotated — the triangle is weakening but has not gone. The percept degrades gracefully, which tells you it is an inference rather than a switch.'
              : 'The triangle is gone. The same three shapes, the same amount of ink, rotated.'}
        </p>
        <p className="mt-2 text-[12px] leading-[1.7] text-bone-faint">
          There are no edges in the image where you see edges, and the interior is
          exactly the same colour as the background. Both were constructed from
          the occlusion cues the configuration implies.
        </p>
      </div>
    </div>
  );
}

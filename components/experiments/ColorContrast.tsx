'use client';

import { useState } from 'react';

/**
 * Simultaneous colour contrast.
 *
 * Two identical inner patches on opposing surrounds. Collapsing the surrounds
 * slides the patches together against a neutral field, which is the only
 * arrangement in which they finally look the same.
 */

const PATCH = '#8a8f72';
const WARM = '#b5603a';
const COOL = '#2f5f8a';

export function ColorContrast() {
  const [collapsed, setCollapsed] = useState(false);
  const [surroundStrength, setSurroundStrength] = useState(1);

  const mix = (hex: string, amount: number) => {
    // Blend the surround toward the neutral background as the slider drops.
    const n = [0x14, 0x17, 0x20];
    const c = [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
    const out = c.map((v, i) => Math.round(n[i] + (v - n[i]) * amount));
    return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-center border border-white/[0.07] bg-void-900 p-5">
        <svg viewBox="0 0 240 150" className="h-[160px] w-full" aria-hidden>
          <rect width="240" height="150" fill="#141720" />

          <g
            style={{
              transform: collapsed ? 'translateX(46px)' : 'translateX(0)',
              transition: 'transform 700ms cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <rect
              x="14"
              y="25"
              width="100"
              height="100"
              fill={mix(WARM, collapsed ? 0 : surroundStrength)}
              style={{ transition: 'fill 500ms' }}
            />
            <rect x="44" y="55" width="40" height="40" fill={PATCH} />
          </g>

          <g
            style={{
              transform: collapsed ? 'translateX(-46px)' : 'translateX(0)',
              transition: 'transform 700ms cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <rect
              x="126"
              y="25"
              width="100"
              height="100"
              fill={mix(COOL, collapsed ? 0 : surroundStrength)}
              style={{ transition: 'fill 500ms' }}
            />
            <rect x="156" y="55" width="40" height="40" fill={PATCH} />
          </g>

          <text
            x="64"
            y="140"
            textAnchor="middle"
            fontSize="8"
            fill="#6f6a62"
            fontFamily="ui-monospace, monospace"
            letterSpacing="1"
            opacity={collapsed ? 0 : 1}
          >
            WARM SURROUND
          </text>
          <text
            x="176"
            y="140"
            textAnchor="middle"
            fontSize="8"
            fill="#6f6a62"
            fontFamily="ui-monospace, monospace"
            letterSpacing="1"
            opacity={collapsed ? 0 : 1}
          >
            COOL SURROUND
          </text>
        </svg>
      </div>

      <label className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="instrument text-bone-dim">Surround strength</span>
        <span className="font-mono text-[10px] tabular-nums text-bone-faint">
          {Math.round(surroundStrength * 100)}
        </span>
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={surroundStrength}
        onChange={(e) => setSurroundStrength(Number(e.target.value))}
        disabled={collapsed}
        className="slider disabled:opacity-40"
      />

      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="btn mt-4 w-full"
      >
        {collapsed ? 'Restore the surrounds' : 'Bring the patches together'}
      </button>

      <div className="mt-4 border-l-2 border-signal-orange/40 pl-3">
        <p className="text-[12.5px] leading-[1.7] text-bone-dim">
          Both inner patches are{' '}
          <code className="font-mono text-bone">{PATCH}</code>, pixel for pixel.
        </p>
        <p className="mt-2 text-[12px] leading-[1.7] text-bone-faint">
          {collapsed
            ? 'Side by side on a neutral field, they finally match. Nothing about the patches changed — only what surrounds them.'
            : surroundStrength < 0.3
              ? 'As the surrounds fade toward neutral, the difference fades with them. The effect scales with the evidence about illumination, not with the patches.'
              : 'Colour is computed relative to context. Your visual system is using the surround as evidence about the light, and reporting the surface rather than the signal.'}
        </p>
      </div>
    </div>
  );
}

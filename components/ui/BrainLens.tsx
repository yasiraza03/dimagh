'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { LENS_MODES, type LensMode } from '@/lib/simulation/types';
import { LENS_INFO, useBrainStore } from '@/store/brainStore';
import { rig } from '@/lib/visualization/cameraRig';

/**
 * The Brain Lens.
 *
 * Changing lens is not a recolour. Each mode rewrites shell opacity, activity
 * gain, pathway visibility, particle density, label policy and camera idle
 * behaviour — see lib/visualization/lens.ts. The panel states what the active
 * lens is actually doing, because a viewer who cannot tell what changed has
 * learned nothing from the change.
 */
export function BrainLens({ compact = false }: { compact?: boolean }) {
  const lens = useBrainStore((s) => s.lens);
  const setLens = useBrainStore((s) => s.setLens);
  const shellOpacity = useBrainStore((s) => s.shellOpacity);
  const setShellOpacity = useBrainStore((s) => s.setShellOpacity);
  const isolated = useBrainStore((s) => s.isolated);
  const isolate = useBrainStore((s) => s.isolate);
  const [open, setOpen] = useState(!compact);

  const info = LENS_INFO[lens];

  return (
    <div className="panel w-[228px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5"
      >
        <span className="instrument">Brain lens</span>
        <span
          className={clsx(
            'font-mono text-[9px] uppercase tracking-instrument text-signal-cyan transition-transform',
            !open && 'rotate-180',
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-white/[0.07] p-2.5">
          <div className="grid grid-cols-2 gap-1">
            {LENS_MODES.map((m: LensMode) => (
              <button
                key={m}
                type="button"
                onClick={() => setLens(m)}
                aria-pressed={lens === m}
                className={clsx(
                  'border px-2 py-1.5 text-left font-mono text-[9.5px] uppercase tracking-instrument transition-colors',
                  lens === m
                    ? 'border-signal-cyan/50 bg-signal-cyan/[0.09] text-signal-cyan'
                    : 'border-white/[0.09] text-bone-faint hover:border-white/25 hover:text-bone-dim',
                )}
              >
                {LENS_INFO[m].label}
              </button>
            ))}
          </div>

          <div className="mt-3 border-t border-white/[0.07] pt-3">
            <p className="text-[11.5px] leading-[1.55] text-bone-dim">{info.blurb}</p>
            <p className="mt-1.5 text-[10.5px] leading-snug text-bone-faint">
              {info.hint}
            </p>
          </div>

          <div className="mt-3 border-t border-white/[0.07] pt-3">
            <label className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="instrument text-bone-dim">Cortex opacity</span>
              <span className="font-mono text-[10px] tabular-nums text-bone-faint">
                {Math.round(shellOpacity * 100)}
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={shellOpacity}
              onChange={(e) => setShellOpacity(Number(e.target.value))}
              className="slider"
            />
            <p className="mt-1.5 text-[10px] leading-snug text-bone-faint">
              Overrides the lens default. Set back to 100 to hand control back.
            </p>
          </div>

          {isolated && (
            <div className="mt-3 border-t border-white/[0.07] pt-3">
              <p className="instrument-sm mb-1.5">Isolated system</p>
              <button
                type="button"
                onClick={() => isolate(null)}
                className="btn w-full justify-between"
              >
                <span className="truncate">{isolated.replace(/-/g, ' ')}</span>
                <span aria-hidden>×</span>
              </button>
            </div>
          )}

          <div className="mt-3 flex gap-1 border-t border-white/[0.07] pt-3">
            <button
              type="button"
              onClick={() => rig.overview()}
              className="btn flex-1 px-2"
            >
              Reset view
            </button>
            <button
              type="button"
              onClick={() => rig.enterBrain()}
              className="btn flex-1 px-2"
              title="Move the camera inside the cortical shell"
            >
              Go inside
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

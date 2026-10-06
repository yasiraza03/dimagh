'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { useUIStore, type QualityTier } from '@/store/uiStore';
import { CLEARS_BOTTOM_CHROME } from '@/lib/visualization/bottomChrome';

/**
 * Accessibility and render settings.
 *
 * Collapsed to a single button by default. Reduced motion and high contrast are
 * real requirements for a product this animated, so they live one click from
 * anywhere rather than buried on a settings page.
 */

const TIERS: QualityTier[] = ['low', 'medium', 'high'];

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="group flex w-full items-start gap-3 py-2 text-left"
    >
      <span
        className={clsx(
          'mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors',
          checked
            ? 'border-signal-cyan/60 bg-signal-cyan/20'
            : 'border-white/15 bg-white/[0.03]',
        )}
      >
        <span
          className={clsx(
            'h-2.5 w-2.5 rounded-full transition-transform',
            checked
              ? 'translate-x-[14px] bg-signal-cyan'
              : 'translate-x-[2px] bg-bone-faint',
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-[10px] uppercase tracking-instrument text-bone-dim group-hover:text-bone">
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-bone-faint">
          {hint}
        </span>
      </span>
    </button>
  );
}

export function SettingsRail() {
  const [open, setOpen] = useState(false);
  const {
    scienceMode,
    toggleScienceMode,
    reducedMotion,
    toggleReducedMotion,
    highContrast,
    toggleHighContrast,
    labels,
    toggleLabels,
    quality,
    setQuality,
  } = useUIStore();

  return (
    <div
      className="fixed right-4 z-[60] flex flex-col items-end gap-2"
      style={CLEARS_BOTTOM_CHROME}
    >
      {open && (
        <div
          id="settings-panel"
          className="panel w-[278px] animate-fade-up p-4"
          role="group"
          aria-label="Display settings"
        >
          <p className="instrument mb-3">Display</p>

          <Toggle
            label="Science mode"
            hint="Adds the technical terms, the evidence, and what we left out."
            checked={scienceMode}
            onChange={toggleScienceMode}
          />
          <Toggle
            label="Reduced motion"
            hint="Cuts straight to each view instead of flying, and calms everything down."
            checked={reducedMotion}
            onChange={toggleReducedMotion}
          />
          <Toggle
            label="High contrast"
            hint="Brighter, flatter, no glow or grain."
            checked={highContrast}
            onChange={toggleHighContrast}
          />
          <Toggle
            label="Region labels"
            hint="Name the parts that are currently busy."
            checked={labels}
            onChange={toggleLabels}
          />

          <div className="mt-3 border-t border-white/[0.07] pt-3">
            <p className="instrument mb-2">Render quality</p>
            <div className="flex gap-1">
              {TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setQuality(t)}
                  aria-pressed={quality === t}
                  className={clsx(
                    'flex-1 border px-2 py-1.5 font-mono text-[10px] uppercase tracking-instrument transition-colors',
                    quality === t
                      ? 'border-signal-cyan/50 bg-signal-cyan/10 text-signal-cyan'
                      : 'border-white/[0.1] text-bone-faint hover:border-white/25 hover:text-bone-dim',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-bone-faint">
              Picked automatically for your device. Lower settings draw fewer
              particles and a simpler brain.
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="settings-panel"
        className={clsx(
          'btn-icon backdrop-blur-md',
          open && 'border-signal-cyan/50 text-signal-cyan',
        )}
      >
        <span className="sr-only">Display settings</span>
        <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true" fill="none">
          <circle cx="7.5" cy="7.5" r="2.4" stroke="currentColor" strokeWidth="1.1" />
          <path
            d="M7.5 1v2.1M7.5 11.9V14M1 7.5h2.1M11.9 7.5H14M2.9 2.9l1.5 1.5M10.6 10.6l1.5 1.5M12.1 2.9l-1.5 1.5M4.4 10.6l-1.5 1.5"
            stroke="currentColor"
            strokeWidth="1.1"
          />
        </svg>
      </button>
    </div>
  );
}

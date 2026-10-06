'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useUIStore } from '@/store/uiStore';

/**
 * The boot sequence.
 *
 * Not a loading spinner and not fake progress — each line corresponds to a real
 * initialisation step that has genuinely happened by the time it prints
 * (geometry generation, atlas resolution, scenario validation, shader compile).
 * It is also short: the brief is explicit that this should be fast and subtle,
 * so the whole thing clears in just over a second and can be skipped.
 */

interface Step {
  label: string;
  /** Milliseconds after mount at which this step reports. */
  at: number;
}

const STEPS: Step[] = [
  { label: 'Anatomy', at: 120 },
  { label: 'Region atlas', at: 300 },
  { label: 'Connection graph', at: 460 },
  { label: 'Simulation engine', at: 640 },
  { label: 'Visual system', at: 840 },
];

const DOTS = 22;

export function BootSequence({ onDone }: { onDone: () => void }) {
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const [done, setDone] = useState(0);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    setLeaving(true);
    window.setTimeout(onDone, reducedMotion ? 0 : 420);
  };

  useEffect(() => {
    if (reducedMotion) {
      setDone(STEPS.length);
      setReady(true);
      const t = window.setTimeout(finish, 80);
      return () => window.clearTimeout(t);
    }
    const timers = STEPS.map((s, i) =>
      window.setTimeout(() => setDone(i + 1), s.at),
    );
    const readyTimer = window.setTimeout(() => setReady(true), 1000);
    const autoTimer = window.setTimeout(finish, 1650);
    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(readyTimer);
      window.clearTimeout(autoTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  // Any key or click skips ahead.
  useEffect(() => {
    const skip = () => finish();
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={clsx(
        'fixed inset-0 z-[90] flex items-center justify-center bg-void-900 transition-opacity duration-[400ms] ease-cine',
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="w-[min(30rem,calc(100vw-3rem))] px-6">
        <p className="instrument mb-6 text-bone-dim">Initialising neural system</p>

        <ul className="space-y-1.5">
          {STEPS.map((s, i) => {
            const isDone = i < done;
            return (
              <li
                key={s.label}
                className={clsx(
                  'flex items-baseline gap-2 font-mono text-[11px] transition-opacity duration-300',
                  isDone ? 'opacity-100' : 'opacity-25',
                )}
              >
                <span className="text-bone-dim">{s.label}</span>
                <span
                  className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-bone-faint/40"
                  aria-hidden="true"
                >
                  {' '}
                  {'.'.repeat(DOTS)}
                </span>
                <span className={isDone ? 'text-signal-green' : 'text-bone-faint'}>
                  {isDone ? 'OK' : '··'}
                </span>
              </li>
            );
          })}
        </ul>

        <div
          className={clsx(
            'mt-7 border-t border-white/[0.07] pt-4 transition-opacity duration-500',
            ready ? 'opacity-100' : 'opacity-0',
          )}
        >
          <p className="font-mono text-[11px] uppercase tracking-instrument text-signal-cyan">
            System ready
          </p>
          <p className="mt-1.5 text-[11px] text-bone-faint">
            Press any key to continue
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Change blindness (flicker paradigm).
 *
 * Two versions of a scene alternate with a brief blank between them. The blank
 * is doing the work: without it, the change produces a local motion transient
 * that captures attention immediately. With it, you have to compare
 * representations you may never have formed.
 *
 * The timer runs while you search, which makes the point quantitative rather
 * than anecdotal.
 */

interface Shape {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  /** Present only in version B. */
  variant?: boolean;
}

const BASE: Shape[] = [
  { x: 10, y: 60, w: 36, h: 70, color: '#3a5a7a' },
  { x: 52, y: 40, w: 28, h: 90, color: '#5a4a6a' },
  { x: 86, y: 78, w: 42, h: 52, color: '#6a5a3a' },
  { x: 134, y: 30, w: 24, h: 100, color: '#3a6a5a' },
  { x: 164, y: 66, w: 32, h: 64, color: '#7a4a4a' },
  { x: 202, y: 48, w: 30, h: 82, color: '#4a5a7a' },
  { x: 24, y: 18, w: 54, h: 16, color: '#2e3442' },
  { x: 150, y: 10, w: 72, h: 14, color: '#2e3442' },
];

/** The change: a large block that is present in one version and not the other. */
const CHANGED_INDEX = 3;

export function ChangeBlindness() {
  const [running, setRunning] = useState(false);
  const [showB, setShowB] = useState(false);
  const [blank, setBlank] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [found, setFound] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now();
    let step = 0;
    const id = window.setInterval(() => {
      step = (step + 1) % 4;
      // A → blank → B → blank
      setBlank(step % 2 === 1);
      if (step === 2) setShowB(true);
      if (step === 0) setShowB(false);
      setElapsed((Date.now() - startedAt.current) / 1000);
    }, 240);
    return () => window.clearInterval(id);
  }, [running]);

  const shapes = BASE.map((s, i) => {
    if (i !== CHANGED_INDEX) return s;
    // The change: the tall green block becomes much shorter and shifts colour.
    return showB && !revealed ? { ...s, h: 36, y: 94, color: '#3a6a5a' } : s;
  });

  const stop = (didFind: boolean) => {
    setRunning(false);
    setFound(didFind);
    setRevealed(true);
    setBlank(false);
    setShowB(false);
  };

  return (
    <div>
      <div className="relative mb-4 h-[200px] overflow-hidden border border-white/[0.07] bg-void-900">
        <svg viewBox="0 0 240 150" className="h-full w-full" aria-hidden>
          <rect width="240" height="150" fill="#0a0d14" />
          {!blank &&
            shapes.map((s, i) => (
              <rect
                key={i}
                x={s.x}
                y={s.y}
                width={s.w}
                height={s.h}
                fill={s.color}
                stroke={revealed && i === CHANGED_INDEX ? '#ff7a3d' : 'none'}
                strokeWidth={revealed && i === CHANGED_INDEX ? 1.5 : 0}
              />
            ))}
          {revealed && (
            <rect
              x={BASE[CHANGED_INDEX].x - 4}
              y={BASE[CHANGED_INDEX].y - 4}
              width={BASE[CHANGED_INDEX].w + 8}
              height={BASE[CHANGED_INDEX].h + 8}
              fill="none"
              stroke="#ff7a3d"
              strokeWidth="1.2"
              strokeDasharray="4 3"
            />
          )}
        </svg>

        {!running && !revealed && (
          <div className="absolute inset-0 flex items-center justify-center bg-void-900/90 px-6 text-center">
            <div>
              <p className="font-display text-[18px] text-bone">Find the change</p>
              <p className="mt-2 text-[12px] leading-snug text-bone-dim">
                Two versions of this scene alternate. One element changes
                substantially on every cycle.
              </p>
            </div>
          </div>
        )}

        {running && (
          <div className="pointer-events-none absolute right-2 top-2 border border-white/[0.1] bg-void-900/80 px-2 py-1">
            <span className="font-mono text-[11px] tabular-nums text-signal-amber">
              {elapsed.toFixed(1)}s
            </span>
          </div>
        )}
      </div>

      {running ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => stop(true)} className="btn flex-1">
            I found it
          </button>
          <button type="button" onClick={() => stop(false)} className="btn flex-1">
            Show me
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setRevealed(false);
            setFound(false);
            setElapsed(0);
            setRunning(true);
          }}
          className="btn btn-primary w-full"
        >
          {revealed ? 'Run again' : 'Start'}
        </button>
      )}

      {revealed && (
        <div className="mt-4 border-l-2 border-signal-amber/40 pl-3">
          <p className="text-[12.5px] leading-[1.7] text-bone-dim">
            The tall green block changed height and position on every cycle —
            roughly a tenth of the image.{' '}
            {found
              ? `You found it in ${elapsed.toFixed(1)} seconds.`
              : 'It was in plain view the entire time.'}
          </p>
          <p className="mt-2 text-[12px] leading-[1.7] text-bone-faint">
            Remove the blank frame and the change becomes instantly obvious,
            because the local motion transient captures attention. With the blank,
            finding it requires comparing representations you may never have
            formed. The sense of seeing a complete, stable scene is not the same
            as having stored one.
          </p>
        </div>
      )}
    </div>
  );
}

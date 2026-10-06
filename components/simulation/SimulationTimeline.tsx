'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { clock } from '@/lib/simulation/clock';
import { useClock } from '@/lib/simulation/useClock';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import { rig } from '@/lib/visualization/cameraRig';
import { Timecode } from '@/components/ui/primitives';
import type { Scenario, ScenarioEvent } from '@/lib/simulation/types';

/**
 * The scenario timeline.
 *
 * Scrubbing works because the engine is a pure function of time — there is no
 * integrated state to rewind, so dropping the playhead anywhere produces
 * exactly the state the timeline says it should, forwards or backwards.
 *
 * Events are markers; clicking one seeks to it and sends the camera where that
 * event wants it.
 */

interface Props {
  scenario: Scenario;
  onEventFocus?: (ev: ScenarioEvent) => void;
}

const KIND_COLOR: Record<string, string> = {
  forward: PALETTE_HEX.cyan,
  feedback: PALETTE_HEX.violet,
  modulatory: PALETTE_HEX.amber,
  burst: PALETTE_HEX.threat,
  loop: PALETTE_HEX.green,
};

export function SimulationTimeline({ scenario, onEventFocus }: Props) {
  const { time, duration, gated } = useClock();
  const trackRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ ev: ScenarioEvent; x: number } | null>(null);
  const dragging = useRef(false);

  const pct = duration > 0 ? (time / duration) * 100 : 0;

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const t = ((clientX - rect.left) / rect.width) * clock.duration;
      clock.seek(t);
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      clock.pause();
      seekFromClientX(e.clientX);
    },
    [seekFromClientX],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      seekFromClientX(e.clientX);
    },
    [seekFromClientX],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 1 : 0.2;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        clock.seek(clock.time - step);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        clock.seek(clock.time + step);
      } else if (e.key === 'Home') {
        e.preventDefault();
        clock.seek(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        clock.seek(clock.duration);
      }
    },
    [],
  );

  const gatePct = useMemo(
    () => (scenario.choices ? (scenario.choices.at / scenario.duration) * 100 : null),
    [scenario],
  );

  const jump = (ev: ScenarioEvent) => {
    clock.seek(ev.time);
    if (ev.camera) rig.apply(ev.camera);
    else if (ev.target) rig.focusRegion(ev.target);
    onEventFocus?.(ev);
  };

  return (
    <div className="select-none">
      {/*
        Stages as an evenly spaced chip row, not labels positioned by time.
        Positioning them by time packed seven labels into thirteen seconds and
        they overlapped into an unreadable smear. The track below already shows
        *when* each stage starts; this row is for reading the structure and
        jumping between parts, so it is laid out for legibility instead.
      */}
      <div
        className="mb-2.5 flex gap-1 overflow-x-auto pb-0.5 no-scrollbar"
        role="group"
        aria-label="Scenario stages"
      >
        {scenario.stages.map((s, i) => {
          const next = scenario.stages[i + 1];
          const isCurrent = time >= s.time && (!next || time < next.time);
          const passed = time >= s.time;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => clock.seek(s.time)}
              aria-current={isCurrent ? 'step' : undefined}
              title={`Jump to ${s.label} — ${s.time.toFixed(1)}s`}
              className={clsx(
                'flex shrink-0 items-center gap-1.5 border px-2 py-1 font-mono text-[9px] uppercase tracking-instrument transition-colors',
                isCurrent
                  ? 'border-white/30 bg-white/[0.06] text-bone'
                  : passed
                    ? 'border-white/[0.1] text-bone-dim hover:border-white/25'
                    : 'border-white/[0.06] text-bone-faint hover:border-white/20',
              )}
            >
              <span
                className="h-1 w-1 shrink-0 rounded-full transition-colors"
                style={{
                  background: passed
                    ? PALETTE_HEX[scenario.accent]
                    : 'rgba(255,255,255,0.2)',
                }}
                aria-hidden
              />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Timecode t={time} className="w-[52px] shrink-0 text-[10px] text-bone-dim" />

        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Scenario timeline"
          aria-valuemin={0}
          aria-valuemax={Number(duration.toFixed(2))}
          aria-valuenow={Number(time.toFixed(2))}
          aria-valuetext={`${time.toFixed(1)} of ${duration.toFixed(1)} seconds`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={onKeyDown}
          className="group relative h-9 flex-1 cursor-pointer touch-none"
        >
          {/* Track */}
          <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-white/[0.09]" />

          {/* Elapsed */}
          <div
            className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 transition-[width] duration-75"
            style={{ width: `${pct}%`, background: PALETTE_HEX[scenario.accent] }}
          />

          {/* Choice gate */}
          {gatePct != null && (
            <div
              className="absolute top-1/2 h-4 w-[1px] -translate-y-1/2"
              style={{
                left: `${gatePct}%`,
                background: gated ? PALETTE_HEX.amber : 'rgba(255,255,255,0.3)',
              }}
              aria-hidden
            />
          )}

          {/* Event markers */}
          {scenario.events.map((ev) => {
            const left = (ev.time / scenario.duration) * 100;
            const passed = time >= ev.time;
            const color = KIND_COLOR[ev.kind ?? 'forward'];
            return (
              <button
                key={ev.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  jump(ev);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseEnter={() => setHover({ ev, x: left })}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover({ ev, x: left })}
                onBlur={() => setHover(null)}
                aria-label={`${ev.title}, ${ev.time.toFixed(1)} seconds`}
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${left}%` }}
              >
                <span
                  className={clsx(
                    'mx-auto block transition-all duration-200',
                    ev.causal ? 'h-[9px] w-[9px]' : 'h-[5px] w-[5px]',
                  )}
                  style={{
                    background: passed ? color : 'rgba(255,255,255,0.22)',
                    transform: hover?.ev.id === ev.id ? 'scale(1.5)' : undefined,
                  }}
                />
              </button>
            );
          })}

          {/* Playhead */}
          <div
            className="pointer-events-none absolute top-1/2 h-5 w-[1.5px] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pct}%`, background: '#fff' }}
          >
            <span
              className="absolute -top-[3px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white"
              aria-hidden
            />
          </div>

          {/* Marker tooltip */}
          {hover && (
            <div
              className="pointer-events-none absolute bottom-full z-20 mb-1 -translate-x-1/2 whitespace-nowrap
                         border border-white/[0.1] bg-void-900/95 px-2 py-1 backdrop-blur-sm"
              style={{
                left: `${hover.x}%`,
                // Keep the tooltip inside the track at the extremes.
                transform:
                  hover.x > 88
                    ? 'translateX(-90%)'
                    : hover.x < 12
                      ? 'translateX(-10%)'
                      : 'translateX(-50%)',
              }}
            >
              <span className="block font-mono text-[9px] uppercase tracking-instrument text-bone">
                {hover.ev.title}
              </span>
              <Timecode
                t={hover.ev.time}
                className="mt-0.5 block text-[9px] text-bone-faint"
              />
            </div>
          )}
        </div>

        <span className="w-[52px] shrink-0 text-right font-mono text-[10px] tabular-nums text-bone-faint">
          {duration.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import clsx from 'clsx';
import { clock } from '@/lib/simulation/clock';
import { useClock } from '@/lib/simulation/useClock';
import { eventAt, nextEvent, prevEvent } from '@/lib/simulation/engine';
import { rig } from '@/lib/visualization/cameraRig';
import { useSimStore } from '@/store/simulationStore';
import type { Scenario } from '@/lib/simulation/types';

/**
 * Transport controls.
 *
 * Play, pause, step by event, scrub speed, reverse, replay and follow-the-signal
 * — plus keyboard shortcuts, because a timeline you can only operate with a
 * mouse is not really a scientific instrument.
 */

const RATES = [0.25, 0.5, 1, 2] as const;

function Icon({ name }: { name: string }) {
  const common = { stroke: 'currentColor', strokeWidth: 1.2, fill: 'none' } as const;
  switch (name) {
    case 'play':
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M3 1.5l7 4.5-7 4.5z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'pause':
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M3.5 1.5v9M8.5 1.5v9" {...common} strokeWidth={1.6} />
        </svg>
      );
    case 'prev':
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M9.5 2L4.5 6l5 4zM2.5 2v8" {...common} />
        </svg>
      );
    case 'next':
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M2.5 2l5 4-5 4zM9.5 2v8" {...common} />
        </svg>
      );
    case 'replay':
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M10 6a4 4 0 11-1.3-2.95M10 1v2.6H7.4" {...common} />
        </svg>
      );
    case 'reverse':
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M2 6a4 4 0 101.3-2.95M2 1v2.6h2.6" {...common} />
        </svg>
      );
    case 'follow':
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <circle cx="6" cy="6" r="2" {...common} />
          <path d="M6 0.5v2M6 9.5v2M0.5 6h2M9.5 6h2" {...common} />
        </svg>
      );
    default:
      return null;
  }
}

export function SimulationControls({ scenario }: { scenario: Scenario }) {
  const { playing, rate, time, gated, completed } = useClock();
  const current = eventAt(scenario, time);
  const followSignal = useSimStore((s) => s.followSignal);
  const toggleFollow = useSimStore((s) => s.toggleFollowSignal);

  const stepTo = (dir: 1 | -1) => {
    const ev = dir === 1 ? nextEvent(scenario, time) : prevEvent(scenario, time);
    if (!ev) {
      clock.seek(dir === 1 ? clock.duration : 0);
      return;
    }
    clock.seek(ev.time);
    if (ev.camera) rig.apply(ev.camera);
    else if (ev.target) rig.focusRegion(ev.target);
  };

  // Keyboard transport. Skipped while the user is typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el as HTMLElement | null)?.isContentEditable
      ) {
        return;
      }
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          clock.toggle();
          break;
        case 'j':
          e.preventDefault();
          stepTo(-1);
          break;
        case 'l':
          e.preventDefault();
          stepTo(1);
          break;
        case 'r':
          e.preventDefault();
          clock.seek(0);
          clock.forward();
          clock.play();
          break;
        case 'f':
          e.preventDefault();
          toggleFollow();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, time, toggleFollow]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => stepTo(-1)}
        className="btn-icon"
        title="Previous event (J)"
      >
        <span className="sr-only">Previous event</span>
        <Icon name="prev" />
      </button>

      {/* The primary control carries a word as well as a glyph: a row of
          unlabelled icons is not something a first-time visitor can read. */}
      <button
        type="button"
        onClick={() => {
          if (completed && !playing) {
            clock.seek(0);
            clock.forward();
          }
          clock.toggle();
        }}
        disabled={gated}
        className={clsx(
          'inline-flex h-10 items-center justify-center gap-2 border px-3 font-mono text-[10px] uppercase tracking-instrument transition-colors sm:px-4',
          gated
            ? 'border-white/[0.12] text-bone-faint opacity-50'
            : 'border-white/25 bg-white/[0.04] text-bone hover:border-white/45 hover:bg-white/[0.08]',
        )}
        title={gated ? 'Make a choice to continue' : 'Play / pause (Space)'}
      >
        <Icon name={playing ? 'pause' : 'play'} />
        <span className="hidden sm:inline">
          {gated ? 'Choose' : playing ? 'Pause' : completed ? 'Replay' : 'Play'}
        </span>
        <span className="sm:sr-only">{playing ? 'Pause' : 'Play'}</span>
      </button>

      <button
        type="button"
        onClick={() => stepTo(1)}
        className="btn-icon"
        title="Next event (L)"
      >
        <span className="sr-only">Next event</span>
        <Icon name="next" />
      </button>

      <div className="mx-1 h-6 w-px bg-white/[0.08]" aria-hidden />

      <button
        type="button"
        onClick={() => {
          clock.seek(0);
          clock.forward();
          clock.play();
        }}
        className="btn-icon"
        title="Replay from the start (R)"
      >
        <span className="sr-only">Replay</span>
        <Icon name="replay" />
      </button>

      <button
        type="button"
        onClick={() => {
          if (rate < 0) clock.forward();
          else clock.reverse();
        }}
        aria-pressed={rate < 0}
        className={clsx('btn-icon', rate < 0 && 'border-signal-violet/60 text-signal-violet')}
        title="Play backwards — trace the cascade in reverse"
      >
        <span className="sr-only">Reverse</span>
        <Icon name="reverse" />
      </button>

      <button
        type="button"
        onClick={toggleFollow}
        aria-pressed={followSignal}
        className={clsx(
          'btn-icon',
          followSignal && 'border-signal-cyan/60 text-signal-cyan',
        )}
        title="Follow the travelling signal with the camera (F)"
      >
        <span className="sr-only">Follow signal</span>
        <Icon name="follow" />
      </button>

      {/* Where you are, in words. Without this the transport is a row of
          glyphs and a number, and the timeline carries all of the meaning. */}
      <p className="ml-1 hidden min-w-0 flex-1 items-baseline gap-2 truncate lg:flex">
        <span className="instrument-sm shrink-0">Now</span>
        <span className="truncate text-[12px] text-bone-dim">
          {gated
            ? 'Waiting for your decision'
            : (current?.title ?? 'Ready — press play')}
        </span>
      </p>

      <div className="ml-auto flex items-center gap-1 lg:ml-0">
        <span className="instrument-sm mr-1 hidden sm:inline">Speed</span>
        {RATES.map((r) => {
          const active = Math.abs(rate) === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => clock.setRate(rate < 0 ? -r : r)}
              aria-pressed={active}
              className={clsx(
                'border px-1.5 py-1 font-mono text-[9.5px] tabular-nums transition-colors',
                active
                  ? 'border-white/30 bg-white/[0.06] text-bone'
                  : 'border-white/[0.09] text-bone-faint hover:border-white/20',
              )}
            >
              {r}×
            </button>
          );
        })}
      </div>

      <p className="hidden w-full shrink-0 font-mono text-[9px] uppercase tracking-wider2 text-bone-faint/70 xl:block xl:w-auto">
        <span className="mx-2 hidden xl:inline">·</span>
        Space play · J/L step · R replay · F follow
      </p>
    </div>
  );
}

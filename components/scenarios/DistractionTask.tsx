'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useSimStore } from '@/store/simulationStore';
import { Meter } from '@/components/ui/primitives';

/**
 * The reading-under-interruption task.
 *
 * The passage is the task; the notifications are real interruptions that arrive
 * on a schedule set by the distraction dial. The three bars are a conceptual
 * model that responds to what you actually do — dismissing a notification costs
 * attentional priority and leaves a residue that decays, so the cost of the
 * interruption outlasts the interruption.
 */

const PASSAGE = [
  'Reading is not a passive intake of text.',
  'Each fixation lands for roughly a fifth of a second, and in that time your visual system samples a few characters sharply and the rest only coarsely.',
  'Meanwhile a model of the sentence is being assembled and held — actively, by circuitry that is also being asked to hold your place, your goal, and whatever you were about to do next.',
  'Nothing writes that model down. It exists only as long as something keeps it alive.',
  'Which is why losing it costs more than the seconds you looked away.',
];

const NOTIFICATIONS = [
  'New message from Sam',
  '3 new mentions',
  'Your order has shipped',
  'Reminder: 15:00',
  'Someone replied to your comment',
  'Battery below 20%',
];

interface Toast {
  id: number;
  text: string;
  born: number;
}

export function DistractionTask() {
  const params = useSimStore((s) => s.params);
  const [running, setRunning] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dismissed, setDismissed] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);

  // Conceptual model state, updated on a timer rather than per frame.
  const model = useRef({ primary: 1, distractor: 0, priority: 1, residue: 0 });
  const [view, setView] = useState({ primary: 1, distractor: 0, priority: 1 });
  const nextId = useRef(1);

  const reset = useCallback(() => {
    setToasts([]);
    setDismissed(0);
    setLineIndex(0);
    model.current = { primary: 1, distractor: 0, priority: 1, residue: 0 };
    setView({ primary: 1, distractor: 0, priority: 1 });
  }, []);

  useEffect(() => {
    if (!running) return;

    // Notifications arrive more often as the distraction dial rises.
    const interval = 4200 - params.distraction * 3000;
    const spawn = window.setInterval(() => {
      setToasts((prev) => [
        ...prev.slice(-2),
        {
          id: nextId.current++,
          text: NOTIFICATIONS[Math.floor(Math.random() * NOTIFICATIONS.length)],
          born: Date.now(),
        },
      ]);
      model.current.distractor = Math.min(1, model.current.distractor + 0.45);
    }, Math.max(1200, interval));

    // Advance the reading position, slowed by competing demand.
    const read = window.setInterval(() => {
      setLineIndex((i) => (i + 1) % PASSAGE.length);
    }, 5200 + params.difficulty * 2500);

    const tick = window.setInterval(() => {
      const m = model.current;
      // Distraction decays; priority is what is left after it and the residue.
      m.distractor = Math.max(0, m.distractor - 0.055);
      m.residue = Math.max(0, m.residue - 0.02);
      const competing = m.distractor * (0.5 + params.distraction * 0.5) + m.residue * 0.6;
      m.priority = Math.max(0.05, 1 - competing);
      m.primary = Math.max(0.1, m.priority * (1 - params.memoryLoad * 0.3));
      setView({ primary: m.primary, distractor: m.distractor, priority: m.priority });
    }, 140);

    return () => {
      window.clearInterval(spawn);
      window.clearInterval(read);
      window.clearInterval(tick);
    };
  }, [running, params.distraction, params.difficulty, params.memoryLoad]);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    setDismissed((d) => d + 1);
    // Dealing with it is the expensive part: a switch, plus residue afterwards.
    model.current.residue = Math.min(1, model.current.residue + 0.5);
    model.current.distractor = Math.max(0, model.current.distractor - 0.3);
  };

  return (
    <div className="p-4">
      <div className="relative mb-3 h-[150px] overflow-hidden border border-white/[0.06] bg-void-900 p-3">
        <p className="instrument-sm mb-2">Primary task — read this</p>
        <p
          className="text-[12.5px] leading-[1.65] transition-opacity duration-300"
          style={{ opacity: 0.35 + view.primary * 0.65 }}
        >
          {PASSAGE[lineIndex]}
        </p>

        {/* Interruptions. */}
        <div className="pointer-events-none absolute inset-x-2 bottom-2 space-y-1.5">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto flex animate-fade-up items-center gap-2 border
                         border-signal-amber/35 bg-void-800/95 px-2.5 py-1.5 backdrop-blur-sm"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal-amber" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[11px] text-bone-dim">
                {t.text}
              </span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 font-mono text-[9px] uppercase tracking-instrument
                           text-bone-faint transition-colors hover:text-bone"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>

        {!running && (
          <div className="absolute inset-0 flex items-center justify-center bg-void-900/85">
            <button
              type="button"
              onClick={() => {
                reset();
                setRunning(true);
              }}
              className="btn btn-primary"
            >
              Start reading
            </button>
          </div>
        )}
      </div>

      <div className="space-y-0.5">
        <Meter
          label="Primary task"
          value={view.primary}
          accent="cyan"
          compact
        />
        <Meter
          label="Distractor"
          value={view.distractor}
          accent="amber"
          compact
        />
        <Meter
          label="Attentional priority"
          value={view.priority}
          accent="green"
          compact
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="instrument-sm">
          Interruptions handled — {dismissed}
        </span>
        {running && (
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              reset();
            }}
            className={clsx('btn px-3 py-1.5')}
          >
            Stop
          </button>
        )}
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-bone-faint">
        These bars are a <strong>conceptual model</strong> responding to your
        actions and to the Lab dials — not a measurement of your attention.
        Notice that dismissing a notification lowers priority for longer than the
        notification was on screen: that lingering cost is the residue.
      </p>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clock } from '@/lib/simulation/clock';
import { useSimStore } from '@/store/simulationStore';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import { Meter } from '@/components/ui/primitives';

/**
 * The reaching task.
 *
 * Click a target and a simulated reach is generated: a planned trajectory,
 * signal-dependent noise injected into the command, delayed feedback, and a
 * correction loop that only sees the error after a lag.
 *
 * Both paths are drawn — what the plan specified, and what the arm actually did.
 * Turning the noise dial up makes the correction loop visibly earn its keep, and
 * turning correction off (by starving the loop) makes the endpoint scatter.
 *
 * This is a small control model written for this page, not a biomechanical
 * simulation. The science panel says so.
 */

interface Point {
  x: number;
  y: number;
}

interface Trial {
  planned: Point[];
  actual: Point[];
  target: Point;
  error: number;
  corrections: number;
}

/** Feedback delay, in simulation steps. This is why prediction is needed. */
const FEEDBACK_LAG = 7;
const STEPS = 64;

function simulateReach(
  start: Point,
  target: Point,
  noise: number,
  correctionGain: number,
): Trial {
  const planned: Point[] = [];
  const actual: Point[] = [];
  let pos = { ...start };
  let vel = { x: 0, y: 0 };
  let corrections = 0;

  // Deterministic-ish noise so repeated trials differ but stay plausible.
  const rnd = () => (Math.random() - 0.5) * 2;

  for (let i = 0; i < STEPS; i++) {
    const t = i / (STEPS - 1);
    // Minimum-jerk-ish planned trajectory.
    const s = 10 * t ** 3 - 15 * t ** 4 + 6 * t ** 5;
    planned.push({
      x: start.x + (target.x - start.x) * s,
      y: start.y + (target.y - start.y) * s,
    });

    // The command aims at the planned position, using delayed feedback about
    // where the limb actually is.
    const seen = actual[Math.max(0, i - FEEDBACK_LAG)] ?? pos;
    const desired = planned[i];
    const errX = desired.x - seen.x;
    const errY = desired.y - seen.y;
    if (Math.hypot(errX, errY) > 2) corrections++;

    const cmdX = errX * (0.18 + correctionGain * 0.22);
    const cmdY = errY * (0.18 + correctionGain * 0.22);

    // Signal-dependent noise: bigger commands are noisier. This is where the
    // speed/accuracy trade-off comes from.
    const mag = Math.hypot(cmdX, cmdY);
    const n = noise * (0.6 + mag * 0.5);

    vel.x = vel.x * 0.62 + cmdX + rnd() * n;
    vel.y = vel.y * 0.62 + cmdY + rnd() * n;
    pos = { x: pos.x + vel.x, y: pos.y + vel.y };
    actual.push({ ...pos });
  }

  const last = actual[actual.length - 1];
  return {
    planned,
    actual,
    target,
    error: Math.hypot(last.x - target.x, last.y - target.y),
    corrections,
  };
}

export function MovementTask() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const params = useSimStore((s) => s.params);
  const [trial, setTrial] = useState<Trial | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [target, setTarget] = useState<Point>({ x: 148, y: 44 });

  const noise = params.sensoryNoise * 2.6 + params.difficulty * 0.9;
  const correctionGain = params.attention;

  const run = useCallback(
    (tx: number, ty: number) => {
      const t = simulateReach({ x: 18, y: 112 }, { x: tx, y: ty }, noise, correctionGain);
      setTrial(t);
      setTarget({ x: tx, y: ty });
      setHistory((h) => [...h.slice(-11), t.error]);
      clock.seek(0);
      clock.play();
    },
    [noise, correctionGain],
  );

  // Draw whenever the trial or the canvas size changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const render = () => {
      const rect = canvas.getBoundingClientRect();
      // A collapsed panel, a hidden tab or a layout pass before first paint
      // all report a zero-sized canvas. Sizing a canvas to 0 and then reading
      // it back throws, so bail until there is something to draw into.
      if (rect.width < 1 || rect.height < 1) return;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The model works in a fixed 180×140 space; scale it to the element.
      const sx = rect.width / 180;
      const sy = rect.height / 140;
      ctx.scale(sx, sy);

      ctx.clearRect(0, 0, 180, 140);
      ctx.fillStyle = '#07090f';
      ctx.fillRect(0, 0, 180, 140);

      // Start marker.
      ctx.strokeStyle = '#3a4152';
      ctx.lineWidth = 1 / Math.max(sx, sy);
      ctx.beginPath();
      ctx.arc(18, 112, 4, 0, Math.PI * 2);
      ctx.stroke();

      // Target.
      ctx.strokeStyle = PALETTE_HEX.cyan;
      ctx.lineWidth = 1.2 / Math.max(sx, sy);
      ctx.beginPath();
      ctx.arc(target.x, target.y, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `${PALETTE_HEX.cyan}33`;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 7, 0, Math.PI * 2);
      ctx.fill();

      if (trial) {
        // Planned path.
        ctx.strokeStyle = 'rgba(242,237,228,0.22)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        trial.planned.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
        ctx.setLineDash([]);

        // Actual path.
        ctx.strokeStyle = PALETTE_HEX.orange;
        ctx.lineWidth = 1.6 / Math.max(sx, sy);
        ctx.beginPath();
        trial.actual.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();

        // Endpoint.
        const last = trial.actual[trial.actual.length - 1];
        ctx.fillStyle = PALETTE_HEX.orange;
        ctx.beginPath();
        ctx.arc(last.x, last.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [trial, target]);

  const meanError =
    history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0;

  return (
    <div className="p-4">
      <div
        className="relative mb-3 h-[150px] cursor-crosshair overflow-hidden border border-white/[0.06]"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 180;
          const y = ((e.clientY - rect.top) / rect.height) * 140;
          run(Math.max(24, Math.min(172, x)), Math.max(10, Math.min(126, y)));
        }}
      >
        <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
        {!trial && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="instrument">Click anywhere to set a target</p>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-1.5 left-2 flex gap-3">
          <span className="font-mono text-[8px] uppercase tracking-wider2 text-bone-faint">
            — — planned
          </span>
          <span className="font-mono text-[8px] uppercase tracking-wider2 text-signal-orange">
            —— executed
          </span>
        </div>
      </div>

      {trial && (
        <div className="mb-3 space-y-0.5">
          <Meter
            label="Endpoint error"
            value={Math.min(1, trial.error / 30)}
            accent="orange"
            compact
          />
          <Meter
            label="Corrections applied"
            value={Math.min(1, trial.corrections / STEPS)}
            accent="green"
            compact
          />
          <p className="mt-1.5 text-[10.5px] text-bone-faint">
            {trial.error < 4
              ? 'The correction loop absorbed the noise. You experience one smooth reach.'
              : trial.error < 12
                ? 'Correction kept up, but not completely — the executed path wandered off the plan and came back.'
                : 'Noise exceeded what the delayed feedback loop could correct in time. The endpoint missed.'}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="instrument-sm">
          {history.length > 0
            ? `${history.length} trials · mean error ${meanError.toFixed(1)}`
            : 'no trials yet'}
        </span>
        <button
          type="button"
          onClick={() => run(target.x, target.y)}
          className="btn px-3 py-1.5"
        >
          Repeat
        </button>
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-bone-faint">
        A small control model written for this page: a planned trajectory,
        signal-dependent noise, a {FEEDBACK_LAG}-step feedback delay and a
        correction gain. Raise <strong>sensory noise</strong> in the Lab tab and
        the executed path degrades; raise <strong>attention</strong> and the
        correction loop pulls it back. Neither dial corresponds to a measurable
        quantity in anyone&rsquo;s motor system.
      </p>
    </div>
  );
}

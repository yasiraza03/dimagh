'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clock } from '@/lib/simulation/clock';
import { useSimStore } from '@/store/simulationStore';
import { PALETTE_HEX } from '@/lib/visualization/palette';

/**
 * The evidence accumulator.
 *
 * A small drift-diffusion model: two options with values close enough that
 * noise matters, evidence integrated to a collapsing bound, and the decision
 * taken at the crossing. Running it repeatedly on the *same* inputs is the
 * point — the choice is not always the same, and the reaction time distribution
 * is wide.
 *
 * This is a random walk written for this page, not a model of neural
 * populations.
 */

interface Run {
  trace: number[];
  bound: number[];
  choice: 'a' | 'b';
  steps: number;
}

const MAX_STEPS = 140;

function simulate(valueGap: number, noise: number, threshold: number): Run {
  const trace: number[] = [0];
  const bound: number[] = [];
  let x = 0;
  let choice: 'a' | 'b' = 'a';
  let steps = MAX_STEPS;

  for (let i = 0; i < MAX_STEPS; i++) {
    // Urgency: the bound collapses, so a decision is always eventually made.
    const b = threshold * (1 - (i / MAX_STEPS) * 0.55);
    bound.push(b);

    x += valueGap * 0.02 + (Math.random() - 0.5) * noise;
    trace.push(x);

    if (Math.abs(x) >= b) {
      choice = x > 0 ? 'a' : 'b';
      steps = i;
      break;
    }
    if (i === MAX_STEPS - 1) choice = x > 0 ? 'a' : 'b';
  }
  // Pad the bound so the chart draws the full width.
  while (bound.length < trace.length) {
    bound.push(bound[bound.length - 1] ?? threshold);
  }
  return { trace, bound, choice, steps };
}

export function DecisionTask() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const params = useSimStore((s) => s.params);
  const [run, setRun] = useState<Run | null>(null);
  const [tally, setTally] = useState({ a: 0, b: 0 });
  const [times, setTimes] = useState<number[]>([]);

  // Difficulty narrows the value gap; attention raises the threshold (more
  // careful); noise widens the walk.
  const valueGap = (1 - params.difficulty) * 1.4;
  const noise = 0.09 + params.sensoryNoise * 0.22;
  const threshold = 0.6 + params.attention * 0.85;

  const go = useCallback(() => {
    const r = simulate(valueGap, noise, threshold);
    setRun(r);
    setTally((t) => ({ ...t, [r.choice]: t[r.choice] + 1 }));
    setTimes((t) => [...t.slice(-23), r.steps]);
    clock.seek(4);
    clock.play();
  }, [valueGap, noise, threshold]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      // A collapsed panel, a hidden tab or a layout pass before first paint
      // all report a zero-sized canvas. Sizing a canvas to 0 and then reading
      // it back throws, so bail until there is something to draw into.
      if (rect.width < 1 || rect.height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = rect.width;
      const h = rect.height;
      const mid = h / 2;
      const scale = (h / 2 - 8) / Math.max(threshold, 0.1);

      ctx.fillStyle = '#07090f';
      ctx.fillRect(0, 0, w, h);

      // Midline.
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();

      const n = run?.trace.length ?? MAX_STEPS;
      const stepW = w / MAX_STEPS;

      // Collapsing bounds.
      ctx.strokeStyle = `${PALETTE_HEX.amber}66`;
      ctx.setLineDash([3, 3]);
      for (const sign of [1, -1]) {
        ctx.beginPath();
        for (let i = 0; i < MAX_STEPS; i++) {
          const b = threshold * (1 - (i / MAX_STEPS) * 0.55);
          const y = mid - sign * b * scale;
          if (i === 0) ctx.moveTo(0, y);
          else ctx.lineTo(i * stepW, y);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Option labels.
      ctx.fillStyle = 'rgba(242,237,228,0.4)';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText('OPTION A', 6, 12);
      ctx.fillText('OPTION B', 6, h - 5);

      if (run) {
        ctx.strokeStyle = PALETTE_HEX.amber;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        run.trace.forEach((v, i) => {
          const x = i * stepW;
          const y = mid - v * scale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Crossing marker.
        const last = run.trace[run.trace.length - 1];
        ctx.fillStyle = run.choice === 'a' ? PALETTE_HEX.green : PALETTE_HEX.violet;
        ctx.beginPath();
        ctx.arc((n - 1) * stepW, mid - last * scale, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [run, threshold]);

  const total = tally.a + tally.b;
  const meanRt = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const rtSpread = times.length > 1 ? Math.max(...times) - Math.min(...times) : 0;

  return (
    <div className="p-4">
      <div className="relative mb-3 h-[150px] overflow-hidden border border-white/[0.06]">
        <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
        {!run && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="instrument">Run a trial</p>
          </div>
        )}
        <p className="pointer-events-none absolute bottom-1.5 right-2 font-mono text-[8px] uppercase tracking-wider2 text-signal-amber">
          — — collapsing bound
        </p>
      </div>

      {run && (
        <p className="mb-3 text-[11.5px] leading-[1.6] text-bone-dim">
          Crossed at step <strong className="text-bone">{run.steps}</strong> —{' '}
          <strong className="text-bone">Option {run.choice.toUpperCase()}</strong>.
          {run.steps > MAX_STEPS * 0.8
            ? ' Close to the deadline: the bound had collapsed far enough that weak evidence was enough.'
            : run.steps < MAX_STEPS * 0.25
              ? ' Fast — the evidence was decisive early.'
              : ' A typical trial.'}
        </p>
      )}

      {total > 0 && (
        <div className="mb-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-[62px] shrink-0 font-mono text-[9px] uppercase tracking-wider2 text-bone-faint">
              Choices
            </span>
            <span className="flex h-[4px] flex-1 overflow-hidden bg-white/[0.07]">
              <span
                className="block h-full transition-[width] duration-300"
                style={{ width: `${(tally.a / total) * 100}%`, background: PALETTE_HEX.green }}
              />
              <span
                className="block h-full transition-[width] duration-300"
                style={{ width: `${(tally.b / total) * 100}%`, background: PALETTE_HEX.violet }}
              />
            </span>
            <span className="w-[42px] shrink-0 text-right font-mono text-[9px] tabular-nums text-bone-faint">
              {tally.a}/{tally.b}
            </span>
          </div>
          <p className="text-[10.5px] text-bone-faint">
            {total} identical trials · mean {meanRt.toFixed(0)} steps · spread{' '}
            {rtSpread} steps
          </p>
        </div>
      )}

      <button type="button" onClick={go} className="btn btn-primary w-full">
        Run a trial
      </button>

      {total >= 6 && (
        <p className="mt-3 border-l-2 border-signal-amber/40 pl-3 text-[11.5px] leading-[1.6] text-bone-dim">
          Same options, same parameters, {total} runs — and not the same answer
          every time, with reaction times spread across {rtSpread} steps. When the
          options are close, noise in the accumulation is doing the choosing.
        </p>
      )}

      <p className="mt-3 text-[10.5px] leading-relaxed text-bone-faint">
        A random walk to a collapsing bound, written for this page. Lower{' '}
        <strong>task difficulty</strong> widens the value gap, <strong>sensory
        noise</strong> widens the walk, and <strong>attention</strong> raises the
        threshold — slower and more consistent. Steps are model iterations, not
        milliseconds.
      </p>
    </div>
  );
}

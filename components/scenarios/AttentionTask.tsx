'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useSimStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import { PALETTE_HEX } from '@/lib/visualization/palette';

/**
 * The visual attention laboratory.
 *
 * A real counting task, with a real unexpected event, and a real answer you
 * commit to before the reveal — which is the only way the inattentional
 * blindness point lands. The surprise is a genuinely conspicuous object that
 * crosses the display for several seconds while you are busy counting.
 *
 * The lab dials feed into the simulation: distraction adds distractors,
 * difficulty speeds everything up, attention narrows the rendered spotlight.
 */

type Phase = 'brief' | 'running' | 'answer' | 'reveal';

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  blue: boolean;
  salient: boolean;
}

const SURPRISE_START = 0.42;
const SURPRISE_END = 0.72;

export function AttentionTask() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('brief');
  const [guess, setGuess] = useState('');
  const [noticed, setNoticed] = useState<boolean | null>(null);
  const truth = useRef(0);
  const params = useSimStore((s) => s.params);
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  const state = useRef<{ dots: Dot[]; t: number; duration: number }>({
    dots: [],
    t: 0,
    duration: 11,
  });

  const start = useCallback(() => {
    const { distraction, difficulty, attention } = params;
    const blueCount = 4 + Math.round(Math.random() * 4);
    const distractors = 7 + Math.round(distraction * 10);
    truth.current = blueCount;

    const dots: Dot[] = [];
    const push = (blue: boolean) => {
      const speed = 0.045 + difficulty * 0.085;
      const a = Math.random() * Math.PI * 2;
      dots.push({
        x: 0.1 + Math.random() * 0.8,
        y: 0.12 + Math.random() * 0.76,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: 3.4 + Math.random() * 2.2,
        blue,
        salient: !blue && Math.random() < 0.25,
      });
    };
    for (let i = 0; i < blueCount; i++) push(true);
    for (let i = 0; i < distractors; i++) push(false);

    state.current = {
      dots,
      t: 0,
      duration: 11 - attention * 2,
    };
    setGuess('');
    setNoticed(null);
    setPhase('running');
  }, [params]);

  useEffect(() => {
    if (phase !== 'running') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      // Keep a non-zero size: a collapsed panel reports 0 and every draw call
      // below would then be operating on an empty surface.
      if (rect.width < 1 || rect.height < 1) return rect;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return rect;
    };
    let rect = fit();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;

      const s = state.current;
      s.t += dt;
      if (s.t >= s.duration) {
        cancelAnimationFrame(raf);
        setPhase('answer');
        return;
      }

      const w = rect.width;
      const h = rect.height;
      if (w < 1 || h < 1) return;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#07090f';
      ctx.fillRect(0, 0, w, h);

      // The attention spotlight: a soft field whose radius narrows as the
      // attention dial rises. Labelled in the UI as a conceptual device.
      const spotR = (0.46 - params.attention * 0.2) * Math.min(w, h);
      const cx = w * 0.5;
      const cy = h * 0.5;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, spotR);
      grad.addColorStop(0, 'rgba(79,216,232,0.075)');
      grad.addColorStop(1, 'rgba(79,216,232,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (const d of s.dots) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.x < 0.04 || d.x > 0.96) d.vx *= -1;
        if (d.y < 0.05 || d.y > 0.95) d.vy *= -1;
        d.x = Math.max(0.04, Math.min(0.96, d.x));
        d.y = Math.max(0.05, Math.min(0.95, d.y));

        const px = d.x * w;
        const py = d.y * h;

        // Salience: how much this item is weighted, visualised as a halo. The
        // weighting is higher near the spotlight centre and for salient items.
        const dist = Math.hypot(px - cx, py - cy) / spotR;
        const weight = Math.max(0, 1 - dist) * (d.salient ? 1.3 : 1);

        if (weight > 0.05) {
          ctx.globalAlpha = weight * 0.3;
          ctx.fillStyle = d.blue ? PALETTE_HEX.blue : PALETTE_HEX.bone;
          ctx.beginPath();
          ctx.arc(px, py, d.r * 2.6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.fillStyle = d.blue ? PALETTE_HEX.blue : '#4d5363';
        ctx.beginPath();
        ctx.arc(px, py, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // The unexpected event: a large, high-contrast object crossing the scene.
      const p = s.t / s.duration;
      if (p > SURPRISE_START && p < SURPRISE_END) {
        const local = (p - SURPRISE_START) / (SURPRISE_END - SURPRISE_START);
        const x = -0.1 + local * 1.2;
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = PALETTE_HEX.orange;
        ctx.beginPath();
        // A chunky triangle — unmistakable if you are looking at it.
        const px = x * w;
        const py = h * 0.74;
        ctx.moveTo(px, py - 13);
        ctx.lineTo(px + 13, py + 9);
        ctx.lineTo(px - 13, py + 9);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Progress rule.
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(0, h - 2, w, 2);
      ctx.fillStyle = PALETTE_HEX.blue;
      ctx.fillRect(0, h - 2, w * p, 2);
    };

    const ro = new ResizeObserver(() => {
      rect = fit();
    });
    ro.observe(canvas);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [phase, params.attention]);

  const correct = Number(guess) === truth.current;

  return (
    <div className="p-4">
      <div className="relative mb-3 h-[150px] overflow-hidden border border-white/[0.06] bg-void-900">
        {phase === 'running' ? (
          <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center">
            {phase === 'brief' && (
              <div>
                <p className="font-display text-[19px] text-bone">Count the blue objects</p>
                <p className="mt-2 text-[11.5px] leading-snug text-bone-dim">
                  Keep a running count. Do not lose it.
                </p>
              </div>
            )}
            {phase === 'answer' && (
              <div className="w-full">
                <p className="instrument mb-2">How many were blue?</p>
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    className="w-20 border border-white/15 bg-void-800 px-2 py-1.5 text-center
                               font-mono text-[14px] text-bone focus:border-signal-cyan focus:outline-none"
                    aria-label="Number of blue objects"
                  />
                  <button
                    type="button"
                    onClick={() => setPhase('reveal')}
                    disabled={guess === ''}
                    className="btn btn-primary"
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}
            {phase === 'reveal' && (
              <div className="w-full">
                <p className="instrument mb-2">Did you notice it?</p>
                <p className="mb-3 text-[11.5px] leading-snug text-bone-dim">
                  Something large and orange crossed the display while you were
                  counting.
                </p>
                <div className="flex justify-center gap-2">
                  {noticed === null ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setNoticed(true)}
                        className="btn"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoticed(false)}
                        className="btn"
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <p
                      className={clsx(
                        'font-mono text-[11px] uppercase tracking-instrument',
                        noticed ? 'text-signal-green' : 'text-signal-amber',
                      )}
                    >
                      {noticed ? 'You caught it' : 'Most people miss it'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {phase === 'reveal' && (
        <div className="mb-3 border border-white/[0.07] p-3">
          <p className="instrument-sm mb-1.5">Result</p>
          <p className="text-[12px] text-bone-dim">
            There were <strong className="text-bone">{truth.current}</strong> blue
            objects. You said {guess || '—'}.{' '}
            {correct ? 'Correct.' : 'Close enough — the count is not the point.'}
          </p>
          {noticed !== null && (
            <p className="mt-2 text-[11.5px] leading-[1.6] text-bone-faint">
              {noticed
                ? 'Noticing it usually costs you accuracy on the count. Both tasks were drawing on the same limited selection process.'
                : 'The orange object was rendered at full contrast for several seconds. It was processed — it just never won the competition for the systems that would let you report it. Concentrating harder would have made this more likely, not less.'}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={start} className="btn flex-1">
          {phase === 'brief' ? 'Start the task' : 'Run again'}
        </button>
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-bone-faint">
        The spotlight and the halos are a <strong>conceptual model</strong> of
        attentional weighting drawn for this page, not a measurement. Adjust the
        dials in the Lab tab and the task genuinely changes:
        {reducedMotion ? ' motion is reduced for your display setting.' : ' distraction adds distractors, difficulty speeds them up, attention narrows the field.'}
      </p>
    </div>
  );
}

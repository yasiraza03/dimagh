'use client';

import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store/uiStore';

/**
 * Motion aftereffect.
 *
 * Twenty seconds of expanding radial motion, then a hard cut to a stationary
 * pattern. The adaptation phase is timed and the transition is instantaneous,
 * because a fade would let the adapted populations recover before you look.
 *
 * Skipped entirely under reduced-motion, with an explanation rather than a
 * silently broken experiment.
 */

const ADAPT_SECONDS = 20;

export function MotionAftereffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'ready' | 'adapting' | 'test'>('ready');
  const [left, setLeft] = useState(ADAPT_SECONDS);
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    let last = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
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
      if (phase === 'adapting') t += dt;

      const w = rect.width;
      const h = rect.height;
      if (w < 1 || h < 1) return;
      const cx = w / 2;
      const cy = h / 2;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, w, h);

      // Concentric rings, expanding during adaptation and frozen during test.
      const maxR = Math.hypot(w, h) / 2;
      const spacing = 22;
      const offset = phase === 'adapting' ? (t * 26) % spacing : 0;
      for (let r = maxR; r > 0; r -= spacing) {
        const rr = r - offset;
        if (rr <= 0) continue;
        const idx = Math.round(rr / spacing);
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.fillStyle = idx % 2 === 0 ? '#1d222e' : '#aeb6c6';
        ctx.fill();
      }

      // Fixation point — essential, and the instruction people most often skip.
      ctx.fillStyle = '#ff3b4e';
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
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
  }, [phase]);

  useEffect(() => {
    if (phase !== 'adapting') return;
    setLeft(ADAPT_SECONDS);
    const id = window.setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          window.clearInterval(id);
          setPhase('test');
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  if (reducedMotion) {
    return (
      <div className="border border-white/[0.07] bg-void-900 p-5">
        <p className="instrument mb-2 text-signal-amber">Skipped</p>
        <p className="prose-sci">
          This demonstration requires twenty seconds of sustained, fairly strong
          visual motion, which is exactly what reduced-motion is for. It is
          disabled while that setting is on.
        </p>
        <p className="mt-3 text-[12px] leading-[1.7] text-bone-faint">
          The finding: after prolonged motion in one direction, a stationary
          pattern appears to drift the other way. Direction-selective populations
          adapt, perceived motion depends on the balance between them, and an
          unbalanced reading of a static image is motion.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-4 h-[200px] overflow-hidden border border-white/[0.07]">
        <canvas ref={canvasRef} className="h-full w-full" aria-hidden />

        {phase === 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center bg-void-900/90 px-6 text-center">
            <div>
              <p className="font-display text-[18px] text-bone">
                Fixate the red dot for {ADAPT_SECONDS} seconds
              </p>
              <p className="mt-2 text-[12px] leading-snug text-bone-dim">
                Do not move your eyes. The pattern will stop on its own.
              </p>
            </div>
          </div>
        )}

        {phase === 'adapting' && (
          <div className="pointer-events-none absolute right-2 top-2 border border-white/[0.1] bg-void-900/80 px-2 py-1">
            <span className="font-mono text-[11px] tabular-nums text-signal-cyan">
              {left}s
            </span>
          </div>
        )}

        {phase === 'test' && (
          <div className="pointer-events-none absolute left-2 top-2 border border-signal-amber/40 bg-void-900/80 px-2 py-1">
            <span className="font-mono text-[9px] uppercase tracking-wider2 text-signal-amber">
              completely static
            </span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setPhase(phase === 'adapting' ? 'test' : 'adapting')}
        className="btn btn-primary w-full"
      >
        {phase === 'ready'
          ? 'Begin adaptation'
          : phase === 'adapting'
            ? 'Stop now'
            : 'Run it again'}
      </button>

      {phase === 'test' && (
        <div className="mt-4 border-l-2 border-signal-blue/40 pl-3">
          <p className="text-[12.5px] leading-[1.7] text-bone-dim">
            The pattern above is <strong className="text-bone">completely
            static</strong> — no pixel is changing. If it appears to contract, that
            motion is being generated inside you.
          </p>
          <p className="mt-2 text-[12px] leading-[1.7] text-bone-faint">
            It usually fades within a few seconds. Perceived motion depends on the
            relative activity of populations tuned to opposite directions;
            adaptation reduced one side, and the resulting imbalance reads as
            movement where there is none.
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { clock } from '@/lib/simulation/clock';
import { useSimStore } from '@/store/simulationStore';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import { Meter } from '@/components/ui/primitives';

/**
 * The prediction demonstration.
 *
 * One degraded image, two contexts. The pixels never change; the caption does.
 * Then the image is revealed, and after that it is permanently legible — which
 * is the strongest version of the point, because you can feel the prior update
 * and you cannot undo it.
 *
 * The figure is drawn as a two-tone silhouette and then destroyed with
 * block-threshold noise, the classic degradation that makes an image
 * unrecognisable without a prior and obvious with one.
 */

type Context = 'none' | 'a' | 'b';

const CONTEXTS: Record<Context, { label: string; prior: string }> = {
  none: { label: 'No context', prior: 'No expectation to work with. The evidence alone underdetermines it.' },
  a: { label: 'Context A — "a face"', prior: 'You are now looking for eyes and a mouth. Notice how fast candidate features appear.' },
  b: { label: 'Context B — "a landscape"', prior: 'The same patches now read as horizon and terrain. Identical input, reorganised.' },
};

/**
 * Draws a simple face silhouette, then degrades it by averaging into blocks and
 * thresholding — removing most of the information while leaving enough for a
 * prior to work with.
 */
function drawDegraded(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  noise: number,
  revealed: boolean,
) {
  // getImageData throws on a zero-sized source, which happens whenever this
  // panel is collapsed or measured before layout has settled.
  if (w < 1 || h < 1) return;

  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const o = off.getContext('2d');
  if (!o) return;

  o.fillStyle = '#000';
  o.fillRect(0, 0, w, h);
  o.fillStyle = '#fff';

  // Head.
  o.beginPath();
  o.ellipse(w * 0.5, h * 0.52, w * 0.21, h * 0.3, 0, 0, Math.PI * 2);
  o.fill();
  // Neck and shoulders.
  o.beginPath();
  o.moveTo(w * 0.38, h * 0.78);
  o.lineTo(w * 0.62, h * 0.78);
  o.lineTo(w * 0.78, h);
  o.lineTo(w * 0.22, h);
  o.closePath();
  o.fill();
  // Eyes and mouth, cut out.
  o.fillStyle = '#000';
  o.beginPath();
  o.ellipse(w * 0.43, h * 0.47, w * 0.035, h * 0.03, 0, 0, Math.PI * 2);
  o.fill();
  o.beginPath();
  o.ellipse(w * 0.57, h * 0.47, w * 0.035, h * 0.03, 0, 0, Math.PI * 2);
  o.fill();
  o.fillRect(w * 0.45, h * 0.63, w * 0.1, h * 0.022);

  if (revealed) {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(off, 0, 0);
    return;
  }

  // Block-average and threshold.
  const block = Math.max(4, Math.round(4 + noise * 11));
  const img = o.getImageData(0, 0, w, h);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#07090f';
  ctx.fillRect(0, 0, w, h);

  for (let by = 0; by < h; by += block) {
    for (let bx = 0; bx < w; bx += block) {
      let sum = 0;
      let n = 0;
      for (let y = by; y < Math.min(by + block, h); y += 2) {
        for (let x = bx; x < Math.min(bx + block, w); x += 2) {
          sum += img.data[(y * w + x) * 4];
          n++;
        }
      }
      const mean = n ? sum / n / 255 : 0;
      // Threshold with a noise term: this is what destroys the information.
      const jitter = (Math.random() - 0.5) * noise * 0.85;
      const on = mean + jitter > 0.45;
      // High contrast on purpose: this blocky image is the entire point of
      // the demonstration, and it has to be legible at panel size.
      ctx.fillStyle = on ? '#e8ecf2' : '#0b0e14';
      ctx.fillRect(bx, by, block - 1, block - 1);
    }
  }
}

export function PredictionTask() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const params = useSimStore((s) => s.params);
  const [context, setContext] = useState<Context>('none');
  const [revealed, setRevealed] = useState(false);
  const [seenOnce, setSeenOnce] = useState(false);

  const noise = 0.35 + params.sensoryNoise * 0.95;

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
      drawDegraded(ctx, rect.width, rect.height, noise, revealed);
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [noise, revealed]);

  // Evidence and prior always sum to the whole percept — that is the model.
  const evidenceWeight = Math.max(0.08, 1 - noise * 0.72);
  const priorWeight = 1 - evidenceWeight;

  return (
    <div className="p-4">
      <div className="relative mb-3 h-[176px] overflow-hidden border border-white/[0.12] bg-void-900">
        <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
        <p className="pointer-events-none absolute bottom-1.5 left-2 bg-void-900/80 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-wider2 text-bone-dim">
          {revealed ? 'undegraded' : `sensory evidence · noise ${Math.round(noise * 100)}`}
        </p>
      </div>

      <div className="mb-3 flex gap-1">
        {(Object.keys(CONTEXTS) as Context[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setContext(c);
              clock.seek(2.5);
              clock.play();
            }}
            aria-pressed={context === c}
            className={clsx(
              'flex-1 border px-1.5 py-1.5 font-mono text-[8.5px] uppercase tracking-instrument transition-colors',
              context === c
                ? 'border-signal-violet/50 bg-signal-violet/[0.1] text-signal-violet'
                : 'border-white/[0.09] text-bone-faint hover:border-white/25',
            )}
          >
            {c === 'none' ? 'None' : c === 'a' ? 'A · face' : 'B · landscape'}
          </button>
        ))}
      </div>

      <p className="text-[11.5px] leading-[1.6] text-bone-dim">
        {CONTEXTS[context].prior}
      </p>

      <div className="mt-3 space-y-0.5">
        <Meter
          label="Weight on sensory evidence"
          value={evidenceWeight}
          accent="cyan"
          compact
        />
        <Meter
          label="Weight on prior expectation"
          value={priorWeight}
          accent="violet"
          compact
        />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setRevealed((v) => !v);
            setSeenOnce(true);
            clock.seek(8.5);
            clock.play();
          }}
          className="btn flex-1"
        >
          {revealed ? 'Degrade again' : 'Reveal the input'}
        </button>
      </div>

      {seenOnce && (
        <p className="mt-3 border-l-2 border-signal-violet/40 pl-3 text-[11.5px] leading-[1.6] text-bone-dim">
          Now degrade it again. You will almost certainly see it immediately —
          and you cannot choose not to. The prior has been updated, the pixels
          have not, and the change is not easily reversible.
        </p>
      )}

      <p className="mt-3 text-[10.5px] leading-relaxed text-bone-faint">
        The two bars are <strong>parameters of this visualisation</strong>, set by
        the noise dial. They are not quantities measured in a brain. The claim they
        illustrate — that perception combines incoming evidence with prior
        expectation — is well supported; the specific arithmetic here is not.
      </p>
    </div>
  );
}

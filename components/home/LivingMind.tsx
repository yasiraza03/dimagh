'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { renderState } from '@/lib/visualization/renderState';
import { lensState } from '@/lib/visualization/lensState';
import { rig } from '@/lib/visualization/cameraRig';
import { useBrainStore } from '@/store/brainStore';
import { useUIStore } from '@/store/uiStore';

/**
 * The closing sequence.
 *
 * Scroll position drives the whole scene directly: the camera pulls away, the
 * cortical shell dissolves until only the network is left, and every region
 * converges onto one shared rhythm so the brain reads as a single pulsing
 * object rather than a set of parts.
 *
 * Driven from a rAF loop reading getBoundingClientRect rather than from scroll
 * events into React state, so none of it causes a re-render.
 */

const LINES = [
  { big: 'Billions of cells.', small: 'On the order of 86 billion neurons, and at least as many non-neuronal cells.' },
  { big: 'Trillions of connections.', small: 'Estimates of synapse count run into the hundreds of trillions. Nobody has counted them.' },
  { big: 'One continuous experience.', small: 'Which is the part no one can yet explain.' },
];

export function LivingMind() {
  const ref = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(-1);
  const setLens = useBrainStore((s) => s.setLens);
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const engaged = useRef(false);

  useEffect(() => {
    let raf = 0;
    let lastStage = -1;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 as the section's top reaches the bottom of the viewport,
      // 1 once its bottom has risen to the top.
      const total = rect.height + vh;
      const progress = Math.max(0, Math.min(1, (vh - rect.top) / total));

      if (progress <= 0.001) {
        if (engaged.current) {
          engaged.current = false;
          renderState.finale = 0;
          lensState.shellOverride = null;
          setLens('activity');
        }
        if (lastStage !== -1) {
          lastStage = -1;
          setStage(-1);
        }
        return;
      }

      if (!engaged.current) {
        engaged.current = true;
        setLens('network');
      }

      // Ease so the dramatic part of the move happens in the middle.
      const e = progress * progress * (3 - 2 * progress);

      renderState.finale = Math.max(0, (e - 0.35) / 0.65);
      lensState.shellOverride = 0.22 * (1 - e) + 0.015;

      if (!reducedMotion) {
        rig.goal.radius = 2.55 + e * 2.6;
        rig.goal.phi = 1.2 - e * 0.14;
        // Recentre as it pulls away: the closing shot is the whole brain, so
        // any hero-era framing offset has to be unwound.
        rig.goal.tx += (0 - rig.goal.tx) * 0.06;
        rig.autoOrbit = 0.03 + e * 0.07;
      }

      const next = e < 0.26 ? -1 : e < 0.48 ? 0 : e < 0.68 ? 1 : 2;
      if (next !== lastStage) {
        lastStage = next;
        setStage(next);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      renderState.finale = 0;
      lensState.shellOverride = null;
    };
  }, [setLens, reducedMotion]);

  return (
    <section
      ref={ref}
      className="relative z-10 border-t border-white/[0.07]"
      aria-label="The living mind"
    >
      {/* Tall, so the scroll has room to drive the scene. */}
      <div className="relative h-[260vh]">
        <div className="sticky top-0 flex h-dvh items-center justify-center px-6">
          <div className="w-full max-w-3xl text-center">
            {LINES.map((line, i) => (
              <div
                key={line.big}
                className={clsx(
                  'transition-all duration-700 ease-cine',
                  stage === i
                    ? 'translate-y-0 opacity-100'
                    : 'pointer-events-none absolute inset-x-0 translate-y-3 opacity-0',
                )}
                aria-hidden={stage !== i}
              >
                <p className="display-lg text-bone">{line.big}</p>
                <p className="mx-auto mt-5 max-w-md text-[13px] leading-relaxed text-bone-faint">
                  {line.small}
                </p>
              </div>
            ))}

            {stage === -1 && (
              <p className="instrument">Keep scrolling</p>
            )}
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/[0.07] bg-void-900 px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-[1800px]">
          <h2 className="display-xl text-bone">dimagh</h2>
          <p className="mt-4 font-mono text-[12px] font-medium uppercase tracking-instrument text-bone-dim">
            Inside the living mind
          </p>

          <p className="mt-10 max-w-xl text-balance text-[15px] leading-[1.8] text-bone-dim">
            Everything in this project is a simplified, systems-level model built
            from bundled data and computed in your browser. It is designed to make
            a real argument legible: that perception, memory, attention and action
            are processes with structure — and that almost all of that structure
            runs without you.
          </p>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link href="/experience" className="btn btn-primary">
              Explore another process
            </Link>
            <Link href="/network" className="btn">
              Trace the network
            </Link>
            <Link href="/science" className="btn">
              Open science
            </Link>
            <Link href="/lab" className="btn">
              Enter the lab
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

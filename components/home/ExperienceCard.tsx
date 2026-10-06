'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CardMotif, registerMotif, type MotifKind } from '@/lib/visualization/cardMotif';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import { useUIStore } from '@/store/uiStore';
import type { ExperienceCard as Card } from '@/lib/simulation/scenarios';

/**
 * One experience in the "WHAT HAPPENS WHEN..." grid.
 *
 * The animated motif is paused whenever the card is off-screen, via a shared
 * IntersectionObserver-gated ticker — twelve always-running canvases would be a
 * needless drain on a page whose job is to get you into the simulation.
 */
export function ExperienceCard({ card, index }: { card: Card; index: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motifRef = useRef<CardMotif | null>(null);
  const [hovered, setHovered] = useState(false);
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motif = new CardMotif(
      canvas,
      card.motif as MotifKind,
      PALETTE_HEX[card.accent],
      reducedMotion,
    );
    motifRef.current = motif;
    const unregister = registerMotif(motif);

    const io = new IntersectionObserver(
      ([entry]) => {
        motif.visible = entry.isIntersecting;
      },
      { rootMargin: '120px' },
    );
    io.observe(canvas);

    const ro = new ResizeObserver(() => motif.resize());
    ro.observe(canvas);

    return () => {
      io.disconnect();
      ro.disconnect();
      unregister();
      motif.destroy();
      motifRef.current = null;
    };
  }, [card.motif, card.accent, reducedMotion]);

  useEffect(() => {
    if (motifRef.current) motifRef.current.hovered = hovered;
  }, [hovered]);

  const href = card.stage
    ? `/experience/${card.scenario}?stage=${card.stage}&card=${card.id}`
    : `/experience/${card.scenario}?card=${card.id}`;

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="group relative flex flex-col overflow-hidden border border-white/[0.07]
                 bg-void-800/40 transition-colors duration-300 hover:border-white/20
                 focus-visible:border-signal-cyan"
    >
      <div className="relative h-[86px] w-full overflow-hidden bg-void-900">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
        {/* Fades the motif into the card body so it reads as depth, not a banner. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void-800/80 via-transparent to-transparent" />
        <span
          className="absolute left-3 top-3 font-mono text-[9px] tabular-nums tracking-wider2"
          style={{ color: PALETTE_HEX[card.accent], opacity: 0.8 }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-[18px] font-normal leading-tight tracking-[-0.02em] text-bone">
          {card.verb}
        </h3>
        <p className="mt-2 flex-1 text-[12px] leading-[1.6] text-bone-dim">
          {card.teaser}
        </p>
        <div className="mt-3.5 flex items-center justify-between border-t border-white/[0.06] pt-2.5">
          <span className="instrument-sm">{card.estimate}</span>
          <span
            className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-instrument
                       text-bone-faint transition-colors group-hover:text-bone"
          >
            Run
            <svg
              width="9"
              height="9"
              viewBox="0 0 9 9"
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-0.5"
            >
              <path d="M1 4.5h6.5M5 2l2.5 2.5L5 7" stroke="currentColor" strokeWidth="1.1" fill="none" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

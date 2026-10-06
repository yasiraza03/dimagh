'use client';

import Link from 'next/link';
import { EXPERIENCES } from '@/lib/simulation/scenarios';
import { ExperienceCard } from './ExperienceCard';

/**
 * The experience selector — the product's front door.
 *
 * Sits over the live canvas with a heavy backdrop so the brain is still present
 * behind the grid rather than replaced by it.
 */
export function ExperienceSection() {
  return (
    <section
      id="experiences"
      className="relative z-10 border-t border-white/[0.07] bg-void-900"
    >
      <div className="grid-fine absolute inset-0 opacity-50" aria-hidden />

      <div className="relative mx-auto max-w-[1800px] px-6 py-20 sm:px-10 sm:py-28">
        <p className="instrument mb-6 flex items-center gap-2.5">
          <span className="font-mono text-[10px] text-signal-cyan">01</span>
          Experience
        </p>

        <h2 className="display-xl max-w-4xl text-bone">What happens when…</h2>

        <p className="mt-8 max-w-xl text-balance text-[15px] leading-[1.8] text-bone-dim">
          Each of these plays a simplified model of one process through the brain,
          step by step, with a timeline you can scrub, reverse and interrogate.
          Every animation means something specific — and every claim is labelled by
          how well established it is.
        </p>

        <div className="mt-14 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {EXPERIENCES.map((card, i) => (
            <ExperienceCard key={card.id} card={card} index={i} />
          ))}
        </div>

        <div className="mt-16 flex flex-wrap gap-3 border-t border-white/[0.07] pt-10">
          <Link href="/experiments" className="btn">
            Run an experiment on yourself
          </Link>
          <Link href="/lab" className="btn">
            Change the parameters
          </Link>
          <Link href="/science" className="btn">
            How this is modelled
          </Link>
        </div>
      </div>
    </section>
  );
}

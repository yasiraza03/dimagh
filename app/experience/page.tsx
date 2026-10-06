import type { Metadata } from 'next';
import Link from 'next/link';
import { EXPERIENCES } from '@/lib/simulation/scenarios';
import { ExperienceCard } from '@/components/home/ExperienceCard';
import { Reveal } from '@/components/ui/Reveal';

export const metadata: Metadata = {
  title: 'Experience',
  description:
    'Twelve interactive simulations of what happens inside the brain during perception, attention, memory, emotion, language, movement and sleep.',
};

export default function ExperiencePage() {
  return (
    <div className="relative min-h-dvh pt-14">
      <div className="grid-fine pointer-events-none absolute inset-0 opacity-60" aria-hidden />

      <div className="relative mx-auto max-w-[1800px] px-6 py-16 sm:px-10 sm:py-24">
        <p className="instrument mb-6 flex items-center gap-2.5">
          <span className="font-mono text-[10px] text-signal-cyan">01</span>
          Experience
        </p>

        <h1 className="display-xl max-w-4xl text-bone">What happens when…</h1>

        <p className="mt-8 max-w-2xl text-balance text-[15px] leading-[1.8] text-bone-dim">
          Pick one and watch it happen, step by step, inside a 3D brain. You can
          pause it, drag the timeline, run it backwards, and ask why any step
          happened. Each one comes with something to try yourself, and everything
          we tell you is labelled by how sure we actually are.
        </p>

        <Reveal
          stagger={0.055}
          y={34}
          className="mt-14 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {EXPERIENCES.map((card, i) => (
            <ExperienceCard key={card.id} card={card} index={i} />
          ))}
        </Reveal>

        <Reveal
          stagger={0.1}
          className="mt-16 grid gap-6 border-t border-white/[0.07] pt-10 sm:grid-cols-3"
        >
          <div>
            <p className="instrument mb-2">How to read these</p>
            <p className="text-[12.5px] leading-[1.7] text-bone-dim">
              A part lighting up means it is busy at that moment. The little
              travelling dots are signals moving between parts — and which way
              they go tells you whether information is heading onward or being
              sent back.
            </p>
          </div>
          <div>
            <p className="instrument mb-2">Everything is adjustable</p>
            <p className="text-[12.5px] leading-[1.7] text-bone-dim">
              Six dials — how hard you are concentrating, how much is distracting
              you, how surprising things are, how much you are holding in mind,
              how unclear the input is, and how hard the task is. Change any of
              them and the whole thing plays out differently.
            </p>
          </div>
          <div>
            <p className="instrument mb-2">And everything is labelled</p>
            <p className="text-[12.5px] leading-[1.7] text-bone-dim">
              Turn on Science mode and every claim gets tagged{' '}
              <span className="text-signal-green">known</span>,{' '}
              <span className="text-signal-amber">simplified</span> or{' '}
              <span className="text-signal-violet">conceptual</span> — so you can
              always tell solid fact from useful picture.{' '}
              <Link href="/science" className="underline underline-offset-2 hover:text-bone">
                Read more
              </Link>
              .
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

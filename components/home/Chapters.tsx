'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ensurePlugin, ScrollTrigger } from '@/components/ui/Reveal';
import { lensState } from '@/lib/visualization/lensState';
import { rig } from '@/lib/visualization/cameraRig';
import { renderState } from '@/lib/visualization/renderState';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import { useBrainStore } from '@/store/brainStore';
import { useUIStore } from '@/store/uiStore';
import type { LensMode } from '@/lib/simulation/types';
import type { PaletteKey } from '@/lib/brain/types';

/** See the note in components/ui/Reveal.tsx — hide before paint, not after. */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * The editorial chapters.
 *
 * Four pinned sections where scroll position drives the brain directly: the lens
 * changes, the camera flies to the relevant region, the shell opens up. The
 * typography is the foreground and the brain reacts behind it, which is the
 * difference between a page with a 3D background and a page where the 3D is the
 * subject.
 *
 * Each chapter's camera target is a real region from the atlas, so scrolling
 * through the chapters is also a guided tour of the anatomy.
 */

interface Chapter {
  n: string;
  title: string;
  quote: string;
  body: string;
  lens: LensMode;
  region: string;
  accent: PaletteKey;
  scenario: string;
  cta: string;
}

const CHAPTERS: Chapter[] = [
  {
    n: '01',
    title: 'Perception',
    quote:
      'Before you know what you see, your brain has already begun interpreting it.',
    body: 'Light becomes a signal, the signal becomes fragments, and the fragments become a thing. Then the answer travels back down and changes what you will see next. By the time you are aware of anything, the work is already over.',
    lens: 'activity',
    region: 'v1',
    accent: 'cyan',
    scenario: 'apple-vision',
    cta: 'Watch perception',
  },
  {
    n: '02',
    title: 'Attention',
    quote: 'Selecting a little means discarding a very great deal.',
    body: 'Deciding what to look for changes how your eyes and brain respond before anything appears. The things you miss were not blocked at the door. They were built, they lost, and they were thrown away.',
    lens: 'attention',
    region: 'parietal',
    accent: 'blue',
    scenario: 'attention',
    cta: 'Watch attention',
  },
  {
    n: '03',
    title: 'Memory',
    quote: 'Recall is not playback. It is reconstruction, every single time.',
    body: 'An experience arrives in pieces across a dozen systems and has to be tied together so you can find it later. Getting it back fills the gaps with whatever seems likely — and nothing marks the filled-in parts as filled in.',
    lens: 'memory',
    region: 'hippocampus',
    accent: 'violet',
    scenario: 'memory-recall',
    cta: 'Watch memory',
  },
  {
    n: '04',
    title: 'Prediction',
    quote: 'You do not see what is there. You see your brain’s best guess.',
    body: 'In a lot of places there are more connections running back down than running up. What you see is a mix of what arrived and what you expected — and when the evidence is weak, the expectation does most of the work. It feels identical either way.',
    lens: 'prediction',
    region: 'object_cortex',
    accent: 'violet',
    scenario: 'prediction',
    cta: 'Watch prediction',
  },
];

/** Return shell opacity to the store's value, or to lens control at 100%. */
function releaseShell() {
  const v = useBrainStore.getState().shellOpacity;
  lensState.shellOverride = v >= 0.999 ? null : v;
}

function ChapterPanel({ chapter, index }: { chapter: Chapter; index: number }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const setLens = useBrainStore((s) => s.setLens);
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const accent = PALETTE_HEX[chapter.accent];

  useIsomorphicLayoutEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    if (reducedMotion) {
      // Still reveal the content; just do not drive the camera from scroll.
      gsap.set(el.querySelectorAll('[data-anim]'), { opacity: 1, y: 0 });
      return;
    }

    ensurePlugin();

    const items = el.querySelectorAll('[data-anim]');
    gsap.set(items, { opacity: 0, y: 30 });

    const reveal = gsap.to(items, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      stagger: 0.12,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 62%', once: true },
    });

    // The scene-driving trigger. Entering the chapter changes the lens and
    // sends the camera to its region; scrolling through it opens the shell and
    // drifts the camera closer.
    const scene = ScrollTrigger.create({
      trigger: el,
      start: 'top 70%',
      end: 'bottom 30%',
      onEnter: () => {
        setLens(chapter.lens);
        rig.focusRegion(chapter.region, 2.1, 1.35);
      },
      onEnterBack: () => {
        setLens(chapter.lens);
        rig.focusRegion(chapter.region, 2.1, 1.35);
      },
      onUpdate: (self) => {
        const p = self.progress;
        // Open the cortex as the chapter is read, then close it again.
        const open = Math.sin(p * Math.PI);
        lensState.shellOverride = 0.82 - open * 0.55;
        renderState.finale = 0;
      },
      // Hand control back to whatever owned it before the chapter: either the
      // transparency slider or, at 100%, the lens system.
      onLeave: () => releaseShell(),
      onLeaveBack: () => releaseShell(),
    });

    return () => {
      reveal.scrollTrigger?.kill();
      reveal.kill();
      scene.kill();
    };
  }, [chapter, setLens, reducedMotion]);

  const alignRight = index % 2 === 1;

  return (
    <section
      ref={sectionRef}
      className="relative h-[190vh]"
      aria-labelledby={`chapter-${chapter.n}`}
    >
      <div className="sticky top-0 flex h-dvh items-center px-6 sm:px-10">
        <div
          className={
            alignRight
              ? 'mx-auto w-full max-w-[1800px] flex justify-end'
              : 'mx-auto w-full max-w-[1800px]'
          }
        >
          <div className="max-w-lg">
            <p
              data-anim
              className="font-mono text-[11px] font-normal tracking-instrument"
              style={{ color: accent }}
            >
              {chapter.n}
            </p>

            <h2
              id={`chapter-${chapter.n}`}
              data-anim
              className="display-lg mt-4 text-bone"
            >
              {chapter.title}
            </h2>

            <p
              data-anim
              className="mt-7 border-l-2 pl-5 text-[16px] font-light leading-[1.55] text-bone sm:text-[18px]"
              style={{ borderColor: `${accent}66` }}
            >
              {chapter.quote}
            </p>

            <p
              data-anim
              className="mt-6 text-[14px] leading-[1.85] text-bone-dim"
            >
              {chapter.body}
            </p>

            <div data-anim className="mt-8 flex flex-wrap gap-2.5">
              <Link
                href={`/experience/${chapter.scenario}`}
                className="btn"
                style={{ borderColor: `${accent}55`, color: accent }}
              >
                {chapter.cta}
              </Link>
              <Link href="/brain" className="btn">
                Inspect the region
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Chapters() {
  return (
    <div className="relative z-10">
      {/* A hairline divider that also marks the start of the chaptered read. */}
      <div className="relative z-10 border-t border-white/[0.07] bg-void-900/80">
        <div className="mx-auto flex max-w-[1800px] items-baseline gap-4 px-6 py-5 sm:px-10">
          <span className="instrument">Four processes</span>
          <span className="h-px flex-1 bg-white/[0.07]" aria-hidden />
          <span className="instrument-sm">Scroll</span>
        </div>
      </div>

      {CHAPTERS.map((c, i) => (
        <ChapterPanel key={c.n} chapter={c} index={i} />
      ))}
    </div>
  );
}

'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ILLUSIONS, type Illusion } from '@/lib/simulation/scenarios';
import { REGION_BY_ID } from '@/lib/brain/atlas';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import { rig } from '@/lib/visualization/cameraRig';
import { useBrainStore } from '@/store/brainStore';
import { Reveal, useScrollSystem } from '@/components/ui/Reveal';

/**
 * The experiment gallery.
 *
 * Every experiment follows the same four-part structure — experience it, what
 * you perceived, what the input actually contained, why the difference matters.
 * That consistency is the teaching device: after two of them you know how to
 * read the third, and the gap between input and percept becomes the thing you
 * are looking for rather than a surprise each time.
 *
 * The experiment surface itself changes completely per illusion, which is what
 * the brief asks for — a slider for Müller-Lyer, a timed adaptation phase for
 * the aftereffect, a two-block reaction-time study for Stroop.
 */

const Placeholder = () => (
  <div className="h-[200px] animate-pulse border border-white/[0.07] bg-void-800/50" />
);

const COMPONENTS: Record<string, React.ComponentType> = {
  MullerLyer: dynamic(() => import('./MullerLyer').then((m) => m.MullerLyer), {
    loading: Placeholder,
  }),
  CheckerShadow: dynamic(() => import('./CheckerShadow').then((m) => m.CheckerShadow), {
    loading: Placeholder,
  }),
  Kanizsa: dynamic(() => import('./Kanizsa').then((m) => m.Kanizsa), {
    loading: Placeholder,
  }),
  ColorContrast: dynamic(() => import('./ColorContrast').then((m) => m.ColorContrast), {
    loading: Placeholder,
  }),
  MotionAftereffect: dynamic(
    () => import('./MotionAftereffect').then((m) => m.MotionAftereffect),
    { loading: Placeholder },
  ),
  ChangeBlindness: dynamic(
    () => import('./ChangeBlindness').then((m) => m.ChangeBlindness),
    { loading: Placeholder },
  ),
  Stroop: dynamic(() => import('./Stroop').then((m) => m.Stroop), {
    loading: Placeholder,
  }),
  McGurk: dynamic(() => import('./McGurk').then((m) => m.McGurk), {
    loading: Placeholder,
  }),
};

const SECTIONS = [
  { id: 'perceived', label: 'What you perceived', key: 'perceived' as const },
  { id: 'actual', label: 'What the input actually contained', key: 'actual' as const },
  { id: 'why', label: 'Why the difference matters', key: 'why' as const },
];

export function ExperimentGallery() {
  const [activeId, setActiveId] = useState(ILLUSIONS[0]?.id ?? '');
  const select = useBrainStore((s) => s.select);
  useScrollSystem();

  const active = useMemo<Illusion | undefined>(
    () => ILLUSIONS.find((i) => i.id === activeId),
    [activeId],
  );

  // Reset the brain store so a leftover selection from another page does not
  // leak into the region links here.
  useEffect(() => {
    select(null);
  }, [select]);

  const Component = active ? COMPONENTS[active.component] : undefined;
  const accent = active ? PALETTE_HEX[active.accent] : PALETTE_HEX.cyan;

  return (
    <div className="relative min-h-dvh pt-14">
      <div className="grid-fine pointer-events-none absolute inset-0 opacity-50" aria-hidden />

      <div className="relative mx-auto max-w-[1800px] px-6 pb-24 pt-14 sm:px-10 sm:pt-20">
        <p className="instrument mb-5 flex items-center gap-2.5">
          <span className="font-mono text-[10px] text-signal-cyan">04</span>
          Experiments
        </p>

        <h1 className="display-xl max-w-4xl text-bone">
          Run it on
          <br />
          yourself.
        </h1>

        <p className="mt-8 max-w-2xl text-balance text-[15px] leading-[1.8] text-bone-dim">
          Eight places where what you see or hear and what is actually there come
          apart — and you can prove it to yourself on this page. None of these is a
          trick. Each one catches your brain doing the guessing it always does, in
          a case where the guess happens to be wrong.
        </p>

        {/* Selector */}
        <div
          className="mt-12 flex gap-2 overflow-x-auto pb-2 no-scrollbar"
          role="tablist"
          aria-label="Experiments"
        >
          {ILLUSIONS.map((ill, i) => {
            const isActive = ill.id === activeId;
            return (
              <button
                key={ill.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveId(ill.id)}
                className={clsx(
                  'group flex min-w-[168px] shrink-0 flex-col items-start border px-3.5 py-3 text-left transition-all duration-200',
                  isActive
                    ? 'border-white/30 bg-white/[0.05]'
                    : 'border-white/[0.07] hover:border-white/20 hover:bg-white/[0.02]',
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span
                    className="font-mono text-[9px] tabular-nums tracking-wider2"
                    style={{ color: isActive ? PALETTE_HEX[ill.accent] : undefined }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    className="h-1.5 w-1.5 rounded-full transition-opacity"
                    style={{
                      background: PALETTE_HEX[ill.accent],
                      opacity: isActive ? 1 : 0.3,
                    }}
                    aria-hidden
                  />
                </span>
                <span
                  className={clsx(
                    'mt-2 font-display text-[14px] font-normal leading-tight',
                    isActive ? 'text-bone' : 'text-bone-dim',
                  )}
                >
                  {ill.name}
                </span>
                <span className="mt-1 font-mono text-[8.5px] uppercase tracking-wider2 text-bone-faint">
                  {ill.kind}
                </span>
              </button>
            );
          })}
        </div>

        {active && (
          <div
            key={active.id}
            className="mt-10 grid animate-fade-up gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
          >
            {/* The experiment surface */}
            <div>
              <div className="mb-5">
                <p
                  className="instrument mb-2"
                  style={{ color: accent }}
                >
                  Experience
                </p>
                <h2 className="display-md font-normal text-bone">{active.tagline}</h2>
                <p className="mt-3 text-[13.5px] leading-[1.7] text-bone-dim">
                  {active.experience}
                </p>
              </div>

              {Component ? <Component /> : <Placeholder />}
            </div>

            {/* The explanation */}
            <div className="lg:pt-1">
              {SECTIONS.map((s) => (
                <Reveal
                  key={s.id}
                  y={18}
                  start="top 92%"
                  className="border-t border-white/[0.07] py-6 first:border-t-0 first:pt-0"
                >
                  <p className="instrument mb-2.5">{s.label}</p>
                  <p className="text-[13.5px] leading-[1.8] text-bone-dim">
                    {active[s.key]}
                  </p>
                </Reveal>
              ))}

              <div className="border-t border-white/[0.07] py-6">
                <p className="instrument mb-2.5">Mechanism</p>
                <p className="text-[13px] leading-[1.75] text-bone-faint">
                  {active.mechanism}
                </p>
              </div>

              <div className="border-t border-white/[0.07] py-6">
                <p className="instrument mb-2.5">Worth knowing</p>
                <p className="text-[13px] leading-[1.75] text-bone-faint">
                  {active.caveat}
                </p>
              </div>

              {/* Regions involved — links straight into the brain viewer. */}
              <div className="border-t border-white/[0.07] py-6">
                <p className="instrument mb-3">Systems involved</p>
                <div className="flex flex-wrap gap-1.5">
                  {active.regions.map((id) => {
                    const r = REGION_BY_ID.get(id);
                    if (!r) return null;
                    return (
                      <Link
                        key={id}
                        href="/brain"
                        onClick={() => {
                          select(id);
                          rig.focusRegion(id);
                        }}
                        className="group flex items-center gap-1.5 border border-white/[0.09] px-2.5 py-1.5
                                   transition-colors hover:border-white/30"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: PALETTE_HEX[r.color] }}
                          aria-hidden
                        />
                        <span className="text-[11.5px] font-medium text-bone-dim group-hover:text-bone">
                          {r.name}
                        </span>
                      </Link>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-bone-faint">
                  Opens the brain viewer with that part selected. These effects
                  really involve whole networks working together — we name the
                  main players to keep it readable.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-20 flex flex-wrap gap-3 border-t border-white/[0.07] pt-10">
          <Link href="/experience" className="btn btn-primary">
            Watch a process instead
          </Link>
          <Link href="/brain" className="btn">
            Open the brain viewer
          </Link>
          <Link href="/science" className="btn">
            How this is modelled
          </Link>
        </div>
      </div>
    </div>
  );
}

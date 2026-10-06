'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import gsap from 'gsap';
import { BrainScene } from '@/components/brain/BrainScene';
import { BootSequence } from './BootSequence';
import { Chapters } from './Chapters';
import { ExperienceSection } from './ExperienceSection';
import { LivingMind } from './LivingMind';
import { lensState } from '@/lib/visualization/lensState';
import { rig } from '@/lib/visualization/cameraRig';
import { useBrainStore } from '@/store/brainStore';
import { useUIStore } from '@/store/uiStore';
import { resetRenderState } from '@/lib/visualization/renderState';
import { useScrollSystem } from '@/components/ui/Reveal';

/**
 * The landing experience.
 *
 * One WebGL canvas persists for the whole page: it starts as a near-invisible
 * silhouette far from the camera, and "entering the mind" flies the camera in
 * while the cortical shell materialises. Doing this inside a single route rather
 * than navigating keeps the canvas alive, so the transition is a continuous
 * camera move instead of a page load.
 *
 * The opacity ramp is tweened on a module-level value, not through React state —
 * a sixty-times-a-second store write would re-render half the tree.
 */

type Phase = 'boot' | 'hero' | 'entering' | 'explore';

export function Landing() {
  const [phase, setPhase] = useState<Phase>('boot');
  const setLens = useBrainStore((s) => s.setLens);
  const reset = useBrainStore((s) => s.reset);
  const setLabels = useUIStore((s) => s.setLabels);
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const enteredRef = useRef(false);

  useScrollSystem();

  // Establish the opening shot: distant, dark, almost nothing visible.
  useEffect(() => {
    reset();
    resetRenderState();
    setLens('anatomy');
    lensState.shellOverride = 0.085;
    // tx is the look-at point, not the subject. Pulling it left swings the
    // brain to the right of frame, clear of the headline.
    rig.snap({ theta: 0.52, phi: 1.24, radius: 4.3, tx: -0.42, ty: 0, tz: 0 });
    rig.autoOrbit = reducedMotion ? 0 : 0.016;
    setLabels(false);
    return () => {
      lensState.shellOverride = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enter = useCallback(() => {
    if (enteredRef.current) return;
    enteredRef.current = true;
    setPhase('entering');

    if (reducedMotion) {
      lensState.shellOverride = null;
      setLens('activity');
      rig.snap({ theta: 0.62, phi: 1.2, radius: 2.45, tx: -0.42 });
      setLabels(true);
      setPhase('explore');
      return;
    }

    // Camera flies forward while the shell materialises around it.
    rig.autoOrbit = 0.034;
    gsap.to(rig.goal, {
      radius: 2.45,
      theta: 0.64,
      phi: 1.18,
      tx: -0.42,
      duration: 2.9,
      ease: 'power2.inOut',
    });

    const shell = { v: 0.085 };
    gsap.to(shell, {
      v: 0.82,
      duration: 2.4,
      delay: 0.25,
      ease: 'power2.out',
      onUpdate: () => {
        lensState.shellOverride = shell.v;
      },
      onComplete: () => {
        // Hand control back to the lens system.
        lensState.shellOverride = null;
      },
    });

    // Internal networks illuminate a beat after the cortex appears.
    window.setTimeout(() => setLens('activity'), 1500);
    window.setTimeout(() => setLabels(true), 2400);
    window.setTimeout(() => setPhase('explore'), 2600);
  }, [reducedMotion, setLens, setLabels]);

  // Enter on Enter/Space while the hero is showing.
  useEffect(() => {
    if (phase !== 'hero') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const el = document.activeElement;
        if (el && el.tagName === 'BUTTON') return; // let the button handle it
        e.preventDefault();
        enter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, enter]);

  const showHero = phase === 'hero' || phase === 'entering';
  const explored = phase === 'explore';

  return (
    <div className={clsx('relative', explored ? 'min-h-dvh' : 'h-dvh overflow-hidden')}>
      {phase === 'boot' && <BootSequence onDone={() => setPhase('hero')} />}

      {/* The persistent scene. Fixed, behind everything, never unmounted. */}
      <div className="fixed inset-0 z-0">
        <BrainScene labels={explored} interactive={false} />
      </div>
      <div className="vignette pointer-events-none fixed inset-0 z-[1]" aria-hidden />

      {/* ---------------- hero ---------------- */}
      <section
        className={clsx(
          // pb clears the fixed disclaimer badge in the bottom-left corner, so
          // the call-to-action can never end up underneath it.
          'relative z-10 flex h-dvh flex-col justify-center px-6 pb-[clamp(5rem,11vh,7rem)] pt-[clamp(3rem,8vh,5rem)] transition-opacity duration-700 ease-cine sm:px-10',
          phase === 'entering' && 'pointer-events-none opacity-0',
        )}
        aria-hidden={!showHero}
      >
        {explored ? (
          /* Once inside, the hero collapses to a quiet title plate so the first
             viewport belongs to the brain rather than to copy. */
          <div className="mx-auto w-full max-w-[1800px] animate-fade-up">
            <p className="instrument mb-6 flex items-center gap-2.5">
              <span className="h-px w-8 bg-signal-cyan/60" />
              dimagh
            </p>
            <h1 className="display-lg max-w-xl text-bone">Inside the living mind</h1>
            <p className="mt-5 max-w-md text-[14.5px] leading-[1.75] text-bone-dim">
              Drag to orbit. Scroll to zoom. Click any region to inspect it — or
              choose a process below and watch it happen.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/brain" className="btn btn-primary">
                Open the brain viewer
              </Link>
              <Link href="/network" className="btn">
                Trace the network
              </Link>
            </div>
            <p className="mt-12 flex items-center gap-2 font-mono text-[10px] uppercase tracking-instrument text-bone-faint">
              <span className="inline-block animate-drift">↓</span>
              Choose a process
            </p>
          </div>
        ) : (
        <div className="mx-auto w-full max-w-[1800px]">
          <div
            className={clsx(
              'max-w-2xl transition-all duration-1000 ease-cine',
              phase === 'boot'
                ? 'translate-y-4 opacity-0'
                : 'translate-y-0 opacity-100',
            )}
          >
            {/*
              Vertical rhythm is in vh, not rem. The hero must fit a short
              laptop screen without scrolling, so every gap shrinks with the
              viewport instead of pushing the call-to-action below the fold.
            */}
            <p className="instrument flex items-center gap-2.5">
              <span className="h-px w-8 bg-signal-cyan/60" />
              dimagh
            </p>

            <h1 className="display-hero mt-[clamp(1rem,3.4vh,2.25rem)] text-bone">
              This is the
              <br />
              human brain.
            </h1>

            <div className="mt-[clamp(1rem,3.4vh,2.25rem)] space-y-0.5 font-mono text-[clamp(11px,1.4vh,12.5px)] leading-relaxed text-bone-faint">
              <p>Not a computer.</p>
              <p>Not a machine.</p>
              <p>Not a collection of isolated parts.</p>
            </div>

            <p className="mt-[clamp(0.9rem,2.6vh,1.75rem)] max-w-md text-balance text-[clamp(13.5px,1.75vh,15.5px)] leading-[1.7] text-bone-dim">
              A living network, constantly filtering, predicting, remembering and
              deciding what matters — most of it finished before you are aware
              anything happened.
            </p>

            <div className="mt-[clamp(1.25rem,4vh,2.75rem)] flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={enter}
                disabled={phase !== 'hero'}
                className="group relative overflow-hidden border border-signal-cyan/40 bg-signal-cyan/[0.06]
                           px-7 py-3.5 font-mono text-[11px] uppercase tracking-instrument text-signal-cyan
                           transition-colors duration-300 hover:border-signal-cyan hover:bg-signal-cyan/[0.12]
                           focus-visible:border-signal-cyan disabled:opacity-40"
              >
                <span className="relative z-10">Enter the mind</span>
                <span
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent
                             via-signal-cyan/15 to-transparent transition-transform duration-700
                             group-hover:translate-x-full"
                  aria-hidden
                />
              </button>

              <Link href="/science" className="btn">
                What this is
              </Link>
            </div>
            {/*
              The "no account, nothing measured" line used to live here. It said
              the same thing as the standing disclaimer badge two inches below
              it, and it was the element pushing the buttons off the bottom of a
              laptop screen. One statement, in the place that is on every page.
            */}
          </div>
        </div>
        )}
      </section>

      {/* ---------------- after entering ---------------- */}
      {explored && (
        <>
          <Chapters />
          <ExperienceSection />
          <LivingMind />
        </>
      )}
    </div>
  );
}

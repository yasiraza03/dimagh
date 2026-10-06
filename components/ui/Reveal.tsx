'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ElementType,
  type ReactNode,
} from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useUIStore } from '@/store/uiStore';

/**
 * Scroll reveal primitives.
 *
 * Built on GSAP's ScrollTrigger rather than IntersectionObserver because the
 * same machinery also drives the scroll-linked camera work in the chapters —
 * one scroll system for the whole page keeps the timing coherent instead of
 * having two independent observers disagree about where "in view" starts.
 *
 * Everything degrades to an instant, static layout under reduced-motion. That
 * is a hard requirement for a page this scroll-driven, not a nicety.
 */

/**
 * Reveal state must be applied *before* the browser paints. With a plain
 * useEffect the element renders visible for one frame, is then snapped to
 * opacity 0, and animates back in — which reads as the content flashing on and
 * off as you arrive. useLayoutEffect runs before paint and removes the flash;
 * the server-side alias avoids React's SSR warning.
 */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

let registered = false;
function ensurePlugin() {
  if (registered || typeof window === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

interface RevealProps {
  children: ReactNode;
  /** Seconds of delay after the trigger fires. */
  delay?: number;
  /** Pixels to travel. Negative values come from above. */
  y?: number;
  /** Animate direct children in sequence instead of the wrapper as a whole. */
  stagger?: number;
  /** Fraction of the viewport at which the reveal starts. */
  start?: string;
  as?: ElementType;
  className?: string;
}

export function Reveal({
  children,
  delay = 0,
  y = 26,
  stagger,
  start = 'top 86%',
  as: Tag = 'div',
  className,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (reducedMotion) {
      gsap.set(el, { opacity: 1, y: 0 });
      if (stagger != null) gsap.set(el.children, { opacity: 1, y: 0 });
      return;
    }

    ensurePlugin();

    const targets: gsap.TweenTarget =
      stagger != null ? Array.from(el.children) : el;

    gsap.set(targets, { opacity: 0, y });

    const tween = gsap.to(targets, {
      opacity: 1,
      y: 0,
      duration: 0.95,
      delay,
      ease: 'power3.out',
      stagger: stagger ?? 0,
      scrollTrigger: {
        trigger: el,
        start,
        // Play once. Elements that re-animate every time you scroll past them
        // make a long page feel restless.
        once: true,
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [delay, y, stagger, start, reducedMotion]);

  return (
    // @ts-expect-error -- polymorphic ref across element types
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/**
 * Vertical parallax. `amount` is the total travel in pixels across the whole
 * time the element is on screen; positive values move the element up faster
 * than the scroll.
 */
export function useParallax(
  ref: React.RefObject<HTMLElement | null>,
  amount = 80,
) {
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion) return;
    ensurePlugin();

    const tween = gsap.fromTo(
      el,
      { y: amount * 0.5 },
      {
        y: -amount * 0.5,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      },
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [ref, amount, reducedMotion]);
}

/**
 * Register the plugin and refresh measurements once the page has settled.
 * Call once per scroll-driven route.
 */
export function useScrollSystem() {
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  useEffect(() => {
    if (reducedMotion) return;
    ensurePlugin();
    // Fonts and the WebGL canvas both change layout after first paint.
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 320);
    return () => {
      window.clearTimeout(id);
    };
  }, [reducedMotion]);
}

export { ScrollTrigger, ensurePlugin };

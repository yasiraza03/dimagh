'use client';

import { useEffect } from 'react';
import { useUIStore, type QualityTier } from '@/store/uiStore';

/**
 * Pick a render budget for this device, once, on mount.
 *
 * Deliberately conservative heuristics rather than a benchmark: a benchmark
 * costs a visible stall on exactly the devices that can least afford one. The
 * user can always override the result from the HUD.
 */
function detectQuality(): QualityTier {
  if (typeof window === 'undefined') return 'medium';

  const w = window.innerWidth;
  const cores = navigator.hardwareConcurrency ?? 4;
  // Non-standard but widely available, and the single best weak-device signal.
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;

  if (w < 760 || coarse) {
    return cores >= 8 && memory >= 6 ? 'medium' : 'low';
  }
  if (cores <= 4 || memory <= 4) return 'medium';
  if (w >= 1600 && cores >= 8) return 'high';
  return 'medium';
}

/**
 * Applies the detected quality tier and wires up prefers-reduced-motion.
 * Call once, high in the tree.
 */
export function useQualityDetection() {
  const setQuality = useUIStore((s) => s.setQuality);
  const setReducedMotion = useUIStore((s) => s.setReducedMotion);

  useEffect(() => {
    setQuality(detectQuality());

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [setQuality, setReducedMotion]);
}

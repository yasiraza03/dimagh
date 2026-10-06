'use client';

import { create } from 'zustand';

export type QualityTier = 'low' | 'medium' | 'high';

interface UIState {
  /** Has the user passed the landing gate into the experience? */
  entered: boolean;
  /** Science mode surfaces terminology, caveats and evidence tiers everywhere. */
  scienceMode: boolean;
  /** Honours prefers-reduced-motion, and can be toggled manually. */
  reducedMotion: boolean;
  /** Raises contrast and removes decorative grain/glow. */
  highContrast: boolean;
  /** Render budget, derived from the device but user-overridable. */
  quality: QualityTier;
  /** 3D region labels. */
  labels: boolean;
  /** The boot sequence has finished. */
  booted: boolean;

  enter: () => void;
  setScienceMode: (v: boolean) => void;
  toggleScienceMode: () => void;
  setReducedMotion: (v: boolean) => void;
  toggleReducedMotion: () => void;
  toggleHighContrast: () => void;
  setQuality: (q: QualityTier) => void;
  setLabels: (v: boolean) => void;
  toggleLabels: () => void;
  setBooted: (v: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  entered: false,
  scienceMode: false,
  reducedMotion: false,
  highContrast: false,
  quality: 'high',
  labels: true,
  booted: false,

  enter: () => set({ entered: true }),
  setScienceMode: (v) => set({ scienceMode: v }),
  toggleScienceMode: () => set((s) => ({ scienceMode: !s.scienceMode })),
  setReducedMotion: (v) => set({ reducedMotion: v }),
  toggleReducedMotion: () => set((s) => ({ reducedMotion: !s.reducedMotion })),
  toggleHighContrast: () => set((s) => ({ highContrast: !s.highContrast })),
  setQuality: (q) => set({ quality: q }),
  setLabels: (v) => set({ labels: v }),
  toggleLabels: () => set((s) => ({ labels: !s.labels })),
  setBooted: (v) => set({ booted: v }),
}));

/** Particle and geometry budgets per tier. Read once per mount, not per frame. */
export const QUALITY_BUDGET: Record<
  QualityTier,
  {
    signalParticles: number;
    dustParticles: number;
    brainSegments: number;
    connectionSegments: number;
    dpr: [number, number];
    postprocessing: boolean;
  }
> = {
  low: {
    signalParticles: 220,
    dustParticles: 900,
    brainSegments: 48,
    connectionSegments: 20,
    dpr: [0.7, 1],
    postprocessing: false,
  },
  medium: {
    signalParticles: 480,
    dustParticles: 2600,
    brainSegments: 72,
    connectionSegments: 32,
    dpr: [1, 1.5],
    postprocessing: true,
  },
  high: {
    signalParticles: 900,
    dustParticles: 5200,
    brainSegments: 112,
    connectionSegments: 48,
    dpr: [1, 2],
    postprocessing: true,
  },
};

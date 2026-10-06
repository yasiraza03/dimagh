'use client';

import { create } from 'zustand';
import type { LensMode } from '@/lib/simulation/types';
import { REGIONS } from '@/lib/brain/atlas';

export type TraceDirection = 'backward' | 'forward';

interface BrainState {
  lens: LensMode;
  /** Region id opened in the inspector, or null. */
  selected: string | null;
  /** Region id under the cursor. Hover is high-frequency but coarse enough. */
  hovered: string | null;
  /** Network-mode search term. */
  query: string;
  /** Region ids matching the current query — derived, cached here. */
  matches: string[];
  /** Isolate a functional system; other nodes dim out. */
  isolated: string | null;
  /** Transparency of the cortical shell, 0 = invisible, 1 = opaque. */
  shellOpacity: number;
  /** Causal-explorer trace, if open. */
  trace: { region: string; direction: TraceDirection } | null;

  setLens: (l: LensMode) => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  setQuery: (q: string) => void;
  isolate: (system: string | null) => void;
  setShellOpacity: (v: number) => void;
  openTrace: (region: string, direction?: TraceDirection) => void;
  flipTrace: () => void;
  closeTrace: () => void;
  reset: () => void;
}

/**
 * Free-text search over the atlas. Matches region names, abbreviations,
 * categories and the functional systems each region participates in, so
 * searching "memory" lights up the memory network rather than one region whose
 * name happens to contain the word.
 */
function searchRegions(q: string): string[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  const terms = needle.split(/\s+/);
  return REGIONS.filter((r) => {
    const haystack = [
      r.id,
      r.name,
      r.abbr,
      r.category,
      r.summary,
      ...r.systems,
      ...r.systems.map((s) => s.replace(/-/g, ' ')),
    ]
      .join(' ')
      .toLowerCase();
    return terms.every((t) => haystack.includes(t));
  }).map((r) => r.id);
}

export const useBrainStore = create<BrainState>((set) => ({
  lens: 'anatomy',
  selected: null,
  hovered: null,
  query: '',
  matches: [],
  isolated: null,
  shellOpacity: 1,
  trace: null,

  setLens: (l) => set({ lens: l }),
  select: (id) => set({ selected: id, trace: null }),
  hover: (id) => set({ hovered: id }),
  setQuery: (q) => set({ query: q, matches: searchRegions(q) }),
  isolate: (system) => set({ isolated: system }),
  setShellOpacity: (v) => set({ shellOpacity: Math.max(0, Math.min(1, v)) }),
  openTrace: (region, direction = 'backward') => set({ trace: { region, direction } }),
  flipTrace: () =>
    set((s) =>
      s.trace
        ? {
            trace: {
              region: s.trace.region,
              direction: s.trace.direction === 'backward' ? 'forward' : 'backward',
            },
          }
        : {},
    ),
  closeTrace: () => set({ trace: null }),
  reset: () =>
    set({
      selected: null,
      hovered: null,
      query: '',
      matches: [],
      isolated: null,
      trace: null,
      shellOpacity: 1,
    }),
}));

/** Human-readable copy for each lens. Used by the Brain Lens panel. */
export const LENS_INFO: Record<
  LensMode,
  { label: string; blurb: string; hint: string }
> = {
  anatomy: {
    label: 'Anatomy',
    blurb: 'Just the shape. Nothing is moving and nothing is lit up.',
    hint: 'Click any part of the brain to read about it.',
  },
  activity: {
    label: 'Activity',
    blurb: 'Which parts are busy, shown as a glow on and inside the brain.',
    hint: 'Brightness comes from the story being told, not from a measurement.',
  },
  network: {
    label: 'Network',
    blurb: 'The shape fades out and you see the wiring instead.',
    hint: 'Search for something like "memory" to pick out the parts involved.',
  },
  attention: {
    label: 'Attention',
    blurb: 'The parts that decide what you focus on, and what pulls you away.',
    hint: 'Everything else is dimmed down so you can see them.',
  },
  memory: {
    label: 'Memory',
    blurb: 'The parts that store experiences and find them again.',
    hint: 'Activity lingers here after it fades elsewhere — that lingering is the point.',
  },
  emotion: {
    label: 'Emotion',
    blurb: 'The parts that decide what matters and get your body ready.',
    hint: 'The whole scene warms up and speeds up as things get tense.',
  },
  prediction: {
    label: 'Prediction',
    blurb: 'Only the signals travelling back down are drawn.',
    hint: 'These are your brain guessing, not your senses reporting.',
  },
};

/**
 * Which functional systems each lens emphasises. Regions outside these are
 * dimmed rather than hidden, so the whole brain stays legible.
 */
export const LENS_SYSTEMS: Record<LensMode, string[] | null> = {
  anatomy: null,
  activity: null,
  network: null,
  attention: [
    'goal-directed-attention',
    'stimulus-driven-attention',
    'reorienting',
    'salience',
    'working-memory',
    'cognitive-control',
    'goal-maintenance',
    'spatial-representation',
    'oculomotor',
    'gain-control',
  ],
  memory: [
    'episodic-memory',
    'consolidation',
    'pattern-completion',
    'spatial-navigation',
    'spatial-coding',
    'cortical-hippocampal-interface',
    'autobiographical-memory',
    'scene-construction',
    'default-mode-network',
    'semantic-access',
  ],
  emotion: [
    'salience-detection',
    'associative-learning',
    'autonomic-initiation',
    'autonomic-control',
    'interoception',
    'salience-network',
    'affect',
    'threat-regulation',
    'arousal',
    'neuromodulation',
    'valuation',
  ],
  prediction: [
    'predictive-processing',
    'forward-model',
    'error-correction',
    'feature-integration',
    'thalamocortical-gating',
    'object-recognition',
    'context',
  ],
};

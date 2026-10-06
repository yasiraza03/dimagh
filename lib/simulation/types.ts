import type { PaletteKey, Vec3 } from '@/lib/brain/types';

/**
 * Scenario schema.
 *
 * A scenario is *data*. The engine in ./engine.ts interprets it; no component
 * hardcodes a pathway, a timing or a camera move. Adding a new scenario means
 * adding a JSON file, not writing animation code.
 */

export type LensMode =
  | 'anatomy'
  | 'activity'
  | 'network'
  | 'attention'
  | 'memory'
  | 'emotion'
  | 'prediction';

export const LENS_MODES: LensMode[] = [
  'anatomy',
  'activity',
  'network',
  'attention',
  'memory',
  'emotion',
  'prediction',
];

/** The six Neural Lab controls. All are conceptual 0–1 dials. */
export interface SimParams {
  attention: number;
  distraction: number;
  novelty: number;
  memoryLoad: number;
  sensoryNoise: number;
  difficulty: number;
}

export const DEFAULT_PARAMS: SimParams = {
  attention: 0.5,
  distraction: 0.25,
  novelty: 0.5,
  memoryLoad: 0.3,
  sensoryNoise: 0.25,
  difficulty: 0.4,
};

export type ParamKey = keyof SimParams;

export const PARAM_KEYS: ParamKey[] = [
  'attention',
  'distraction',
  'novelty',
  'memoryLoad',
  'sensoryNoise',
  'difficulty',
];

export const PARAM_LABELS: Record<ParamKey, string> = {
  attention: 'Attention',
  distraction: 'Distraction',
  novelty: 'Novelty',
  memoryLoad: 'Memory load',
  sensoryNoise: 'Sensory noise',
  difficulty: 'Task difficulty',
};

/** Sensitivity coefficients: how much each lab dial scales a value. */
export type ParamMods = Partial<Record<ParamKey, number>>;

export type CameraMove = 'focus' | 'orbit' | 'overview' | 'follow' | 'inside' | 'wide';

export interface CameraDirective {
  move: CameraMove;
  /** Region id to focus/orbit/follow. */
  region?: string;
  /** Seconds the move should take. Defaults per move type. */
  duration?: number;
  /** Distance multiplier, 1 = the move's natural distance. */
  distance?: number;
}

export interface ScenarioEvent {
  id: string;
  /** Seconds from scenario start. */
  time: number;
  title: string;
  explanation: string;
  /** Extra detail revealed only in Science mode. */
  science?: string;
  /** A travelling signal is generated when both are present. */
  source?: string;
  target?: string;
  /** Pin the signal to a specific connection id instead of inferring it. */
  via?: string;
  /** Regions that light up at this event, in addition to source/target. */
  activate?: string[];
  /** Seconds the activation is held before decaying. */
  hold?: number;
  /** Hold until the end of the scenario. */
  sustain?: boolean;
  /** Seconds the signal takes to traverse. Defaults from connection profile. */
  travel?: number;
  /** 0–1 base strength before lab modulation. */
  intensity?: number;
  color?: PaletteKey;
  /** Run the signal from target back toward source. */
  reverse?: boolean;
  stage?: string;
  camera?: CameraDirective;
  lens?: LensMode;
  /** How lab dials scale this event's intensity. */
  mods?: ParamMods;
  /** Include in the causal backbone shown by the Causal Explorer. */
  causal?: boolean;
  /** Pathway character, used for line styling and the event badge. */
  kind?: 'forward' | 'feedback' | 'modulatory' | 'burst' | 'loop';
}

export interface ScenarioStage {
  id: string;
  label: string;
  time: number;
}

export interface CausalNode {
  id: string;
  label: string;
  detail: string;
  /** Regions associated with this link in the chain. */
  regions: string[];
  /** Event id this node corresponds to, for timeline jumps. */
  event?: string;
}

export interface ScienceNote {
  /** KNOWN: well-established. SIMPLIFIED: real but compressed. CONCEPTUAL: a model. */
  tier: 'known' | 'simplified' | 'conceptual';
  text: string;
}

export interface ScenarioReadout {
  id: string;
  label: string;
  /** Baseline conceptual index 0–1. */
  base: number;
  mods: ParamMods;
  note: string;
  /** Higher is "more", but not necessarily "better". */
  polarity?: 'neutral' | 'good-high' | 'good-low';
}

export interface ScenarioChoice {
  id: string;
  label: string;
  description: string;
  /** Events appended (time-shifted to the choice point) when chosen. */
  events: ScenarioEvent[];
  outcome: string;
}

export interface Scenario {
  id: string;
  /** Short all-caps label used in the experience grid. */
  code: string;
  title: string;
  subtitle: string;
  question: string;
  /** Seconds. */
  duration: number;
  /** Human-readable estimate shown on the card, e.g. "90 sec". */
  estimate: string;
  lens: LensMode;
  accent: PaletteKey;
  /** One-line explanation for the card. */
  teaser: string;
  /** 2–4 sentence framing shown before the simulation plays. */
  intro: string;
  stages: ScenarioStage[];
  events: ScenarioEvent[];
  causalChain: CausalNode[];
  science: ScienceNote[];
  references: Array<{ label: string; note: string }>;
  readouts: ScenarioReadout[];
  choices?: { prompt: string; at: number; options: ScenarioChoice[] };
  outcome: { headline: string; body: string; insight: string };
  /** Optional interactive component mounted alongside the brain. */
  companion?: string;
}

/* ------------------------------------------------------------------ *
 * Engine output
 * ------------------------------------------------------------------ */

export interface ActiveSignal {
  eventId: string;
  /** Resolved connection-instance keys (primary + mirrored twin). */
  curves: Array<[Vec3, Vec3, Vec3, Vec3]>;
  /** 0–1 along the path. */
  progress: number;
  intensity: number;
  color: PaletteKey;
  /** World-space head position, used by the follow camera. */
  head: Vec3;
  label: string;
  kind: NonNullable<ScenarioEvent['kind']>;
}

export interface SimFrame {
  time: number;
  /** Indexed by region slot. 0–1. */
  regionLevel: Float32Array;
  /** Onset freshness per region slot, 1 at activation → 0. Drives pulse rings. */
  regionOnset: Float32Array;
  /** Indexed by connection slot. 0–1. */
  connectionLevel: Float32Array;
  signals: ActiveSignal[];
  /** The most recent event at or before `time`. */
  currentEvent: ScenarioEvent | null;
  currentStage: ScenarioStage | null;
  /** Events whose activation window includes `time`. */
  activeEvents: ScenarioEvent[];
}

import appleVision from '@/data/scenarios/apple-vision.json';
import attention from '@/data/scenarios/attention.json';
import distraction from '@/data/scenarios/distraction.json';
import fear from '@/data/scenarios/fear.json';
import memoryFormation from '@/data/scenarios/memory-formation.json';
import memoryRecall from '@/data/scenarios/memory-recall.json';
import language from '@/data/scenarios/language.json';
import movement from '@/data/scenarios/movement.json';
import sleep from '@/data/scenarios/sleep.json';
import prediction from '@/data/scenarios/prediction.json';
import decision from '@/data/scenarios/decision.json';
import illusionData from '@/data/experiments/illusions.json';

import type { PaletteKey } from '@/lib/brain/types';
import type { Scenario, ScenarioEvent } from './types';
import { validateScenario } from './engine';

/** Every scenario, keyed by id. Order here is the order in the catalogue. */
export const SCENARIOS: Scenario[] = [
  appleVision as Scenario,
  language as Scenario,
  memoryRecall as Scenario,
  attention as Scenario,
  distraction as Scenario,
  fear as Scenario,
  prediction as Scenario,
  movement as Scenario,
  memoryFormation as Scenario,
  sleep as Scenario,
  decision as Scenario,
];

export const SCENARIO_BY_ID: ReadonlyMap<string, Scenario> = new Map(
  SCENARIOS.map((s) => [s.id, s]),
);

export function getScenario(id: string): Scenario | undefined {
  return SCENARIO_BY_ID.get(id);
}

/**
 * Events are authored in rough time order but we sort defensively — the engine's
 * `currentEvent` and `nextEvent` walk the array and assume monotonic time.
 */
for (const s of SCENARIOS) {
  s.events.sort((a, b) => a.time - b.time);
  s.stages.sort((a, b) => a.time - b.time);
  for (const opt of s.choices?.options ?? []) {
    opt.events.sort((a, b) => a.time - b.time);
  }
}

/**
 * Merge a chosen branch into a scenario. Returns a new object so the base
 * scenario is never mutated and switching choices is clean.
 */
export function withChoice(scenario: Scenario, choiceId: string | null): Scenario {
  if (!scenario.choices || !choiceId) return scenario;
  const option = scenario.choices.options.find((o) => o.id === choiceId);
  if (!option) return scenario;
  const events: ScenarioEvent[] = [...scenario.events, ...option.events].sort(
    (a, b) => a.time - b.time,
  );
  return { ...scenario, events };
}

/** The point at which playback must stop and wait for a choice. */
export function choicePoint(scenario: Scenario): number | null {
  return scenario.choices?.at ?? null;
}

/* ------------------------------------------------------------------ *
 * The experience catalogue (the "WHAT HAPPENS WHEN..." grid)
 * ------------------------------------------------------------------ */

export interface ExperienceCard {
  /** Card id — unique even when two cards share a scenario. */
  id: string;
  scenario: string;
  verb: string;
  teaser: string;
  estimate: string;
  accent: PaletteKey;
  /** Which miniature WebGL motif the card renders. */
  motif: 'radial' | 'stream' | 'cluster' | 'spiral' | 'burst' | 'lattice' | 'wave';
  /** Deep-link to a stage within the scenario. */
  stage?: string;
}

export const EXPERIENCES: ExperienceCard[] = [
  { id: 'see', scenario: 'apple-vision', verb: 'SEE', teaser: 'Light becomes an object, and then a decision.', estimate: '2 min', accent: 'cyan', motif: 'stream' },
  { id: 'hear', scenario: 'language', verb: 'HEAR', teaser: 'A pressure wave becomes a word, and then a meaning.', estimate: '3 min', accent: 'green', motif: 'wave' },
  { id: 'remember', scenario: 'memory-recall', verb: 'REMEMBER', teaser: 'Recall is reconstruction. Watch the gaps get filled.', estimate: '3 min', accent: 'violet', motif: 'cluster' },
  { id: 'focus', scenario: 'attention', verb: 'FOCUS', teaser: 'Selecting a little means discarding a lot.', estimate: '3 min', accent: 'blue', motif: 'radial' },
  { id: 'distracted', scenario: 'distraction', verb: 'GET DISTRACTED', teaser: 'The notification costs more than the glance.', estimate: '3 min', accent: 'amber', motif: 'burst' },
  { id: 'fear', scenario: 'fear', verb: 'FEEL FEAR', teaser: 'Your body commits before you know what it is.', estimate: '3 min', accent: 'threat', motif: 'burst' },
  { id: 'recognize', scenario: 'prediction', verb: 'RECOGNIZE', teaser: 'Ambiguous input, confident percept. Guess why.', estimate: '3 min', accent: 'violet', motif: 'spiral' },
  { id: 'move', scenario: 'movement', verb: 'MOVE', teaser: 'Accurate movement is mostly prediction.', estimate: '3 min', accent: 'orange', motif: 'stream' },
  { id: 'learn', scenario: 'memory-formation', verb: 'LEARN', teaser: 'An experience becomes something retrievable.', estimate: '3 min', accent: 'violet', motif: 'lattice' },
  { id: 'sleep', scenario: 'sleep', verb: 'SLEEP', teaser: 'Not off. In a different mode, several times a night.', estimate: '4 min', accent: 'blue', motif: 'spiral' },
  { id: 'dream', scenario: 'sleep', verb: 'DREAM', teaser: 'Vivid experience with the body held still.', estimate: '1 min', accent: 'violet', motif: 'cluster', stage: 'rem' },
  { id: 'decide', scenario: 'decision', verb: 'DECIDE', teaser: 'Evidence accumulating until something crosses a line.', estimate: '2 min', accent: 'amber', motif: 'radial' },
];

export function experienceById(id: string): ExperienceCard | undefined {
  return EXPERIENCES.find((e) => e.id === id);
}

/* ------------------------------------------------------------------ *
 * Experiments
 * ------------------------------------------------------------------ */

export interface Illusion {
  id: string;
  name: string;
  component: string;
  kind: string;
  accent: PaletteKey;
  tagline: string;
  experience: string;
  perceived: string;
  actual: string;
  why: string;
  regions: string[];
  mechanism: string;
  caveat: string;
}

export const ILLUSIONS: Illusion[] = illusionData.experiments as Illusion[];

export function illusionById(id: string): Illusion | undefined {
  return ILLUSIONS.find((i) => i.id === id);
}

/* ------------------------------------------------------------------ *
 * Load-time validation
 * ------------------------------------------------------------------ */

if (process.env.NODE_ENV !== 'production') {
  const problems = SCENARIOS.flatMap((s) => validateScenario(s)).concat(
    SCENARIOS.flatMap((s) =>
      (s.choices?.options ?? []).flatMap((o) =>
        validateScenario({ ...s, events: o.events, causalChain: [] }),
      ),
    ),
  );
  if (problems.length > 0) {
    // Surfaced loudly in dev so a bad data edit cannot ship silently.
    console.warn(`[dimagh] scenario data problems:\n  ${problems.join('\n  ')}`);
  }
}

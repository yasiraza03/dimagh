'use client';

import dynamic from 'next/dynamic';
import type { Scenario } from '@/lib/simulation/types';

/**
 * Companion registry.
 *
 * Each scenario names a companion in its JSON; this is the only place that maps
 * that name to a component. They are loaded dynamically so that opening one
 * scenario does not ship the interactive task code for the other ten.
 */

const Loading = () => (
  <div className="p-4">
    <div className="h-[150px] animate-pulse border border-white/[0.06] bg-void-800/50" />
  </div>
);

const COMPANIONS: Record<
  string,
  React.ComponentType<{ scenario: Scenario }>
> = {
  apple: dynamic(() => import('./AppleStimulus').then((m) => m.AppleStimulus), {
    loading: Loading,
  }),
  attention: dynamic(() => import('./AttentionTask').then((m) => m.AttentionTask), {
    loading: Loading,
  }),
  distraction: dynamic(
    () => import('./DistractionTask').then((m) => m.DistractionTask),
    { loading: Loading },
  ),
  fear: dynamic(() => import('./FearTask').then((m) => m.FearTask), {
    loading: Loading,
  }),
  memory: dynamic(() => import('./MemoryRoom').then((m) => m.MemoryRoom), {
    loading: Loading,
  }),
  recall: dynamic(() => import('./RecallTask').then((m) => m.RecallTask), {
    loading: Loading,
  }),
  language: dynamic(
    () => import('./LanguageConstellation').then((m) => m.LanguageConstellation),
    { loading: Loading },
  ),
  movement: dynamic(() => import('./MovementTask').then((m) => m.MovementTask), {
    loading: Loading,
  }),
  sleep: dynamic(() => import('./SleepDial').then((m) => m.SleepDial), {
    loading: Loading,
  }),
  prediction: dynamic(
    () => import('./PredictionTask').then((m) => m.PredictionTask),
    { loading: Loading },
  ),
  decision: dynamic(() => import('./DecisionTask').then((m) => m.DecisionTask), {
    loading: Loading,
  }),
};

export function ScenarioCompanion({ scenario }: { scenario: Scenario }) {
  const Component = scenario.companion ? COMPANIONS[scenario.companion] : undefined;
  if (!Component) return null;
  return <Component scenario={scenario} />;
}

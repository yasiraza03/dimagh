'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { BrainScene } from '@/components/brain/BrainScene';
import { SimulationTimeline } from './SimulationTimeline';
import { SimulationControls } from './SimulationControls';
import { ExplanationPanel } from './ExplanationPanel';
import { EventInspector } from './EventInspector';
import { ReadoutPanel } from './ReadoutPanel';
import { CausalExplorer } from './CausalExplorer';
import { ChoicePrompt } from './ChoicePrompt';
import { OutcomeCard } from './OutcomeCard';
import { ScenarioCompanion } from '@/components/scenarios/ScenarioCompanion';
import { BrainLens } from '@/components/ui/BrainLens';
import { RegionInspector } from '@/components/ui/RegionInspector';
import { ScienceNotes } from '@/components/ui/primitives';
import { clock } from '@/lib/simulation/clock';
import { useClock } from '@/lib/simulation/useClock';
import { getScenario } from '@/lib/simulation/scenarios';
import { rig } from '@/lib/visualization/cameraRig';
import { resetRenderState } from '@/lib/visualization/renderState';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import { useBrainStore } from '@/store/brainStore';
import { useSimStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import { useBottomChrome } from '@/lib/visualization/bottomChrome';
import { useFraming } from '@/lib/visualization/useFraming';
import type { Scenario } from '@/lib/simulation/types';

/**
 * The scenario player.
 *
 * Composition only: the WebGL scene, the transport, the explanation rail and the
 * interactive companion. All the behaviour lives in the engine, the clock and
 * the camera rig, which is what lets eleven very different scenarios share one
 * player with no per-scenario branching here.
 */

type Tab = 'explanation' | 'steps' | 'params' | 'science';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'explanation', label: 'Now' },
  { id: 'steps', label: 'Steps' },
  { id: 'params', label: 'Lab' },
  { id: 'science', label: 'Science' },
];

export function ScenarioPlayer({
  scenarioId,
  initialStage,
}: {
  scenarioId: string;
  initialStage?: string;
}) {
  const scenario = useMemo(() => getScenario(scenarioId), [scenarioId]);
  const [tab, setTab] = useState<Tab>('explanation');
  const [causalOpen, setCausalOpen] = useState(false);
  const [started, setStarted] = useState(false);

  const loadScenario = useSimStore((s) => s.loadScenario);
  const showOutcome = useSimStore((s) => s.showOutcome);
  const companionOpen = useSimStore((s) => s.companionOpen);
  const setCompanionOpen = useSimStore((s) => s.setCompanionOpen);

  const setLens = useBrainStore((s) => s.setLens);
  const resetBrain = useBrainStore((s) => s.reset);
  const selected = useBrainStore((s) => s.selected);

  const scienceMode = useUIStore((s) => s.scienceMode);
  const toggleScienceMode = useUIStore((s) => s.toggleScienceMode);

  const { gated } = useClock();

  // The transport owns the bottom of the viewport; keep the global badges clear.
  useBottomChrome(104);
  // Companion on the left, explanation rail on the right, transport along the
  // bottom: frame the brain in what is left, and switch the offset off while
  // the intro or outcome takeover is up.
  useFraming({
    left: scenario?.companion && companionOpen ? 400 : 0,
    right: 364,
    top: 120,
    bottom: 110,
    enabled: started && !showOutcome,
  });

  useEffect(() => {
    if (!scenario) return;
    resetBrain();
    resetRenderState();
    loadScenario(scenario.id);
    setLens(scenario.lens);
    rig.overview(1.4);
    return () => {
      clock.pause();
    };
  }, [scenario, loadScenario, setLens, resetBrain]);

  if (!scenario) return null;

  const accent = PALETTE_HEX[scenario.accent];

  const begin = () => {
    setStarted(true);
    if (initialStage) {
      const stage = scenario.stages.find((s) => s.id === initialStage);
      if (stage) clock.seek(stage.time);
    }
    clock.play();
  };

  /* The right rail shows, in priority order: a selected region, an open causal
     trace, then the tabbed panel. One slot, never stacked panels. */
  const rail = selected ? (
    <RegionInspector />
  ) : causalOpen ? (
    <CausalExplorer scenario={scenario} onClose={() => setCausalOpen(false)} />
  ) : (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b border-white/[0.07]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={clsx(
              'flex-1 border-b-2 px-2 py-2.5 font-mono text-[9.5px] uppercase tracking-instrument transition-colors',
              tab === t.id
                ? 'border-current text-bone'
                : 'border-transparent text-bone-faint hover:text-bone-dim',
            )}
            style={tab === t.id ? { color: accent, borderColor: accent } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'explanation' && (
          <ExplanationPanel
            scenario={scenario}
            onExplainCause={() => setCausalOpen(true)}
          />
        )}
        {tab === 'steps' && <EventInspector scenario={scenario} />}
        {tab === 'params' && <ReadoutPanel scenario={scenario} />}
        {tab === 'science' && (
          <div className="p-4">
            <ScienceNotes notes={scenario.science} />
            <div className="mt-6 border-t border-white/[0.07] pt-4">
              <p className="instrument mb-3">Where this comes from</p>
              <ul className="space-y-3">
                {scenario.references.map((ref) => (
                  <li key={ref.label}>
                    <p className="font-mono text-[10px] uppercase tracking-instrument text-bone-dim">
                      {ref.label}
                    </p>
                    <p className="mt-1 text-[11.5px] leading-[1.6] text-bone-faint">
                      {ref.note}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[10.5px] leading-relaxed text-bone-faint">
                These are pointers to bodies of work rather than citations of
                specific papers. dimagh is a teaching visualisation, not a review
                article — treat it as a map of where to read further.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative flex min-h-dvh flex-col lg:block lg:h-dvh lg:overflow-hidden">
      {/* ------------- canvas ------------- */}
      <div className="relative h-[46vh] shrink-0 lg:absolute lg:inset-0 lg:h-auto">
        <BrainScene scrollable />
        <div className="vignette pointer-events-none absolute inset-0" aria-hidden />
      </div>

      {/* ------------- intro gate ------------- */}
      {!started && !showOutcome && (
        <div className="fixed inset-0 z-[70] flex items-end overflow-y-auto bg-void-900 p-5 pt-20 sm:items-center sm:p-10">
          <div className="mx-auto w-full max-w-xl animate-fade-up">
            <p className="instrument mb-4" style={{ color: accent }}>
              {scenario.code}
            </p>
            {/* The header below owns the page's h1; this gate is transient. */}
            <h2 className="display-lg text-bone">{scenario.question}</h2>
            <p className="prose-sci mt-7 text-[14px]">{scenario.intro}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" onClick={begin} className="btn btn-primary px-6 py-3">
                Begin
              </button>
              <Link href="/experience" className="btn">
                Back
              </Link>
              <span className="instrument-sm ml-auto">{scenario.estimate}</span>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.07] pt-5">
              <span className="instrument-sm">
                {scenario.events.length} steps
              </span>
              <span className="instrument-sm">
                {scenario.duration.toFixed(1)}s timeline
              </span>
              <span className="instrument-sm">
                {scenario.stages.length} stages
              </span>
              {scenario.choices && (
                <span className="instrument-sm text-signal-amber">
                  branching decision
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/*
        One instance of each panel, repositioned with responsive classes rather
        than duplicated per breakpoint. Rendering the rail twice and hiding one
        with CSS would put every id, aria-describedby target and companion task
        into the document twice.
      */}

      {/* ------------- header ------------- */}
      <header className="relative z-20 border-t border-white/[0.07] bg-void-900 px-4 py-4 lg:pointer-events-none lg:absolute lg:inset-x-0 lg:top-14 lg:border-t-0 lg:bg-transparent lg:py-0">
        <div className="flex flex-wrap items-start gap-3 lg:max-w-[calc(100%-380px)] lg:gap-4 lg:[&>*]:pointer-events-auto">
          <div className="w-full lg:w-auto lg:border lg:border-white/[0.07] lg:bg-void-900/70 lg:backdrop-blur-md lg:px-4 lg:py-3">
            <p className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: accent }}
                aria-hidden
              />
              <span className="instrument">{scenario.code}</span>
            </p>
            <h1 className="mt-1.5 font-display text-[22px] font-normal leading-tight tracking-[-0.02em] text-bone lg:text-[19px]">
              {scenario.title}
            </h1>
            <p className="mt-1 text-[12px] text-bone-faint">{scenario.subtitle}</p>
          </div>

          <BrainLens compact />

          <button
            type="button"
            onClick={toggleScienceMode}
            aria-pressed={scienceMode}
            className={clsx(
              'btn backdrop-blur-md',
              scienceMode && 'border-signal-violet/60 text-signal-violet',
            )}
          >
            Science mode
          </button>
        </div>
      </header>

      {/* ------------- companion ------------- */}
      {scenario.companion && (
        <div className="relative z-20 border-t border-white/[0.07] bg-void-900 lg:pointer-events-none lg:absolute lg:bottom-[168px] lg:left-4 lg:w-[400px] lg:max-h-[calc(100dvh-22rem)] lg:border-t-0 lg:bg-transparent">
          {/*
              Bottom-anchored with a height cap and its own scroll. Without
              the cap a tall task panel simply grew upward off the top of
              the screen, taking its first few rows with it.
            */}
            <div className="lg:pointer-events-auto lg:flex lg:max-h-[calc(100dvh-22rem)] lg:flex-col lg:border lg:border-white/[0.07] lg:bg-void-900/90 lg:backdrop-blur-md lg:overflow-hidden">
            <button
              type="button"
              onClick={() => setCompanionOpen(!companionOpen)}
              aria-expanded={companionOpen}
              className="flex w-full shrink-0 items-center justify-between gap-2 px-4 py-2.5 lg:px-3.5"
            >
              <span className="instrument">Task</span>
              <span
                className={clsx(
                  'font-mono text-[9px] text-signal-cyan transition-transform',
                  !companionOpen && 'rotate-180',
                )}
                aria-hidden
              >
                ▾
              </span>
            </button>
            {companionOpen && (
              <div className="border-t border-white/[0.07] lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                <ScenarioCompanion scenario={scenario} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------- rail ------------- */}
      <aside className="relative z-20 border-t border-white/[0.07] bg-void-900 lg:absolute lg:bottom-[168px] lg:right-4 lg:top-14 lg:w-[348px] lg:border-t-0 lg:bg-transparent">
        <div className="lg:border lg:border-white/[0.07] lg:bg-void-900/70 lg:backdrop-blur-md lg:h-full lg:overflow-hidden">{rail}</div>
      </aside>

      {/* ------------- transport ------------- */}
      <div className="sticky bottom-0 z-30 shrink-0 border-t border-white/[0.07] bg-void-900/95 lg:absolute lg:inset-x-0 lg:bottom-0 lg:border-t-0">
        <div className="mx-auto max-w-[1800px] px-4 py-3">
          <SimulationTimeline scenario={scenario} />
          <div className="mt-2.5">
            <SimulationControls scenario={scenario} />
          </div>
        </div>
      </div>

      {/* ------------- overlays ------------- */}
      {gated && !showOutcome && <ChoicePrompt scenario={scenario} />}
      {showOutcome && <OutcomeCard scenario={scenario} />}
    </div>
  );
}

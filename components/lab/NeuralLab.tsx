'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { BrainScene } from '@/components/brain/BrainScene';
import { SimulationTimeline } from '@/components/simulation/SimulationTimeline';
import { SimulationControls } from '@/components/simulation/SimulationControls';
import { BrainLens } from '@/components/ui/BrainLens';
import { ExplanationPanel } from '@/components/simulation/ExplanationPanel';
import { CausalExplorer } from '@/components/simulation/CausalExplorer';
import { readoutValue } from '@/lib/simulation/engine';
import { clock } from '@/lib/simulation/clock';
import { SCENARIOS, getScenario } from '@/lib/simulation/scenarios';
import {
  DEFAULT_PARAMS,
  PARAM_KEYS,
  PARAM_LABELS,
  type ParamKey,
} from '@/lib/simulation/types';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import { rig } from '@/lib/visualization/cameraRig';
import { resetRenderState } from '@/lib/visualization/renderState';
import { useBrainStore } from '@/store/brainStore';
import { useSimStore } from '@/store/simulationStore';
import { Reveal, useScrollSystem } from '@/components/ui/Reveal';
import { useFraming } from '@/lib/visualization/useFraming';

/**
 * The Neural Lab.
 *
 * The same engine as the scenario player, but with the parameters promoted to
 * the main surface and a live comparison against the authored baseline. Changing
 * a dial re-evaluates the simulation on the next frame — the brain responds
 * while you drag, and the readouts show the delta from default so you can see
 * which direction you pushed it.
 *
 * Nothing here is a prediction about any person. Every output is a conceptual
 * index derived from coefficients written into the scenario file.
 */

const PARAM_DETAIL: Record<ParamKey, { what: string; effect: string }> = {
  attention: {
    what: 'How hard you are concentrating on the task.',
    effect: 'Turn it up and the useful pathways get louder — but you also take longer to commit.',
  },
  distraction: {
    what: 'How much else is pulling at you.',
    effect: 'Turn it up and the goal keeps slipping, and costs more to get back.',
  },
  novelty: {
    what: 'How surprising or unfamiliar things are.',
    effect: 'Turn it up and you notice more, react harder, and remember more of it.',
  },
  memoryLoad: {
    what: 'How much you are already holding in mind.',
    effect: 'Turn it up and there is less room left, so more gets filled in by guessing.',
  },
  sensoryNoise: {
    what: 'How unclear what you can see or hear is.',
    effect: 'Turn it up and your brain leans on expectation instead of evidence.',
  },
  difficulty: {
    what: 'How hard the task is.',
    effect: 'Turn it up and it takes longer to settle, and settles wrong more often.',
  },
};

export function NeuralLab() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [causalOpen, setCausalOpen] = useState(false);

  const params = useSimStore((s) => s.params);
  const setParam = useSimStore((s) => s.setParam);
  const resetParams = useSimStore((s) => s.resetParams);
  const dirty = useSimStore((s) => s.paramsDirty);
  const loadScenario = useSimStore((s) => s.loadScenario);

  const setLens = useBrainStore((s) => s.setLens);
  const resetBrain = useBrainStore((s) => s.reset);

  const scenario = useMemo(() => getScenario(scenarioId), [scenarioId]);
  useScrollSystem();
  // Only the header strip covers the scene here; the transport sits below it.
  useFraming({ top: 92 });

  useEffect(() => {
    if (!scenario) return;
    resetBrain();
    resetRenderState();
    loadScenario(scenario.id);
    setLens(scenario.lens);
    rig.overview(1.4);
    clock.seek(0);
    clock.play();
  }, [scenario, loadScenario, setLens, resetBrain]);

  if (!scenario) return null;
  const accent = PALETTE_HEX[scenario.accent];

  const rerun = () => {
    clock.seek(0);
    clock.forward();
    clock.play();
  };

  return (
    <div className="relative min-h-dvh pt-14">
      {/* Scene */}
      {/*
        The transport used to be pinned inside this box, which meant 130px of
        the brain's frame was permanently behind it. The scene now owns the
        whole box and the controls are a sibling underneath.
      */}
      <div className="relative h-[52vh] lg:h-[62vh]">
        <BrainScene scrollable />
        <div className="vignette pointer-events-none absolute inset-0" aria-hidden />

        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 px-4">
          <div className="pointer-events-auto mx-auto flex max-w-[1800px] flex-wrap items-start gap-3">
            <div className="panel px-4 py-3">
              <p className="instrument mb-1 flex items-center gap-2">
                <span className="font-mono text-[10px] text-signal-cyan">05</span>
                Neural lab
              </p>
              <p className="font-display text-[17px] font-normal leading-tight text-bone">
                {scenario.title}
              </p>
            </div>
            <BrainLens compact />
            {dirty && (
              <span className="panel flex items-center gap-2 px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-signal-amber" aria-hidden />
                <span className="font-mono text-[9px] uppercase tracking-instrument text-signal-amber">
                  parameters modified
                </span>
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Transport: below the scene, so it never covers the brain. */}
      <div className="sticky top-14 z-30 border-y border-white/[0.07] bg-void-900">
        <div className="mx-auto max-w-[1800px] px-4 py-3">
          <SimulationTimeline scenario={scenario} />
          <div className="mt-2.5">
            <SimulationControls scenario={scenario} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="relative border-t border-white/[0.07] bg-void-900">
        <div className="grid-fine pointer-events-none absolute inset-0 opacity-40" aria-hidden />

        <div className="relative mx-auto max-w-[1800px] px-6 py-14 sm:px-10">
          <h1 className="display-lg max-w-3xl text-bone">
            Change the conditions.
            <br />
            Watch the model respond.
          </h1>

          <p className="mt-6 max-w-2xl text-[14.5px] leading-[1.8] text-bone-dim">
            Six dials, feeding the same simulation the experiences use. Each
            one means something different depending on what is being shown —
            turning up noise matters more for seeing than for deciding. Drag any
            of them and the brain above reacts immediately.
          </p>

          {/* Scenario picker */}
          <div className="mt-10">
            <p className="instrument mb-3">Simulation</p>
            <div className="flex flex-wrap gap-1.5">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScenarioId(s.id)}
                  aria-pressed={s.id === scenarioId}
                  className={clsx(
                    'border px-3 py-2 font-mono text-[10px] uppercase tracking-instrument transition-colors',
                    s.id === scenarioId
                      ? 'border-white/35 bg-white/[0.06] text-bone'
                      : 'border-white/[0.08] text-bone-faint hover:border-white/25 hover:text-bone-dim',
                  )}
                >
                  {s.code}
                </button>
              ))}
            </div>
          </div>

          <Reveal
            stagger={0.1}
            y={30}
            className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)]"
          >
            {/* Dials */}
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="instrument">Parameters</p>
                <div className="flex gap-2">
                  {dirty && (
                    <button type="button" onClick={resetParams} className="btn px-3 py-1.5">
                      Reset
                    </button>
                  )}
                  <button type="button" onClick={rerun} className="btn btn-primary px-3 py-1.5">
                    Rerun
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                {PARAM_KEYS.map((k) => {
                  const delta = params[k] - DEFAULT_PARAMS[k];
                  return (
                    <div key={k}>
                      <label className="mb-2 flex items-baseline justify-between gap-2">
                        <span className="font-display text-[13px] font-normal text-bone">
                          {PARAM_LABELS[k]}
                        </span>
                        <span className="flex items-baseline gap-2">
                          {Math.abs(delta) > 0.005 && (
                            <span
                              className="font-mono text-[9px] tabular-nums"
                              style={{ color: PALETTE_HEX.amber }}
                            >
                              {delta > 0 ? '+' : ''}
                              {Math.round(delta * 100)}
                            </span>
                          )}
                          <span className="font-mono text-[11px] tabular-nums text-bone-dim">
                            {Math.round(params[k] * 100)}
                          </span>
                        </span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={params[k]}
                        onChange={(e) => setParam(k, Number(e.target.value))}
                        className="slider"
                        aria-describedby={`lab-${k}`}
                      />
                      <p id={`lab-${k}`} className="mt-2 text-[11.5px] leading-snug text-bone-faint">
                        {PARAM_DETAIL[k].what}
                        <br />
                        <span className="text-bone-faint/70">
                          {PARAM_DETAIL[k].effect}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Readouts */}
            <div>
              <p className="instrument mb-4">Modelled outcomes</p>

              <div className="space-y-6">
                {scenario.readouts.map((r) => {
                  const value = readoutValue(r, params);
                  const baseline = readoutValue(r, DEFAULT_PARAMS);
                  const delta = value - baseline;
                  return (
                    <div key={r.id}>
                      <div className="mb-2 flex items-baseline justify-between gap-2">
                        <span className="font-display text-[13px] font-normal text-bone">
                          {r.label}
                        </span>
                        <span className="font-mono text-[12px] tabular-nums text-bone-dim">
                          {Math.round(value * 100)}
                        </span>
                      </div>

                      <div className="relative h-[6px] w-full bg-white/[0.07]">
                        {/* Baseline tick — the authored default. */}
                        <span
                          className="absolute top-[-3px] h-[12px] w-px bg-white/40"
                          style={{ left: `${baseline * 100}%` }}
                          aria-hidden
                        />
                        <span
                          className="block h-full transition-[width] duration-200"
                          style={{ width: `${value * 100}%`, background: accent }}
                        />
                      </div>

                      <p className="mt-2 flex items-baseline gap-2 text-[11.5px] leading-snug text-bone-faint">
                        {Math.abs(delta) > 0.01 && (
                          <span
                            className="shrink-0 font-mono text-[10px] tabular-nums"
                            style={{
                              color:
                                (r.polarity === 'good-low' ? -delta : delta) > 0
                                  ? PALETTE_HEX.green
                                  : PALETTE_HEX.threat,
                            }}
                          >
                            {delta > 0 ? '▲' : '▼'}
                            {Math.abs(Math.round(delta * 100))}
                          </span>
                        )}
                        <span>{r.note}</span>
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 border border-signal-amber/25 bg-signal-amber/[0.03] p-4">
                <p className="instrument mb-2 text-signal-amber">Read this</p>
                <p className="text-[12.5px] leading-[1.75] text-bone-dim">
                  These are <strong>scores out of 100</strong>, worked out from
                  the dials by rules written into each scenario. They describe how
                  this model behaves. They are not measurements of anything, and
                  they are not predictions about you. The white tick shows where
                  the scenario starts.
                </p>
              </div>
            </div>

            {/* Live explanation */}
            <div className="panel overflow-hidden lg:max-h-[640px]">
              {causalOpen ? (
                <CausalExplorer
                  scenario={scenario}
                  onClose={() => setCausalOpen(false)}
                />
              ) : (
                <div className="max-h-[640px] overflow-y-auto">
                  <ExplanationPanel
                    scenario={scenario}
                    onExplainCause={() => setCausalOpen(true)}
                  />
                </div>
              )}
            </div>
          </Reveal>

          <div className="mt-16 flex flex-wrap gap-3 border-t border-white/[0.07] pt-10">
            <Link href={`/experience/${scenario.id}`} className="btn btn-primary">
              Run this as a full experience
            </Link>
            <Link href="/network" className="btn">
              Trace the network
            </Link>
            <Link href="/science" className="btn">
              How this is modelled
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

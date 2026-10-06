'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { BrainScene } from './BrainScene';
import { RegionInspector } from '@/components/ui/RegionInspector';
import {
  ALL_SYSTEMS,
  CONNECTIONS,
  REGIONS,
  REGION_BY_ID,
  connectionsFor,
  regionName,
} from '@/lib/brain/atlas';
import { PALETTE_HEX, CATEGORY_COLOR } from '@/lib/visualization/palette';
import { rig } from '@/lib/visualization/cameraRig';
import { resetRenderState } from '@/lib/visualization/renderState';
import { useBrainStore } from '@/store/brainStore';
import { useSimStore } from '@/store/simulationStore';
import { useFraming } from '@/lib/visualization/useFraming';

/**
 * Network mode.
 *
 * Anatomy recedes almost entirely and the brain becomes nodes and pathways.
 * Searching a *function* rather than a name is the point — "memory" should light
 * up the memory network, not one region whose label contains the word, which is
 * why the search indexes the functional systems each region participates in.
 */

const SUGGESTED = [
  'memory',
  'attention',
  'movement',
  'prediction',
  'arousal',
  'language',
  'threat',
  'value',
];

export function NetworkMode() {
  const query = useBrainStore((s) => s.query);
  const setQuery = useBrainStore((s) => s.setQuery);
  const matches = useBrainStore((s) => s.matches);
  const isolated = useBrainStore((s) => s.isolated);
  const isolate = useBrainStore((s) => s.isolate);
  const selected = useBrainStore((s) => s.selected);
  const select = useBrainStore((s) => s.select);
  const setLens = useBrainStore((s) => s.setLens);
  const reset = useBrainStore((s) => s.reset);
  const loadScenario = useSimStore((s) => s.loadScenario);
  const [showPaths, setShowPaths] = useState(false);
  const [systemsOpen, setSystemsOpen] = useState(false);

  // Search rail on the left, inspector on the right: tell the camera so the
  // brain sits in the gap rather than behind one of them.
  useFraming({ left: 360, right: selected ? 364 : 0, top: 56 });

  useEffect(() => {
    reset();
    resetRenderState();
    loadScenario('');
    useSimStore.setState({ scenarioId: null });
    setLens('network');
    rig.overview(1.4);
  }, [reset, setLens, loadScenario]);

  /** Pathways entirely inside the current match set — the highlighted paths. */
  const internalPaths = useMemo(() => {
    if (matches.length === 0) return [];
    const set = new Set(matches);
    return CONNECTIONS.filter((c) => set.has(c.source) && set.has(c.target));
  }, [matches]);

  const selectedLinks = useMemo(
    () => (selected ? connectionsFor(selected) : []),
    [selected],
  );

  return (
    <div className="relative min-h-dvh lg:h-dvh lg:overflow-hidden">
      <h1 className="sr-only">
        Network mode — search the brain by function
      </h1>

      <div className="relative h-[52vh] lg:absolute lg:inset-0 lg:h-auto">
        <BrainScene scrollable />
        <div className="vignette pointer-events-none absolute inset-0" aria-hidden />
      </div>

      {/*
        A narrow rail on the left rather than a wide block across the middle of
        the canvas. The centre of the screen belongs to the brain.
      */}
      <div className="pointer-events-none absolute left-4 right-4 top-[72px] z-20 lg:right-auto lg:w-[344px]">
        <div className="pointer-events-auto w-full">
          <div className="panel p-3">
            <label htmlFor="net-search" className="instrument mb-2 block">
              Search a function
            </label>
            <input
              id="net-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="memory · attention · movement · prediction"
              className="w-full border border-white/[0.12] bg-void-800 px-3 py-2 text-[13px]
                         text-bone placeholder:text-bone-faint focus:border-signal-cyan focus:outline-none"
            />

            <div className="mt-2.5 flex flex-wrap gap-1">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQuery(query === s ? '' : s)}
                  aria-pressed={query === s}
                  className={clsx(
                    'border px-2 py-1 font-mono text-[9px] uppercase tracking-instrument transition-colors',
                    query === s
                      ? 'border-signal-cyan/50 bg-signal-cyan/[0.1] text-signal-cyan'
                      : 'border-white/[0.09] text-bone-faint hover:border-white/25',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            {matches.length > 0 && (
              <div className="mt-3 border-t border-white/[0.07] pt-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="instrument-sm">
                    {matches.length} regions · {internalPaths.length} pathways
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPaths((v) => !v)}
                    className="font-mono text-[9px] uppercase tracking-instrument text-bone-faint hover:text-bone"
                  >
                    {showPaths ? 'Hide paths' : 'Show paths'}
                  </button>
                </div>

                <ul className="max-h-[26vh] space-y-px overflow-y-auto">
                  {matches.map((id) => {
                    const r = REGION_BY_ID.get(id);
                    if (!r) return null;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => {
                            select(id);
                            rig.focusRegion(id);
                          }}
                          className="flex w-full items-baseline gap-2 px-1 py-1 text-left transition-colors hover:bg-white/[0.03]"
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: PALETTE_HEX[r.color] }}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate text-[12px] text-bone-dim">
                            {r.name}
                          </span>
                          <span className="shrink-0 font-mono text-[8.5px] uppercase tracking-wider2 text-bone-faint">
                            {r.category}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {showPaths && internalPaths.length > 0 && (
                  <ul className="mt-2 max-h-[18vh] space-y-1 overflow-y-auto border-t border-white/[0.07] pt-2">
                    {internalPaths.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-baseline gap-2 text-[11px] text-bone-faint"
                      >
                        <span className="font-mono text-[9px]">
                          {c.direction === 'bidirectional' ? '↔' : '→'}
                        </span>
                        <span className="flex-1 truncate">
                          {regionName(c.source)} → {regionName(c.target)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {query.trim().length >= 2 && matches.length === 0 && (
              <p className="mt-3 border-t border-white/[0.07] pt-2.5 text-[11.5px] text-bone-faint">
                No systems match that. The atlas indexes {ALL_SYSTEMS.length}{' '}
                functional systems — try one of the suggestions above.
              </p>
            )}
          </div>
        </div>
      </div>

      {/*
        One inspector instance, repositioned by breakpoint. Rendering it twice
        and hiding one would put two "close inspector" buttons and two copies of
        every disclosure into the document.
      */}
      {selected && (
        <aside className="relative z-20 border-t border-white/[0.07] bg-void-900 lg:absolute lg:bottom-4 lg:right-4 lg:top-[72px] lg:w-[348px] lg:border-t-0 lg:bg-transparent">
          <div className="lg:border lg:border-white/[0.07] lg:bg-void-900/70 lg:backdrop-blur-md lg:h-full lg:overflow-hidden">
            <RegionInspector />
          </div>
        </aside>
      )}

      {/*
        Collapsed by default. Forty-plus system chips permanently expanded in
        the corner took up a third of the canvas for a control most visits never
        touch.
      */}
      <aside className="absolute bottom-4 left-4 z-20 hidden w-[246px] lg:block">
        <div className="panel overflow-hidden">
          <button
            type="button"
            onClick={() => setSystemsOpen((v) => !v)}
            aria-expanded={systemsOpen}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5"
          >
            <span className="instrument">Isolate a system</span>
            <span
              className={clsx(
                'font-mono text-[9px] text-signal-cyan transition-transform',
                !systemsOpen && 'rotate-180',
              )}
              aria-hidden
            >
              ▾
            </span>
          </button>
          <div
            className={clsx(
              'overflow-y-auto border-t border-white/[0.07] p-2',
              systemsOpen ? 'max-h-[34vh]' : 'hidden',
            )}
          >
            <div className="flex flex-wrap gap-1">
              {ALL_SYSTEMS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => isolate(isolated === s ? null : s)}
                  aria-pressed={isolated === s}
                  className={clsx(
                    'border px-1.5 py-1 font-mono text-[8.5px] uppercase tracking-instrument transition-colors',
                    isolated === s
                      ? 'border-white/35 bg-white/[0.07] text-bone'
                      : 'border-white/[0.08] text-bone-faint hover:border-white/25',
                  )}
                >
                  {s.replace(/-/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile summary, shown only when nothing is selected. */}
      {!selected && (
        <div className="relative z-10 border-t border-white/[0.07] bg-void-900 lg:hidden">
          <div className="p-5">
            <p className="instrument mb-3">Network mode</p>
            <p className="prose-sci">
              {REGIONS.length} regions, {CONNECTIONS.length} conceptual pathways.
              Search a function above to isolate the systems involved, or tap a
              node in the scene.
            </p>
            <Link href="/experience" className="btn mt-4 w-full">
              See a network in action
            </Link>
          </div>
        </div>
      )}

      {/* Selected-region pathway summary */}
      {selected && selectedLinks.length > 0 && (
        <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 font-mono text-[9px] uppercase tracking-wider2 text-bone-faint lg:block">
          {regionName(selected)} — {selectedLinks.length} pathways ·{' '}
          <span style={{ color: PALETTE_HEX[CATEGORY_COLOR[REGION_BY_ID.get(selected)?.category ?? 'visual'] ?? 'cyan'] }}>
            {REGION_BY_ID.get(selected)?.category}
          </span>
        </p>
      )}
    </div>
  );
}

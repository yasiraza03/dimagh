'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { BrainScene } from './BrainScene';
import { BrainLens } from '@/components/ui/BrainLens';
import { RegionInspector } from '@/components/ui/RegionInspector';
import { CATEGORY_ORDER, REGIONS, regionsByCategory } from '@/lib/brain/atlas';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import { rig } from '@/lib/visualization/cameraRig';
import { resetRenderState } from '@/lib/visualization/renderState';
import { useBrainStore } from '@/store/brainStore';
import { useSimStore } from '@/store/simulationStore';
import { useBottomChrome } from '@/lib/visualization/bottomChrome';
import { useFraming } from '@/lib/visualization/useFraming';

/**
 * The brain viewer.
 *
 * No scenario is loaded here, so the driver falls back to its idle generator and
 * the brain keeps a slow, wandering baseline — a brain at rest is still a brain
 * doing something, and showing it frozen would be the wrong lesson.
 */
export function BrainViewer() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(true);
  const selected = useBrainStore((s) => s.selected);
  const select = useBrainStore((s) => s.select);
  const hovered = useBrainStore((s) => s.hovered);
  const hover = useBrainStore((s) => s.hover);
  const setLens = useBrainStore((s) => s.setLens);
  const reset = useBrainStore((s) => s.reset);
  const loadScenario = useSimStore((s) => s.loadScenario);

  useBottomChrome(0);
  // Keep the brain in the gap between the atlas rail and the inspector.
  useFraming({ left: open ? 302 : 58, right: selected ? 364 : 0, top: 56 });

  useEffect(() => {
    reset();
    resetRenderState();
    // Clearing the scenario is what puts the driver into idle mode.
    loadScenario('');
    useSimStore.setState({ scenarioId: null });
    setLens('anatomy');
    rig.overview(1.2);
  }, [reset, setLens, loadScenario]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return regionsByCategory()
      .map((g) => ({
        ...g,
        regions: needle
          ? g.regions.filter((r) =>
              [r.name, r.abbr, r.summary, ...r.systems].join(' ').toLowerCase().includes(needle),
            )
          : g.regions,
      }))
      .filter((g) => g.regions.length > 0);
  }, [query]);

  const matchCount = groups.reduce((n, g) => n + g.regions.length, 0);

  return (
    <div className="relative h-dvh overflow-hidden">
      {/* A canvas-first page still owes the document a single heading. The
          visible framing lives in the hint panel below, which is dismissible. */}
      <h1 className="sr-only">Brain viewer — interactive 3D region atlas</h1>

      <BrainScene />
      <div className="vignette pointer-events-none absolute inset-0" aria-hidden />

      {/* Region browser */}
      <aside
        className={clsx(
          'absolute left-0 top-14 z-20 flex h-[calc(100dvh-3.5rem)] flex-col border-r border-white/[0.07]',
          'bg-void-900/95 transition-all duration-300 ease-cine',
          open ? 'w-[286px]' : 'w-[42px]',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-white/[0.07] px-3"
        >
          {open && <span className="instrument">Atlas — {REGIONS.length}</span>}
          <span className="font-mono text-[10px] text-signal-cyan" aria-hidden>
            {open ? '‹' : '›'}
          </span>
          {!open && <span className="sr-only">Open region atlas</span>}
        </button>

        {open && (
          <>
            <div className="shrink-0 border-b border-white/[0.07] p-2.5">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search regions or functions"
                aria-label="Search regions"
                className="w-full border border-white/[0.1] bg-void-800 px-2.5 py-1.5 text-[12px]
                           text-bone placeholder:text-bone-faint focus:border-signal-cyan focus:outline-none"
              />
              {query && (
                <p className="mt-1.5 font-mono text-[9px] uppercase tracking-wider2 text-bone-faint">
                  {matchCount} match{matchCount === 1 ? '' : 'es'}
                </p>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {groups.map((g) => (
                <div key={g.category} className="border-b border-white/[0.04]">
                  <p className="instrument-sm sticky top-0 z-10 bg-void-900/95 px-3 py-1.5 backdrop-blur-sm">
                    {g.category}
                  </p>
                  <ul>
                    {g.regions.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => {
                            select(r.id);
                            rig.focusRegion(r.id);
                          }}
                          onMouseEnter={() => hover(r.id)}
                          onMouseLeave={() => hover(null)}
                          className={clsx(
                            'flex w-full items-baseline gap-2 border-l-2 px-3 py-1.5 text-left transition-colors',
                            selected === r.id
                              ? 'bg-white/[0.05]'
                              : hovered === r.id
                                ? 'border-transparent bg-white/[0.02]'
                                : 'border-transparent',
                          )}
                          style={
                            selected === r.id
                              ? { borderColor: PALETTE_HEX[r.color] }
                              : undefined
                          }
                        >
                          <span
                            className="w-[38px] shrink-0 font-mono text-[9px] uppercase tracking-wider2"
                            style={{ color: PALETTE_HEX[r.color] }}
                          >
                            {r.abbr}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={clsx(
                                'block truncate text-[12px]',
                                selected === r.id ? 'text-bone' : 'text-bone-dim',
                              )}
                            >
                              {r.name}
                            </span>
                            <span className="mt-0.5 block truncate text-[10.5px] text-bone-faint">
                              {r.summary}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {matchCount === 0 && (
                <p className="p-4 text-[12px] text-bone-faint">
                  Nothing matches &ldquo;{query}&rdquo;. Try a function rather than a
                  name — &ldquo;memory&rdquo;, &ldquo;attention&rdquo;,
                  &ldquo;arousal&rdquo;.
                </p>
              )}
            </div>
          </>
        )}
      </aside>

      {/* Inspector */}
      {selected && (
        <aside className="absolute right-4 top-[72px] bottom-4 z-20 w-[348px] max-w-[calc(100vw-2rem)]">
          <div className="panel h-full overflow-hidden">
            <RegionInspector />
          </div>
        </aside>
      )}

      {/* Lens — tracks the atlas rail so it never floats over or away from it. */}
      <div
        className={clsx(
          'absolute bottom-4 z-20 hidden transition-[left] duration-300 ease-cine md:block',
          open ? 'left-[302px]' : 'left-[58px]',
        )}
      >
        <BrainLens />
      </div>

      {/* Hint */}
      {!selected && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center px-4">
          <div className="panel pointer-events-auto max-w-md px-4 py-3 text-center">
            <p className="instrument mb-1.5" aria-hidden>Brain viewer</p>
            <p className="text-[12px] leading-[1.6] text-bone-dim">
              Drag to turn it, scroll to zoom. Click any part — on the brain or
              in the list — to find out what it does.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

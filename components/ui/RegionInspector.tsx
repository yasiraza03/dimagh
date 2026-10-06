'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { connectionsFor, region, regionName } from '@/lib/brain/atlas';
import { SCENARIO_BY_ID } from '@/lib/simulation/scenarios';
import { PALETTE_HEX, PALETTE_TEXT_CLASS } from '@/lib/visualization/palette';
import { rig } from '@/lib/visualization/cameraRig';
import { useBrainStore } from '@/store/brainStore';
import { useUIStore } from '@/store/uiStore';
import { Disclosure } from './primitives';

/**
 * The region inspector.
 *
 * Opens on any click in the 3D view. The section order is fixed across all 35
 * regions — what it does, why it matters, connected systems, see it in action,
 * science — so the panel teaches a consistent way of thinking about a region
 * rather than presenting a grab-bag of facts.
 *
 * "Caveat" is a first-class field, not a footnote: every region entry states
 * what our abstraction of it hides.
 */
export function RegionInspector() {
  const selected = useBrainStore((s) => s.selected);
  const close = useBrainStore((s) => s.select);
  const isolate = useBrainStore((s) => s.isolate);
  const isolated = useBrainStore((s) => s.isolated);
  const scienceMode = useUIStore((s) => s.scienceMode);

  const r = selected ? region(selected) : undefined;

  const links = useMemo(
    () => (selected ? connectionsFor(selected) : []),
    [selected],
  );

  const scenarios = useMemo(
    () =>
      (r?.scenarios ?? [])
        .map((id) => SCENARIO_BY_ID.get(id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    [r],
  );

  if (!r) return null;

  const accent = PALETTE_HEX[r.color];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: accent }}
              aria-hidden
            />
            <span className="instrument">{r.category}</span>
            <span className="font-mono text-[9px] uppercase tracking-wider2 text-bone-faint/70">
              {r.lateralized}
            </span>
          </p>
          <h2 className="display-md mt-2 text-bone">{r.name}</h2>
          <p className={`mt-1 font-mono text-[10px] tracking-instrument ${PALETTE_TEXT_CLASS[r.color]}`}>
            {r.abbr}
          </p>
        </div>
        <button type="button" onClick={() => close(null)} className="btn-icon shrink-0">
          <span className="sr-only">Close region inspector</span>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-4">
          <p className="text-[13.5px] italic leading-[1.6] text-bone">{r.summary}</p>
        </div>

        <div className="space-y-0 px-4 pb-4">
          <Disclosure summary="What it does" defaultOpen>
            <p className="prose-sci">{r.role}</p>
          </Disclosure>

          <Disclosure summary="Why it matters" defaultOpen>
            <p className="prose-sci">{r.why}</p>
          </Disclosure>

          <Disclosure summary={`Functional systems — ${r.systems.length}`}>
            <p className="mb-3 text-[11px] leading-relaxed text-bone-faint">
              No region does one thing. These are the systems this one participates
              in; click to isolate a system across the whole brain.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {r.systems.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => isolate(isolated === s ? null : s)}
                  aria-pressed={isolated === s}
                  className={
                    isolated === s
                      ? 'border border-white/35 bg-white/[0.07] px-2 py-1 font-mono text-[9.5px] uppercase tracking-instrument text-bone'
                      : 'border border-white/[0.1] px-2 py-1 font-mono text-[9.5px] uppercase tracking-instrument text-bone-faint transition-colors hover:border-white/30 hover:text-bone-dim'
                  }
                >
                  {s.replace(/-/g, ' ')}
                </button>
              ))}
            </div>
          </Disclosure>

          <Disclosure summary={`Connected systems — ${links.length}`}>
            <ul className="space-y-1.5">
              {links.map((c) => {
                const other = c.source === r.id ? c.target : c.source;
                const inbound = c.target === r.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        close(other);
                        rig.focusRegion(other);
                      }}
                      className="group w-full border-l-2 border-transparent py-1 pl-2.5 text-left
                                 transition-colors hover:border-white/25 hover:bg-white/[0.02]"
                    >
                      <span className="flex items-baseline gap-2">
                        <span
                          className="font-mono text-[9px] uppercase tracking-wider2 text-bone-faint"
                          aria-label={inbound ? 'incoming' : 'outgoing'}
                        >
                          {c.direction === 'bidirectional' ? '↔' : inbound ? '←' : '→'}
                        </span>
                        <span className="flex-1 text-[12px] text-bone-dim group-hover:text-bone">
                          {regionName(other)}
                        </span>
                        <span className="font-mono text-[8.5px] uppercase tracking-wider2 text-bone-faint/70">
                          {c.category}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-bone-faint">
                        {c.explanation}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Disclosure>

          {scenarios.length > 0 && (
            <Disclosure summary="See it in action" defaultOpen>
              <div className="space-y-1.5">
                {scenarios.map((s) => (
                  <Link
                    key={s.id}
                    href={`/experience/${s.id}`}
                    className="group flex items-baseline justify-between gap-3 border border-white/[0.08]
                               px-3 py-2 transition-colors hover:border-white/25"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-[10px] uppercase tracking-instrument text-bone-dim group-hover:text-bone">
                        {s.code}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-bone-faint">
                        {s.title}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[9px] text-bone-faint">
                      {s.estimate}
                    </span>
                  </Link>
                ))}
              </div>
            </Disclosure>
          )}

          <Disclosure summary="Science — what this simplifies" defaultOpen={scienceMode}>
            <p className="prose-sci mb-3">{r.caveat}</p>
            <p className="text-[11px] leading-relaxed text-bone-faint">
              The position and shape of this region in the 3D view are
              anatomically inspired, not anatomically measured. Activity shown on
              it is generated by the active scenario file.
            </p>
          </Disclosure>
        </div>
      </div>

      <div className="flex gap-2 border-t border-white/[0.07] p-3">
        <button
          type="button"
          onClick={() => rig.focusRegion(r.id)}
          className="btn flex-1"
        >
          Frame
        </button>
        <button
          type="button"
          onClick={() => rig.zoomMicroscopic(r.id)}
          className="btn flex-1"
          title="Dive inside toward a microscopic abstraction"
        >
          Dive in
        </button>
      </div>
    </div>
  );
}

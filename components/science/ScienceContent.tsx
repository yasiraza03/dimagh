'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { SCENARIOS } from '@/lib/simulation/scenarios';
import { ALL_SYSTEMS, CONNECTIONS, REGIONS } from '@/lib/brain/atlas';
import { TierChip } from '@/components/ui/primitives';
import { useUIStore } from '@/store/uiStore';
import { Reveal, useScrollSystem } from '@/components/ui/Reveal';
import type { ScienceNote } from '@/lib/simulation/types';

/**
 * The science page.
 *
 * Every claim in the product, collected in one place and sorted by how well
 * established it is. This page is the project's warrant: a visualisation this
 * confident-looking has an obligation to show its own uncertainty, and to make
 * the KNOWN / SIMPLIFIED / CONCEPTUAL distinction inspectable rather than
 * decorative.
 */

type Tier = ScienceNote['tier'] | 'all';

const TIERS: Array<{ id: Tier; label: string; blurb: string }> = [
  { id: 'all', label: 'Everything', blurb: 'Every claim across all eleven scenarios.' },
  {
    id: 'known',
    label: 'Known',
    blurb: 'Well established in the literature and not seriously contested.',
  },
  {
    id: 'simplified',
    label: 'Simplified',
    blurb: 'Real, but compressed, idealised or stretched in time so it can be watched.',
  },
  {
    id: 'conceptual',
    label: 'Conceptual',
    blurb: 'A model, framing or visual device — not a settled mechanism.',
  },
];

const PRINCIPLES = [
  {
    n: '01',
    title: 'Nothing here is measured',
    body: 'Every number, bar and glow here comes from a script written into this project. Nothing was recorded from a brain, nothing is worked out about you, and no number is a real measurement. Where something looks like a readout from a machine, it is a made-up score on a made-up scale — and we say so right next to it.',
  },
  {
    n: '02',
    title: 'No region does one thing',
    body: 'Every one of the 35 parts lists several jobs it takes part in — never just one — plus a note on what we left out. We never say the amygdala is the fear centre or that the hippocampus stores your memories. Both of those are wrong twice over: those parts do far more than that, and those jobs need far more than those parts.',
  },
  {
    n: '03',
    title: 'Time is stretched',
    body: 'Most of what you see here really happens in a fraction of a second. We stretch it over eight to fourteen seconds so you can follow it. The order of the steps is real. The timings are not, and the neat gaps between stages make the process look much tidier than it is.',
  },
  {
    n: '04',
    title: 'The brain is drawn, not scanned',
    body: 'The 3D brain is drawn by code, not scanned from anyone. The shape and the folds are built to look right rather than to be right, and the positions of the parts are approximate. It is made to be readable and to show activity clearly — not to be anatomically exact.',
  },
  {
    n: '05',
    title: 'Simplification is disclosed, not hidden',
    body: 'Turn on Science mode and the technical detail and the caveats appear everywhere. Every scenario lists what it has compressed. Every brain part says what we left out. And where researchers genuinely disagree, we tell you that instead of quietly picking a side.',
  },
  {
    n: '06',
    title: 'Nothing leaves your device',
    body: 'No account, no sign-in, no tracking of any kind, and no server. The reaction times from the Stroop task, your answers in the memory task, everything — it all stays on your device. Once the page has loaded you can disconnect entirely and it keeps working.',
  },
];

export function ScienceContent() {
  const [tier, setTier] = useState<Tier>('all');
  const [scenarioFilter, setScenarioFilter] = useState<string>('all');
  const scienceMode = useUIStore((s) => s.scienceMode);
  const toggleScienceMode = useUIStore((s) => s.toggleScienceMode);
  useScrollSystem();

  const claims = useMemo(() => {
    return SCENARIOS.flatMap((s) =>
      s.science
        .filter((n) => tier === 'all' || n.tier === tier)
        .filter(() => scenarioFilter === 'all' || s.id === scenarioFilter)
        .map((n) => ({ ...n, scenario: s })),
    );
  }, [tier, scenarioFilter]);

  const counts = useMemo(() => {
    const all = SCENARIOS.flatMap((s) => s.science);
    return {
      total: all.length,
      known: all.filter((n) => n.tier === 'known').length,
      simplified: all.filter((n) => n.tier === 'simplified').length,
      conceptual: all.filter((n) => n.tier === 'conceptual').length,
    };
  }, []);

  const references = useMemo(() => {
    const map = new Map<string, { label: string; note: string; scenarios: string[] }>();
    for (const s of SCENARIOS) {
      for (const r of s.references) {
        const hit = map.get(r.label);
        if (hit) hit.scenarios.push(s.code);
        else map.set(r.label, { ...r, scenarios: [s.code] });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  return (
    <div className="relative min-h-dvh pt-14">
      <div className="grid-fine pointer-events-none absolute inset-0 opacity-50" aria-hidden />

      <div className="relative mx-auto max-w-[1800px] px-6 pb-24 pt-14 sm:px-10 sm:pt-20">
        <p className="instrument mb-5 flex items-center gap-2.5">
          <span className="font-mono text-[10px] text-signal-cyan">06</span>
          Science
        </p>

        <h1 className="display-xl max-w-4xl text-bone">
          What this is,
          <br />
          and what it isn&rsquo;t.
        </h1>

        <p className="mt-8 max-w-2xl text-balance text-[15px] leading-[1.8] text-bone-dim">
          dimagh is a teaching tool. It is built to make one real idea easy to
          see — that seeing, remembering, paying attention and moving are all
          processes with working parts — without pretending to be more precise
          than it is.
        </p>

        {/* Stats */}
        <Reveal
          stagger={0.08}
          className="mt-12 grid gap-px border border-white/[0.07] bg-white/[0.06] sm:grid-cols-4"
        >
          {[
            ['Regions', REGIONS.length],
            ['Pathways', CONNECTIONS.length],
            ['Functional systems', ALL_SYSTEMS.length],
            ['Labelled claims', counts.total],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-void-900 px-4 py-5">
              <p className="font-display text-[30px] font-normal leading-none tabular-nums text-bone">
                {value}
              </p>
              <p className="instrument mt-2">{label}</p>
            </div>
          ))}
        </Reveal>

        {/* Principles */}
        <section className="mt-24">
          <h2 className="display-lg max-w-2xl text-bone">How we handle the science</h2>

          <Reveal
            stagger={0.07}
            y={30}
            className="mt-12 grid gap-x-10 gap-y-12 md:grid-cols-2 xl:grid-cols-3"
          >
            {PRINCIPLES.map((p) => (
              <article key={p.n}>
                <p className="font-mono text-[10px] tracking-instrument text-signal-cyan">
                  {p.n}
                </p>
                <h3 className="mt-3 font-display text-[19px] font-normal leading-tight text-bone">
                  {p.title}
                </h3>
                <p className="mt-3 text-[13.5px] leading-[1.8] text-bone-dim">
                  {p.body}
                </p>
              </article>
            ))}
          </Reveal>
        </section>

        {/* The ledger */}
        <section className="mt-24 border-t border-white/[0.07] pt-14">
          <h2 className="display-lg max-w-2xl text-bone">The evidence ledger</h2>
          <p className="mt-6 max-w-2xl text-[14px] leading-[1.8] text-bone-dim">
            Every claim made anywhere in dimagh, tagged by how sure we are about
            it. {counts.known} solidly established, {counts.simplified} true but
            tidied up, {counts.conceptual} a way of thinking rather than a fact.
          </p>

          <div className="mt-9 flex flex-wrap gap-2">
            {TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTier(t.id)}
                aria-pressed={tier === t.id}
                className={clsx(
                  'border px-3 py-2 font-mono text-[10px] uppercase tracking-instrument transition-colors',
                  tier === t.id
                    ? 'border-white/35 bg-white/[0.06] text-bone'
                    : 'border-white/[0.08] text-bone-faint hover:border-white/25',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <p className="mt-3 text-[12px] text-bone-faint">
            {TIERS.find((t) => t.id === tier)?.blurb}
          </p>

          <div className="mt-6 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setScenarioFilter('all')}
              aria-pressed={scenarioFilter === 'all'}
              className={clsx(
                'border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-instrument transition-colors',
                scenarioFilter === 'all'
                  ? 'border-white/30 bg-white/[0.05] text-bone'
                  : 'border-white/[0.08] text-bone-faint hover:border-white/25',
              )}
            >
              All scenarios
            </button>
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScenarioFilter(s.id)}
                aria-pressed={scenarioFilter === s.id}
                className={clsx(
                  'border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-instrument transition-colors',
                  scenarioFilter === s.id
                    ? 'border-white/30 bg-white/[0.05] text-bone'
                    : 'border-white/[0.08] text-bone-faint hover:border-white/25',
                )}
              >
                {s.code}
              </button>
            ))}
          </div>

          <ul className="mt-9 divide-y divide-white/[0.06] border-y border-white/[0.07]">
            {claims.map((c, i) => (
              <li key={`${c.scenario.id}-${i}`} className="flex flex-col gap-2.5 py-5 sm:flex-row sm:gap-5">
                <div className="flex shrink-0 items-start gap-2.5 sm:w-[170px]">
                  <TierChip tier={c.tier} />
                  <Link
                    href={`/experience/${c.scenario.id}`}
                    className="font-mono text-[9px] uppercase tracking-instrument text-bone-faint
                               transition-colors hover:text-bone"
                  >
                    {c.scenario.code}
                  </Link>
                </div>
                <p className="flex-1 text-[13.5px] leading-[1.8] text-bone-dim">
                  {c.text}
                </p>
              </li>
            ))}
          </ul>

          {claims.length === 0 && (
            <p className="py-8 text-[13px] text-bone-faint">
              No claims match that combination.
            </p>
          )}
        </section>

        {/* References */}
        <section className="mt-24 border-t border-white/[0.07] pt-14">
          <h2 className="display-lg max-w-2xl text-bone">Where to read further</h2>
          <p className="mt-6 max-w-2xl text-[14px] leading-[1.8] text-bone-dim">
            These point at areas of research, not at specific papers. dimagh is a
            teaching tool, not a textbook — treat this as a map of where to start
            looking, and go to the real research for anything that matters to you.
          </p>

          <Reveal
            stagger={0.05}
            y={24}
            className="mt-12 grid gap-x-10 gap-y-9 md:grid-cols-2 xl:grid-cols-3"
          >
            {references.map((r) => (
              <article key={r.label}>
                <h3 className="font-display text-[15px] font-normal leading-snug text-bone">
                  {r.label}
                </h3>
                <p className="mt-2 text-[12.5px] leading-[1.75] text-bone-faint">
                  {r.note}
                </p>
                <p className="mt-2.5 flex flex-wrap gap-1">
                  {r.scenarios.map((code) => (
                    <span
                      key={code}
                      className="border border-white/[0.08] px-1.5 py-[2px] font-mono text-[8.5px] uppercase tracking-wider2 text-bone-faint"
                    >
                      {code}
                    </span>
                  ))}
                </p>
              </article>
            ))}
          </Reveal>
        </section>

        {/* Not a medical device */}
        <section className="mt-24 border border-signal-amber/25 bg-signal-amber/[0.03] p-6 sm:p-10">
          <p className="instrument mb-4 text-signal-amber">Not a medical device</p>
          <h2 className="display-md max-w-2xl font-normal text-bone">
            This project does not assess, diagnose or measure anything about you.
          </h2>
          <div className="mt-7 grid gap-7 md:grid-cols-2">
            <p className="text-[13.5px] leading-[1.8] text-bone-dim">
              dimagh is not a brain scanner, a test, or a health product. It
              cannot tell you anything about your own brain, and it is not medical
              information. Everything here describes how things typically work in
              a healthy adult — none of it is a model of any condition.
            </p>
            <p className="text-[13.5px] leading-[1.8] text-bone-dim">
              If something here interests you enough to act on, go and read the
              actual research — and talk to a doctor about anything to do with
              your own health. Something like this is a good way to understand how
              a thing works, and a bad way to learn about yourself.
            </p>
          </div>
        </section>

        <div className="mt-16 flex flex-wrap gap-3">
          {!scienceMode && (
            <button type="button" onClick={toggleScienceMode} className="btn btn-primary">
              Turn on science mode
            </button>
          )}
          <Link href="/experience" className="btn">
            Back to the experiences
          </Link>
          <Link href="/brain" className="btn">
            Open the brain viewer
          </Link>
        </div>
      </div>
    </div>
  );
}

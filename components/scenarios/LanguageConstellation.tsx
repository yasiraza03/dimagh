'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useClock } from '@/lib/simulation/useClock';
import { stageAt } from '@/lib/simulation/engine';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import type { Scenario } from '@/lib/simulation/types';

/**
 * The semantic constellation.
 *
 * Nodes appear in the order the scenario reaches them: acoustic form, then
 * competing lexical candidates, then meaning. Clicking a concept traces its
 * links and shows what connects it to the others — so the graph is explorable
 * rather than decorative.
 *
 * Positions are authored for legibility. Distance in this layout is *not* a
 * measured semantic distance, and the panel says so.
 */

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: 'word' | 'form' | 'competitor' | 'concept';
  /** Which concepts this one connects to. */
  links: string[];
  note: string;
}

const NODES: Node[] = [
  {
    id: 'word',
    label: 'ELEPHANT',
    x: 50,
    y: 50,
    kind: 'word',
    links: ['animal', 'size', 'trunk', 'africa', 'india', 'memory', 'sound', 'image'],
    note: 'The selected lexical item. Everything else here was activated by it.',
  },
  { id: 'ele', label: 'ele…', x: 20, y: 18, kind: 'form', links: ['elevator', 'elegant', 'element'], note: 'The acoustic form so far. At this point the word is not yet identified.' },
  { id: 'elevator', label: 'elevator', x: 8, y: 36, kind: 'competitor', links: [], note: 'A competitor consistent with the input so far. It was active, briefly, and then eliminated.' },
  { id: 'elegant', label: 'elegant', x: 12, y: 8, kind: 'competitor', links: [], note: 'Another candidate. You were never aware of it.' },
  { id: 'element', label: 'element', x: 32, y: 6, kind: 'competitor', links: [], note: 'And another. Competition is resolved before anything reaches awareness.' },
  { id: 'animal', label: 'animal', x: 76, y: 24, kind: 'concept', links: ['size', 'trunk'], note: 'Category knowledge. Activating a word activates the class it belongs to.' },
  { id: 'size', label: 'enormous', x: 88, y: 46, kind: 'concept', links: ['animal'], note: 'A salient property. Properties are part of the meaning, not a separate lookup.' },
  { id: 'trunk', label: 'trunk', x: 80, y: 70, kind: 'concept', links: ['image', 'animal'], note: 'A part. Part-whole structure is encoded in the same distributed representation.' },
  { id: 'africa', label: 'Africa', x: 60, y: 84, kind: 'concept', links: ['india'], note: 'Associated places. Which associations surface depends on your own experience.' },
  { id: 'india', label: 'India', x: 40, y: 88, kind: 'concept', links: ['africa'], note: 'Two species, two continents — and both activate from one word.' },
  { id: 'memory', label: 'never forgets', x: 22, y: 70, kind: 'concept', links: [], note: 'An idiom. Cultural associations activate alongside literal ones, and are not flagged as different.' },
  { id: 'sound', label: 'trumpeting', x: 18, y: 48, kind: 'concept', links: ['image'], note: 'Auditory features. Understanding a word about a sound partly engages auditory systems.' },
  { id: 'image', label: 'grey, wrinkled', x: 66, y: 60, kind: 'concept', links: ['trunk', 'sound'], note: 'Visual features. Comprehension partly reuses the machinery for perceiving.' },
];

const KIND_COLOR: Record<Node['kind'], string> = {
  word: PALETTE_HEX.bone,
  form: PALETTE_HEX.amber,
  competitor: '#5a6072',
  concept: PALETTE_HEX.green,
};

/** Which stage each node family becomes visible at. */
const STAGE_ORDER = ['acoustic', 'phono', 'lexical', 'semantic', 'integrate'];

function visibleAt(node: Node, stageId: string): boolean {
  const i = STAGE_ORDER.indexOf(stageId);
  if (node.kind === 'form') return i >= 0;
  if (node.kind === 'competitor') return i >= 2;
  if (node.kind === 'word') return i >= 2;
  return i >= 3;
}

export function LanguageConstellation({ scenario }: { scenario: Scenario }) {
  const { time } = useClock();
  const stage = stageAt(scenario, time);
  const stageId = stage?.id ?? 'acoustic';
  const [focus, setFocus] = useState<string | null>(null);

  const shown = useMemo(
    () => NODES.filter((n) => visibleAt(n, stageId)),
    [stageId],
  );

  const focusNode = focus ? NODES.find((n) => n.id === focus) : null;
  const related = useMemo(() => {
    if (!focusNode) return new Set<string>();
    const s = new Set<string>([focusNode.id, ...focusNode.links]);
    // Links are declared one way; treat the graph as undirected for tracing.
    for (const n of NODES) if (n.links.includes(focusNode.id)) s.add(n.id);
    return s;
  }, [focusNode]);

  const edges = useMemo(() => {
    const out: Array<{ a: Node; b: Node }> = [];
    const byId = new Map(NODES.map((n) => [n.id, n]));
    for (const n of shown) {
      for (const l of n.links) {
        const b = byId.get(l);
        if (b && shown.includes(b)) out.push({ a: n, b });
      }
    }
    return out;
  }, [shown]);

  return (
    <div className="p-4">
      <div className="relative mb-3 h-[172px] overflow-hidden border border-white/[0.06] bg-void-900">
        <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
          {edges.map(({ a, b }, i) => {
            const lit = related.size === 0 || (related.has(a.id) && related.has(b.id));
            return (
              <line
                key={`${a.id}-${b.id}-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={lit ? PALETTE_HEX.green : '#2a3040'}
                strokeWidth={lit ? 0.35 : 0.2}
                opacity={lit ? 0.6 : 0.28}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {shown.map((n) => {
          const dim = related.size > 0 && !related.has(n.id);
          const isWord = n.kind === 'word';
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setFocus(focus === n.id ? null : n.id)}
              aria-pressed={focus === n.id}
              className={clsx(
                'absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap px-1.5 py-0.5',
                'font-mono uppercase tracking-wider2 transition-all duration-500',
                isWord ? 'text-[11px]' : 'text-[8px]',
                dim ? 'opacity-30' : 'opacity-100',
                focus === n.id && 'bg-white/[0.07]',
              )}
              style={{
                left: `${n.x}%`,
                top: `${n.y}%`,
                color: KIND_COLOR[n.kind],
                border: isWord ? `1px solid ${KIND_COLOR.word}44` : undefined,
                textDecoration: n.kind === 'competitor' ? 'line-through' : undefined,
              }}
            >
              {n.label}
            </button>
          );
        })}

        <p className="absolute left-2 top-2 font-mono text-[8px] uppercase tracking-wider2 text-bone-faint">
          {stage?.label ?? 'acoustic input'}
        </p>
      </div>

      {focusNode ? (
        <div>
          <p className="instrument-sm mb-1" style={{ color: KIND_COLOR[focusNode.kind] }}>
            {focusNode.label}
          </p>
          <p className="text-[11.5px] leading-[1.6] text-bone-dim">{focusNode.note}</p>
          <button
            type="button"
            onClick={() => setFocus(null)}
            className="btn mt-2.5 w-full"
          >
            Clear trace
          </button>
        </div>
      ) : (
        <p className="text-[11.5px] leading-[1.6] text-bone-dim">
          Click any node to trace its connections. Struck-through items are
          candidates that were active and then eliminated — you never experienced
          them competing.
        </p>
      )}

      <p className="mt-3 text-[10.5px] leading-relaxed text-bone-faint">
        Positions are chosen for legibility. Distance in this layout is{' '}
        <strong>not</strong> a measured semantic distance, and the associations
        shown are a handful of illustrative ones — real semantic structure is
        high-dimensional and specific to each person.
      </p>
    </div>
  );
}

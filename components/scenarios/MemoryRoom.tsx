'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { clock } from '@/lib/simulation/clock';
import { useSimStore } from '@/store/simulationStore';
import { PALETTE_HEX } from '@/lib/visualization/palette';

/**
 * The memory-formation task.
 *
 * You explore a novel room by attending to objects; each one you look at
 * becomes a stronger memory candidate than the ones you did not. That is the
 * whole argument of the scenario made interactive: encoding is selective, and
 * attention is the selector.
 *
 * The consolidation timeline then shows each candidate's *retrievability*
 * changing — deliberately not shown as a file moving from one place to another.
 */

interface RoomObject {
  id: string;
  label: string;
  x: number;
  y: number;
  /** How intrinsically distinctive this item is. */
  salience: number;
}

const OBJECTS: RoomObject[] = [
  { id: 'lamp', label: 'Brass lamp', x: 16, y: 30, salience: 0.5 },
  { id: 'chair', label: 'Green armchair', x: 36, y: 62, salience: 0.45 },
  { id: 'clock', label: 'Stopped clock', x: 58, y: 22, salience: 0.8 },
  { id: 'books', label: 'Stack of books', x: 74, y: 58, salience: 0.3 },
  { id: 'window', label: 'Rain on the window', x: 88, y: 32, salience: 0.6 },
  { id: 'rug', label: 'Worn red rug', x: 50, y: 82, salience: 0.35 },
  { id: 'cup', label: 'Half-full cup', x: 26, y: 76, salience: 0.25 },
  { id: 'photo', label: 'Framed photograph', x: 68, y: 40, salience: 0.7 },
];

const HORIZONS = [
  { id: 'now', label: 'Now', factor: 1, note: 'Everything is still available, including detail you will not keep.' },
  { id: 'day', label: '1 day', factor: 0.72, note: 'After a night of sleep. Weak candidates have already gone; strong ones are more stable than they were.' },
  { id: 'week', label: '1 week', factor: 0.52, note: 'Specific detail is thinning. What survives is increasingly gist.' },
  { id: 'year', label: '1 year', factor: 0.34, note: 'A few anchors remain, and retrieving them now depends on a different, more distributed set of connections.' },
] as const;

export function MemoryRoom() {
  const params = useSimStore((s) => s.params);
  const [attended, setAttended] = useState<Record<string, number>>({});
  const [created, setCreated] = useState(false);
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]['id']>('now');

  const h = HORIZONS.find((x) => x.id === horizon)!;

  /**
   * Encoding strength per object. Attention is the dominant term, modulated by
   * intrinsic salience, the novelty dial and how much is already being held.
   */
  const strengths = useMemo(() => {
    const out: Record<string, number> = {};
    for (const o of OBJECTS) {
      const looks = attended[o.id] ?? 0;
      const attentionTerm = Math.min(1, looks * 0.42) * (0.5 + params.attention * 0.8);
      const base = o.salience * (0.3 + params.novelty * 0.5);
      const load = 1 - params.memoryLoad * 0.45;
      const distract = 1 - params.distraction * 0.4;
      out[o.id] = Math.max(0, Math.min(1, (base * 0.55 + attentionTerm * 0.75) * load * distract));
    }
    return out;
  }, [attended, params]);

  const retrievability = (id: string) => {
    const s = strengths[id] ?? 0;
    // Strong traces decay far more slowly than weak ones — the curve is not
    // uniform, which is the interesting part.
    const resistance = 0.35 + s * 0.65;
    return Math.max(0, Math.min(1, s * (h.factor + (1 - h.factor) * resistance)));
  };

  const look = (id: string) => {
    setAttended((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  };

  const totalLooks = Object.values(attended).reduce((a, b) => a + b, 0);

  return (
    <div className="p-4">
      {/* The room. */}
      <div className="relative mb-3 h-[150px] overflow-hidden border border-white/[0.06] bg-gradient-to-b from-void-700 to-void-900">
        <div className="grid-fine absolute inset-0 opacity-30" aria-hidden />

        {OBJECTS.map((o) => {
          const s = created ? retrievability(o.id) : (strengths[o.id] ?? 0);
          const looked = (attended[o.id] ?? 0) > 0;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => !created && look(o.id)}
              disabled={created}
              title={o.label}
              className="group absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
              style={{ left: `${o.x}%`, top: `${o.y}%` }}
            >
              <span
                className="block rounded-full transition-all duration-500"
                style={{
                  width: 10 + s * 16,
                  height: 10 + s * 16,
                  background: `${PALETTE_HEX.violet}${Math.round(40 + s * 180)
                    .toString(16)
                    .padStart(2, '0')}`,
                  boxShadow: s > 0.5 ? `0 0 ${s * 18}px ${PALETTE_HEX.violet}66` : undefined,
                }}
              />
              <span
                className={clsx(
                  'pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap',
                  'font-mono text-[8px] uppercase tracking-wider2 transition-opacity',
                  looked || created
                    ? 'text-bone-dim opacity-100'
                    : 'text-bone-faint opacity-0 group-hover:opacity-100',
                )}
              >
                {o.label}
              </span>
            </button>
          );
        })}

        <p className="absolute left-2 top-2 font-mono text-[8px] uppercase tracking-wider2 text-bone-faint">
          {created ? `retrievability — ${h.label}` : 'a room you have not seen before'}
        </p>
      </div>

      {!created ? (
        <>
          <p className="text-[11.5px] leading-[1.6] text-bone-dim">
            Click objects to attend to them. Attend to as many or as few as you
            like — what you do here determines what survives.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCreated(true);
                clock.seek(0);
                clock.play();
              }}
              disabled={totalLooks === 0}
              className="btn btn-primary flex-1"
            >
              Create memory
            </button>
            <span className="instrument-sm shrink-0">{totalLooks} fixations</span>
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 flex gap-1">
            {HORIZONS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setHorizon(x.id)}
                aria-pressed={horizon === x.id}
                className={clsx(
                  'flex-1 border px-1.5 py-1.5 font-mono text-[9px] uppercase tracking-instrument transition-colors',
                  horizon === x.id
                    ? 'border-signal-violet/50 bg-signal-violet/[0.1] text-signal-violet'
                    : 'border-white/[0.09] text-bone-faint hover:border-white/25',
                )}
              >
                {x.label}
              </button>
            ))}
          </div>

          <p className="text-[11.5px] leading-[1.6] text-bone-dim">{h.note}</p>

          <ul className="mt-3 space-y-1">
            {[...OBJECTS]
              .sort((a, b) => retrievability(b.id) - retrievability(a.id))
              .slice(0, 5)
              .map((o) => {
                const r = retrievability(o.id);
                return (
                  <li key={o.id} className="flex items-center gap-2">
                    <span className="w-[108px] shrink-0 truncate text-[11px] text-bone-dim">
                      {o.label}
                    </span>
                    <span className="h-[3px] flex-1 overflow-hidden bg-white/[0.07]">
                      <span
                        className="block h-full transition-[width] duration-700"
                        style={{
                          width: `${Math.round(r * 100)}%`,
                          background: PALETTE_HEX.violet,
                        }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-right font-mono text-[9px] tabular-nums text-bone-faint">
                      {Math.round(r * 100)}
                    </span>
                  </li>
                );
              })}
          </ul>

          <button
            type="button"
            onClick={() => {
              setCreated(false);
              setAttended({});
              setHorizon('now');
              clock.seek(0);
            }}
            className="btn mt-3 w-full"
          >
            Explore again
          </button>
        </>
      )}

      <p className="mt-3 text-[10.5px] leading-relaxed text-bone-faint">
        Nothing here moves from one place to another. The bars show how
        <strong> retrievable</strong> a trace is modelled to be at each horizon —
        a change in what retrieval depends on, not a file being relocated.
      </p>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { PALETTE_HEX } from '@/lib/visualization/palette';

/**
 * The Stroop task.
 *
 * A real two-block experiment with real reaction times, measured in your
 * browser and never transmitted anywhere. Congruent block first, then
 * incongruent, then the two medians compared — which is the actual finding
 * rather than an assertion about it.
 *
 * Medians rather than means, because a single slow trial (a sneeze, a dropped
 * mouse) would otherwise dominate a twelve-trial block.
 */

const COLORS = [
  { name: 'RED', hex: PALETTE_HEX.threat },
  { name: 'BLUE', hex: PALETTE_HEX.blue },
  { name: 'GREEN', hex: PALETTE_HEX.green },
  { name: 'AMBER', hex: PALETTE_HEX.amber },
] as const;

const TRIALS_PER_BLOCK = 12;

type Block = 'congruent' | 'incongruent';
type Phase = 'ready' | 'running' | 'between' | 'done';

interface Trial {
  word: string;
  inkIndex: number;
}

function makeTrial(block: Block): Trial {
  const ink = Math.floor(Math.random() * COLORS.length);
  if (block === 'congruent') {
    return { word: COLORS[ink].name, inkIndex: ink };
  }
  let word = ink;
  while (word === ink) word = Math.floor(Math.random() * COLORS.length);
  return { word: COLORS[word].name, inkIndex: ink };
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function Stroop() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [block, setBlock] = useState<Block>('congruent');
  const [trial, setTrial] = useState<Trial | null>(null);
  const [count, setCount] = useState(0);
  const [rts, setRts] = useState<{ congruent: number[]; incongruent: number[] }>({
    congruent: [],
    incongruent: [],
  });
  const [errors, setErrors] = useState({ congruent: 0, incongruent: 0 });
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const shownAt = useRef(0);

  const nextTrial = useCallback(
    (b: Block) => {
      setTrial(makeTrial(b));
      shownAt.current = performance.now();
    },
    [],
  );

  const startBlock = (b: Block) => {
    setBlock(b);
    setCount(0);
    setPhase('running');
    nextTrial(b);
  };

  const respond = (index: number) => {
    if (phase !== 'running' || !trial) return;
    const rt = performance.now() - shownAt.current;
    const correct = index === trial.inkIndex;

    if (correct) {
      setRts((r) => ({ ...r, [block]: [...r[block], rt] }));
    } else {
      setErrors((e) => ({ ...e, [block]: e[block] + 1 }));
    }
    setFlash(correct ? 'ok' : 'bad');
    window.setTimeout(() => setFlash(null), 140);

    const n = count + 1;
    setCount(n);
    if (n >= TRIALS_PER_BLOCK) {
      setTrial(null);
      setPhase(block === 'congruent' ? 'between' : 'done');
    } else {
      nextTrial(block);
    }
  };

  // Keyboard responses: 1–4 map to the four colours.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i >= 0) {
        e.preventDefault();
        respond(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const mCon = median(rts.congruent);
  const mInc = median(rts.incongruent);
  const cost = mInc - mCon;

  return (
    <div>
      <div
        className={clsx(
          'relative mb-4 flex h-[200px] items-center justify-center overflow-hidden border transition-colors duration-150',
          flash === 'ok'
            ? 'border-signal-green/50'
            : flash === 'bad'
              ? 'border-signal-threat/60'
              : 'border-white/[0.07]',
        )}
        style={{ background: '#05060a' }}
      >
        {phase === 'ready' && (
          <div className="px-6 text-center">
            <p className="font-display text-[18px] text-bone">
              Name the ink colour, not the word
            </p>
            <p className="mt-2 text-[12px] leading-snug text-bone-dim">
              Two blocks of {TRIALS_PER_BLOCK}. Click a colour button or press
              1&ndash;4. Go as fast as you can without making mistakes.
            </p>
          </div>
        )}

        {phase === 'running' && trial && (
          <>
            <p
              className="select-none font-display text-[52px] font-medium tracking-tight"
              style={{ color: COLORS[trial.inkIndex].hex }}
            >
              {trial.word}
            </p>
            <div className="absolute right-2 top-2 font-mono text-[10px] tabular-nums text-bone-faint">
              {count + 1}/{TRIALS_PER_BLOCK}
            </div>
            <div className="absolute left-2 top-2 font-mono text-[9px] uppercase tracking-wider2 text-bone-faint">
              {block} block
            </div>
          </>
        )}

        {phase === 'between' && (
          <div className="px-6 text-center">
            <p className="instrument mb-2">Block 1 complete</p>
            <p className="font-display text-[17px] text-bone">
              Now the word and the ink will disagree
            </p>
            <p className="mt-2 text-[12px] text-bone-dim">
              Same task: name the ink colour.
            </p>
          </div>
        )}

        {phase === 'done' && (
          <div className="w-full px-6">
            <p className="instrument mb-3 text-center">Your result</p>
            <div className="mx-auto max-w-xs space-y-2">
              {(
                [
                  ['Congruent', mCon, PALETTE_HEX.green],
                  ['Incongruent', mInc, PALETTE_HEX.threat],
                ] as const
              ).map(([label, value, color]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-[76px] shrink-0 font-mono text-[9px] uppercase tracking-wider2 text-bone-faint">
                    {label}
                  </span>
                  <span className="h-[4px] flex-1 overflow-hidden bg-white/[0.07]">
                    <span
                      className="block h-full"
                      style={{
                        width: `${Math.min(100, (value / Math.max(mInc, mCon, 1)) * 100)}%`,
                        background: color,
                      }}
                    />
                  </span>
                  <span className="w-[54px] shrink-0 text-right font-mono text-[10px] tabular-nums text-bone-dim">
                    {Math.round(value)}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Response buttons. Order fixed so motor mapping stays constant. */}
      {phase === 'running' && (
        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {COLORS.map((c, i) => (
            <button
              key={c.name}
              type="button"
              onClick={() => respond(i)}
              className="border border-white/[0.12] py-2.5 font-mono text-[10px] uppercase
                         tracking-instrument transition-colors hover:border-white/35"
              style={{ color: c.hex }}
            >
              <span className="block">{c.name}</span>
              <span className="mt-0.5 block text-[8px] text-bone-faint">{i + 1}</span>
            </button>
          ))}
        </div>
      )}

      {phase === 'ready' && (
        <button
          type="button"
          onClick={() => startBlock('congruent')}
          className="btn btn-primary w-full"
        >
          Start block 1
        </button>
      )}
      {phase === 'between' && (
        <button
          type="button"
          onClick={() => startBlock('incongruent')}
          className="btn btn-primary w-full"
        >
          Start block 2
        </button>
      )}
      {phase === 'done' && (
        <button
          type="button"
          onClick={() => {
            setRts({ congruent: [], incongruent: [] });
            setErrors({ congruent: 0, incongruent: 0 });
            setPhase('ready');
          }}
          className="btn w-full"
        >
          Run it again
        </button>
      )}

      {phase === 'done' && (
        <div className="mt-4 border-l-2 border-signal-threat/40 pl-3">
          <p className="text-[12.5px] leading-[1.7] text-bone-dim">
            {cost > 20 ? (
              <>
                The incongruent block cost you{' '}
                <strong className="text-bone">{Math.round(cost)}ms</strong> per
                response. That is the interference, measured on you, just now.
              </>
            ) : cost > -20 ? (
              <>
                Your two medians came out within {Math.abs(Math.round(cost))}ms.
                With only {TRIALS_PER_BLOCK} trials per block that happens — the
                effect is robust across groups, not guaranteed in one short run.
              </>
            ) : (
              <>
                You were faster on the incongruent block, which usually means
                practice gains outweighed interference over this short a run.
              </>
            )}
            {(errors.congruent > 0 || errors.incongruent > 0) && (
              <>
                {' '}
                Errors: {errors.congruent} congruent, {errors.incongruent}{' '}
                incongruent.
              </>
            )}
          </p>
          <p className="mt-2 text-[12px] leading-[1.7] text-bone-faint">
            Reading is automatic. The word&rsquo;s meaning activated whether you
            wanted it or not, it activated a competing response, and resolving that
            competition took measurable time.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-bone-faint">
            Your times were measured in your browser and never left your device.
            They are also not a cognitive assessment — keyboard latency, your
            mouse, and how recently you slept all affect them more than anything
            interesting.
          </p>
        </div>
      )}
    </div>
  );
}

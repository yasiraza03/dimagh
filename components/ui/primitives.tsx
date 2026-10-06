'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { ScienceNote } from '@/lib/simulation/types';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import type { PaletteKey } from '@/lib/brain/types';

/**
 * Shared interface primitives.
 *
 * Kept in one file because they are small, purely presentational, and used
 * everywhere — the alternative is a dozen three-line modules.
 */

/* ------------------------------------------------------------------ */

export function SectionLabel({
  n,
  children,
  className,
}: {
  n?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={clsx('flex items-baseline gap-2.5', className)}>
      {n && <span className="font-mono text-[10px] text-signal-cyan">{n}</span>}
      <span className="instrument">{children}</span>
    </p>
  );
}

export function Hairline({ className }: { className?: string }) {
  return <div className={clsx('h-px w-full bg-white/[0.07]', className)} />;
}

/* ------------------------------------------------------------------ */

/**
 * A labelled bar. Used for every quantity in the product, which is why it
 * always carries a caption slot — an unexplained number in a neuroscience
 * interface reads as a measurement, and nothing here is one.
 */
export function Meter({
  label,
  value,
  caption,
  accent = 'cyan',
  showPercent = true,
  compact = false,
}: {
  label: string;
  /** 0–1. */
  value: number;
  caption?: string;
  accent?: PaletteKey;
  showPercent?: boolean;
  compact?: boolean;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={compact ? 'py-1' : 'py-1.5'}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="instrument truncate text-bone-dim">{label}</span>
        {showPercent && (
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-bone-faint">
            {pct}
          </span>
        )}
      </div>
      <div className="h-[3px] w-full overflow-hidden bg-white/[0.07]">
        <div
          className="h-full transition-[width] duration-500 ease-cine"
          style={{ width: `${pct}%`, background: PALETTE_HEX[accent] }}
        />
      </div>
      {caption && (
        <p className="mt-1.5 text-[10.5px] leading-snug text-bone-faint">{caption}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const TIER_CLASS: Record<ScienceNote['tier'], string> = {
  known: 'tier-known',
  simplified: 'tier-simplified',
  conceptual: 'tier-conceptual',
};

export function TierChip({ tier }: { tier: ScienceNote['tier'] }) {
  return <span className={clsx('tier', TIER_CLASS[tier])}>{tier}</span>;
}

/**
 * The evidence ledger.
 *
 * KNOWN / SIMPLIFIED / CONCEPTUAL is the distinction that separates this from
 * a pretty animation, so it gets a dedicated component used identically in
 * every scenario and on the Science page.
 */
export function ScienceNotes({
  notes,
  title = 'What we know, and what we have simplified',
}: {
  notes: ScienceNote[];
  title?: string;
}) {
  const order: ScienceNote['tier'][] = ['known', 'simplified', 'conceptual'];
  return (
    <div>
      <p className="instrument mb-3">{title}</p>
      <ul className="space-y-2.5">
        {order.flatMap((tier) =>
          notes
            .filter((n) => n.tier === tier)
            .map((n, i) => (
              <li key={`${tier}-${i}`} className="flex gap-2.5">
                <TierChip tier={n.tier} />
                <p className="prose-sci flex-1 text-[12.5px]">{n.text}</p>
              </li>
            )),
        )}
      </ul>
      <p className="mt-4 border-t border-white/[0.07] pt-3 text-[10.5px] leading-relaxed text-bone-faint">
        <span className="text-signal-green">KNOWN</span> — solidly established.{' '}
        <span className="text-signal-amber">SIMPLIFIED</span> — true, but tidied up
        or sped up here. <span className="text-signal-violet">CONCEPTUAL</span> — a
        way of thinking about it, not a settled fact.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  accent,
}: {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
  accent?: PaletteKey;
}) {
  return (
    <details className="group border-t border-white/[0.07]" open={defaultOpen}>
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 py-3
                   font-mono text-[10px] uppercase tracking-instrument text-bone-faint
                   transition-colors hover:text-bone-dim"
      >
        <span style={accent ? { color: PALETTE_HEX[accent] } : undefined}>{summary}</span>
        {/* A chevron, not a plus: rotated 45° a plus becomes an ×, and an × in
            a section header reads as "close this panel". */}
        <span className="shrink-0 transition-transform group-open:rotate-180" aria-hidden>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 3.5L5 7l3.5-3.5" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        </span>
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}

/* ------------------------------------------------------------------ */

export function Chip({
  children,
  accent,
  onClick,
  active,
  title,
}: {
  children: ReactNode;
  accent?: PaletteKey;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      title={title}
      className={clsx(
        'inline-flex items-center gap-1.5 border px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-instrument transition-colors',
        active
          ? 'border-white/35 bg-white/[0.07] text-bone'
          : 'border-white/[0.1] text-bone-faint',
        onClick && !active && 'hover:border-white/30 hover:text-bone-dim',
      )}
    >
      {accent && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: PALETTE_HEX[accent] }}
          aria-hidden
        />
      )}
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */

/** A large editorial section transition, per the typography spec. */
export function EditorialHeading({
  n,
  title,
  quote,
  className,
}: {
  n: string;
  title: string;
  quote?: string;
  className?: string;
}) {
  return (
    <div className={clsx('relative', className)}>
      <p className="font-mono text-[11px] tracking-instrument text-signal-cyan">{n}</p>
      <h2 className="display-lg mt-3 text-bone">{title}</h2>
      {quote && (
        <p className="mt-6 max-w-xl text-balance text-[15px] leading-[1.7] text-bone-dim">
          {quote}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Monospace timecode, e.g. 01.84s. Fixed width so it never reflows. */
export function Timecode({ t, className }: { t: number; className?: string }) {
  const safe = Math.max(0, t);
  return (
    <span className={clsx('font-mono tabular-nums', className)}>
      {safe < 10 ? '0' : ''}
      {safe.toFixed(2)}s
    </span>
  );
}

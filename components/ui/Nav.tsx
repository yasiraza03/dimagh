'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import { ScrollProgress } from './ScrollProgress';

/**
 * Primary navigation, styled as an instrument panel rather than a website
 * header: numbered channels, monospace labels, hairline rules.
 */

const SECTIONS = [
  { n: '01', label: 'Experience', href: '/experience' },
  { n: '02', label: 'Brain', href: '/brain' },
  { n: '03', label: 'Network', href: '/network' },
  { n: '04', label: 'Experiments', href: '/experiments' },
  { n: '05', label: 'Lab', href: '/lab' },
  { n: '06', label: 'Science', href: '/science' },
] as const;

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div className="pointer-events-auto relative border-b border-white/[0.06] bg-void-900/85 backdrop-blur-md">
        <ScrollProgress />
        <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-6 px-4 sm:px-6">
          <Link
            href="/"
            className="group flex shrink-0 items-baseline gap-2"
            aria-label="dimagh home"
          >
            <span className="font-display text-[19px] font-normal tracking-[-0.03em] text-bone">
              dimagh
            </span>
          </Link>

          <nav
            aria-label="Sections"
            className="ml-auto hidden items-center gap-0.5 lg:flex"
          >
            {SECTIONS.map((s) => {
              const active = isActive(s.href);
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'group relative flex items-baseline gap-1.5 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-instrument transition-colors',
                    active ? 'text-bone' : 'text-bone-faint hover:text-bone-dim',
                  )}
                >
                  <span
                    className={clsx(
                      'text-[9px] transition-colors',
                      active ? 'text-signal-cyan' : 'text-bone-faint/60',
                    )}
                  >
                    {s.n}
                  </span>
                  <span>{s.label}</span>
                  <span
                    className={clsx(
                      'absolute inset-x-2 -bottom-px h-px transition-colors',
                      active ? 'bg-signal-cyan' : 'bg-transparent group-hover:bg-white/15',
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="nav-mobile"
            className="btn-icon ml-auto lg:hidden"
          >
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              {open ? (
                <path
                  d="M2 2l10 10M12 2L2 12"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  fill="none"
                />
              ) : (
                <path
                  d="M1 3.5h12M1 7h12M1 10.5h12"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  fill="none"
                />
              )}
            </svg>
          </button>
        </div>

        {open && (
          <nav
            id="nav-mobile"
            aria-label="Sections"
            className="border-t border-white/[0.06] lg:hidden"
          >
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(s.href) ? 'page' : undefined}
                className={clsx(
                  'flex items-baseline gap-3 border-b border-white/[0.04] px-5 py-3.5 font-mono text-[11px] uppercase tracking-instrument',
                  isActive(s.href) ? 'text-bone' : 'text-bone-faint',
                )}
              >
                <span className="text-signal-cyan/70">{s.n}</span>
                {s.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

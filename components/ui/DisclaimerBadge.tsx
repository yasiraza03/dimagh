"use client";

import Link from "next/link";
import { useState } from "react";
import { CLEARS_BOTTOM_CHROME } from "@/lib/visualization/bottomChrome";

/**
 * The standing scientific-positioning indicator.
 *
 * Present on every screen, quiet enough not to compete with the brain, and
 * expandable into the full statement. This is not boilerplate — the whole
 * project's credibility depends on never letting a viewer mistake a
 * scenario-authored animation for a measurement.
 */
export function DisclaimerBadge() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="pointer-events-none fixed left-4 z-[55] max-w-[min(26rem,calc(100vw-5rem))]"
      style={CLEARS_BOTTOM_CHROME}
    >
      {open && (
        <div className="panel pointer-events-auto mb-2 animate-fade-up p-4">
          <p className="instrument mb-2 text-signal-amber">What this is</p>
          <p className="prose-sci mb-2.5">
            dimagh is a <strong>teaching tool</strong>. Everything you see is
            drawn from scripts written into this project. Nothing was recorded
            from a real brain, and nothing here is measuring yours.
          </p>
          <p className="prose-sci mb-2.5">
            It cannot tell you anything about your own brain or your health. No
            number here is a real measurement. Wherever we have simplified
            something, the Science panel says so.
          </p>
          <p className="prose-sci">
            No account, no sign-in, no tracking. Everything runs on your own
            device.
          </p>
          <div className="mt-3 flex gap-2">
            <Link href="/science" className="btn flex-1">
              Read the science
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="pointer-events-auto flex items-center gap-2 border border-white/[0.07] bg-void-900/70
                   px-2.5 py-1.5 text-left backdrop-blur-md transition-colors hover:border-white/20"
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inset-0 rounded-full bg-signal-amber/70" />
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-signal-amber/40" />
        </span>
        <span className="font-mono text-[9px] uppercase leading-tight tracking-wider2 text-bone-faint">
          Educational simulation
        </span>
      </button> */}
    </div>
  );
}

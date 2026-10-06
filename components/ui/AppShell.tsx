'use client';

import { usePathname } from 'next/navigation';
import { useQualityDetection } from '@/lib/visualization/useQuality';
import { Nav } from './Nav';
import { SettingsRail } from './SettingsRail';
import { DisclaimerBadge } from './DisclaimerBadge';

/**
 * Global shell. Deliberately thin: device capability detection, navigation, the
 * settings rail and the standing "educational simulation" disclaimer. Every
 * route is responsible for its own layout below that.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  useQualityDetection();
  const pathname = usePathname();
  // The landing screen owns the whole viewport and supplies its own chrome.
  const isLanding = pathname === '/';

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]
                   focus:border focus:border-signal-cyan focus:bg-void-900 focus:px-4 focus:py-2
                   focus:font-mono focus:text-[11px] focus:uppercase focus:tracking-instrument"
      >
        Skip to content
      </a>

      {!isLanding && <Nav />}

      <main id="main" className="relative">
        {children}
      </main>

      <SettingsRail />
      <DisclaimerBadge />
    </>
  );
}

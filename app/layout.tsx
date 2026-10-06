import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/ui/AppShell';

/**
 * Fonts are self-hosted by next/font at build time, which matters here: the
 * brief requires the experience to keep working if the network disappears after
 * the initial load, so nothing may depend on a font CDN at runtime.
 *
 * All three are loaded as variable fonts (no `weight` array), so the whole
 * 400-700 range is available continuously — the design leans on real weight
 * rather than hairline type, and an optical 450 for body copy needs the
 * variable axis to exist.
 */
const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'dimagh',
    template: '%s — dimagh',
  },
  description:
    'Watch what actually happens inside your brain when you see something, pay attention, remember, get frightened or fall asleep. Interactive, step by step, in plain English. A teaching tool — not a medical device.',
  applicationName: 'dimagh',
  keywords: [
    'neuroscience',
    'brain',
    'interactive simulation',
    'educational visualisation',
    'perception',
    'attention',
    'memory',
    'WebGL',
  ],
  openGraph: {
    title: 'dimagh',
    description:
      'Don’t just show the brain. Show the brain doing something. An interactive, carefully sourced teaching tool — in plain English.',
    type: 'website',
    siteName: 'dimagh',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#040507',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      {/*
        Browser extensions (Grammarly and friends) write attributes onto <body>
        before React hydrates, which React reports as a hydration mismatch it
        cannot patch. Nothing we render differs between server and client here,
        so the warning is suppressed on this element only.
      */}
      <body className="min-h-dvh bg-void-900 antialiased" suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

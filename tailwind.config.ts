import type { Config } from 'tailwindcss';

/**
 * dimagh design tokens.
 *
 * The palette is deliberately narrow: a near-black substrate, warm white type,
 * and a small set of semantic signal colours that always mean the same thing
 * across the whole product (see lib/visualization/palette.ts for the WebGL-side
 * mirror of these values).
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: {
          DEFAULT: '#04050780',
          900: '#040507',
          800: '#070910',
          700: '#0b0e18',
          600: '#111522',
          500: '#1a1f2e',
          400: '#262c3d',
        },
        bone: {
          DEFAULT: '#f2ede4',
          dim: '#b9b3a8',
          faint: '#6f6a62',
        },
        signal: {
          // Mirrors lib/visualization/palette.ts. Monochrome: emphasis comes
          // from luminance, never hue.
          cyan: '#e9eef2',
          threat: '#ffffff',
          amber: '#ded6c9',
          green: '#c9d1cc',
          violet: '#b7b4bd',
          orange: '#cdc5be',
          blue: '#99a0a8',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      letterSpacing: {
        instrument: '0.18em',
        wider2: '0.32em',
      },
      transitionTimingFunction: {
        cine: 'cubic-bezier(0.16, 1, 0.3, 1)',
        instrument: 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        drift: {
          '0%,100%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(0,-6px,0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2.4s ease-out infinite',
        'scan-line': 'scan-line 7s linear infinite',
        drift: 'drift 6s ease-in-out infinite',
        'fade-up': 'fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both',
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'on-surface': '#e2e2e8',
        'primary-fixed-dim': '#c0c1ff',
        'on-surface-variant': '#c7c4d7',
        secondary: '#9fe02a',
        'surface-container-low': '#1a1c20',
        'inverse-primary': '#494bd6',
        'surface-container': '#1e2024',
        'surface-dim': '#111317',
        tertiary: '#c4c7c9',
        'charcoal-black': '#0F1115',
        primary: '#b06bff',
        background: '#111317',
        'surface-container-lowest': '#0c0e12',
        surface: '#111317',
        'inverse-surface': '#e2e2e8',
        'primary-container': '#8083ff',
        outline: '#908fa0',
        error: '#ffb4ab',
        'cyber-lime': '#ADFF2F',
        'surface-variant': '#333539',
        'border-muted': 'rgba(255, 255, 255, 0.08)',
        'electric-indigo': '#b06bff',
        'surface-container-high': '#282a2e',
        'on-background': '#e2e2e8',
        'outline-variant': '#464554',
        'surface-glass': 'rgba(30, 32, 38, 0.7)',
        'surface-container-highest': '#333539',
        'secondary-fixed-dim': '#8fdb00',
        'tertiary-fixed-dim': '#c4c7c9',
        'surface-bright': '#37393e',
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.5rem',
        full: '9999px',
      },
      spacing: {
        'margin-desktop': '64px',
        gutter: '24px',
        'margin-mobile': '16px',
        base: '8px',
        'container-max': '1200px',
      },
      maxWidth: {
        'container-max': '1200px',
      },
      fontFamily: {
        'body-md': ['var(--font-inter)', 'sans-serif'],
        'body-sm': ['var(--font-inter)', 'sans-serif'],
        'code-label': ['var(--font-jetbrains)', 'monospace'],
        // Display headlines use the editorial serif (DESIGN.md). Smaller titles stay sans.
        'headline-lg-mobile': ['var(--font-serif)', 'Georgia', 'serif'],
        'headline-xl': ['var(--font-serif)', 'Georgia', 'serif'],
        'headline-lg': ['var(--font-serif)', 'Georgia', 'serif'],
      },
      fontSize: {
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'code-label': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '500' }],
        // Serif display: a touch tighter line-height + negative tracking, weight 600 so
        // the high-contrast serif holds up on the dark canvas (never heavier).
        'headline-lg-mobile': ['28px', { lineHeight: '32px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'headline-xl': ['48px', { lineHeight: '1.08', letterSpacing: '-0.025em', fontWeight: '600' }],
        'headline-lg': ['32px', { lineHeight: '1.12', letterSpacing: '-0.02em', fontWeight: '600' }],
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
}

export default config

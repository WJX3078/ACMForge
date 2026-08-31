import animate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'hsl(var(--canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'hsl(var(--surface) / <alpha-value>)',
          raised: 'hsl(var(--surface-raised) / <alpha-value>)',
          sunken: 'hsl(var(--surface-sunken) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'hsl(var(--line) / <alpha-value>)',
          strong: 'hsl(var(--line-strong) / <alpha-value>)',
        },
        fg: {
          DEFAULT: 'hsl(var(--fg) / <alpha-value>)',
          muted: 'hsl(var(--fg-muted) / <alpha-value>)',
          subtle: 'hsl(var(--fg-subtle) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'hsl(var(--brand) / <alpha-value>)',
          fg: 'hsl(var(--brand-fg) / <alpha-value>)',
          soft: 'hsl(var(--brand-soft) / <alpha-value>)',
        },
        ok: { DEFAULT: 'hsl(var(--ok) / <alpha-value>)', soft: 'hsl(var(--ok-soft) / <alpha-value>)' },
        warn: { DEFAULT: 'hsl(var(--warn) / <alpha-value>)', soft: 'hsl(var(--warn-soft) / <alpha-value>)' },
        danger: { DEFAULT: 'hsl(var(--danger) / <alpha-value>)', soft: 'hsl(var(--danger-soft) / <alpha-value>)' },
        info: { DEFAULT: 'hsl(var(--info) / <alpha-value>)', soft: 'hsl(var(--info-soft) / <alpha-value>)' },
        think: { DEFAULT: 'hsl(var(--think) / <alpha-value>)', soft: 'hsl(var(--think-soft) / <alpha-value>)' },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.04em' }],
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['12px', { lineHeight: '18px' }],
        base: ['13px', { lineHeight: '20px' }],
        md: ['14px', { lineHeight: '22px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['19px', { lineHeight: '27px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['38px', { lineHeight: '44px' }],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        panel: '0 1px 0 0 hsl(var(--line) / 0.6)',
        lift: '0 12px 32px -12px rgb(0 0 0 / 0.55), 0 0 0 1px hsl(var(--line) / 1)',
        glow: '0 0 0 1px hsl(var(--brand) / 0.35), 0 0 24px -6px hsl(var(--brand) / 0.35)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.55' },
          '70%': { transform: 'scale(1.9)', opacity: '0' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'caret-blink': {
          '0%,70%,100%': { opacity: '1' },
          '20%,50%': { opacity: '0' },
        },
        'grid-drift': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(40px)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(400%)' },
        },
        'log-in': {
          from: { opacity: '0', transform: 'translateX(-4px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.24, 0, 0.38, 1) infinite',
        shimmer: 'shimmer 1.8s infinite',
        'caret-blink': 'caret-blink 1.2s steps(1) infinite',
        'grid-drift': 'grid-drift 14s linear infinite',
        scan: 'scan 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'log-in': 'log-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
        'spin-slow': 'spin-slow 3s linear infinite',
      },
      transitionTimingFunction: {
        forge: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [animate],
}

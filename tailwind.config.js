/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Светлая тёплая палитра в духе Wispr Flow (paper / ink / orange accent)
        paper: '#F5F2EB',
        card: '#FFFFFF',
        line: '#E8E2D6',
        ink: {
          DEFAULT: '#17140F',
          950: '#121110',
          900: '#1C1915',
          800: '#2A2620',
          700: '#3B352C',
          600: '#57503F',
        },
        mute: '#7B7365',
        accent: {
          DEFAULT: '#DD5B0A',
          soft: '#F9EADF',
          deep: '#B34A00',
        },
        // Legacy-имена (использовались в тёмной теме) — теперь тёплые значения,
        // чтобы весь UI читался единообразно
        brand: {
          orange: '#EA7A2B',
          flame: '#DD5B0A',
          rose: '#C2410C',
          violet: '#9A6B3F',
          blue: '#8A7B5E',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        serif: ['Georgia', 'Iowan Old Style', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,20,15,0.05), 0 8px 24px -12px rgba(23,20,15,0.12)',
        pop: '0 12px 32px -8px rgba(23,20,15,0.28)',
        pill: '0 18px 44px -14px rgba(18,17,16,0.55)',
        glow: '0 0 0 1px rgba(221,91,10,0.25), 0 8px 30px -12px rgba(221,91,10,0.45)',
        'glow-sm': '0 4px 16px -6px rgba(221,91,10,0.5)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.45' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        bounceBar: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.3s ease-out both',
        'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
      },
    },
  },
  plugins: [],
}

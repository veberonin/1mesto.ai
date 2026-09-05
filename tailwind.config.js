/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08080b',
          900: '#0c0c10',
          850: '#101016',
          800: '#14141b',
          700: '#1c1c25',
          600: '#262633',
        },
        brand: {
          orange: '#ff8a5c',
          flame: '#ff6b4a',
          rose: '#f43f6e',
          violet: '#8b5cf6',
          blue: '#38bdf8',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'Inter',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        glow: '0 0 60px -12px rgba(255, 107, 74, 0.45)',
        'glow-sm': '0 0 24px -6px rgba(255, 107, 74, 0.4)',
        pill: '0 18px 50px -12px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
        card: '0 12px 40px -18px rgba(0,0,0,0.8)',
      },
      keyframes: {
        blob: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(40px, -60px) scale(1.15)' },
          '66%': { transform: 'translate(-30px, 30px) scale(0.9)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounceBar: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        blob: 'blob 14s ease-in-out infinite',
        'blob-slow': 'blob 22s ease-in-out infinite reverse',
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
        shimmer: 'shimmer 1.6s linear infinite',
        'fade-up': 'fade-up 0.35s ease-out both',
        bounceBar: 'bounceBar 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

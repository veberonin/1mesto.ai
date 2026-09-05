/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wispr: {
          dark: '#090a0f',
          card: '#12141c',
          cardHover: '#1a1d29',
          border: '#222638',
          accent: '#3b82f6',
          accentHover: '#2563eb',
          glow: 'rgba(59, 130, 246, 0.15)',
        }
      }
    },
  },
  plugins: [],
}

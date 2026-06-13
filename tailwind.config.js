/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        surface: '#121212',     // OKX-style elevated card
        elev: '#1A1A1A',        // hover / second elevation
        line: '#2A2A2A',        // hairline borders
        sub: '#909499',         // secondary text
        muted: '#5E6673',       // tertiary text
        accent: '#0070F3',      // legacy accent (landing / checkout)
        up: '#00C76F',          // money-positive (OKX green family)
        down: '#F0454B',        // failure / destructive
        warn: '#FFC54D',
        success: '#10B981',
      },
      borderRadius: {
        '3xl': '32px',
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 15px rgba(0, 112, 243, 0.1)',
        panel: '0 24px 64px rgba(0,0,0,0.55)',
      }
    },
  },
  plugins: [],
}

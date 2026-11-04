import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'nrs-canvas': '#FFFFFF',
        'nrs-ink': '#141210',
        'nrs-panel': '#F1EDE6',
        'nrs-black': '#141210',
        'nrs-ivory': '#F7F5F1',
        'nrs-warm-white': '#F7F5F1',
        'nrs-champagne': '#DDD6CA',
        'nrs-beige': '#D2B48C',
        'nrs-charcoal': '#141210',
        'nrs-gold': '#76706A',
        'nrs-rosegold': '#76706A',
        'nrs-gray': '#76706A',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Bodoni Moda', 'Didot', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Jost', 'Futura', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-arabic)', 'Noto Naskh Arabic', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config

import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'nrs-canvas': '#F7F3EE',
        'nrs-ink': '#050505',
        'nrs-panel': '#EAE6DF',
        'nrs-black': '#050505',
        'nrs-ivory': '#F7F3EE',
        'nrs-warm-white': '#FAF9F6',
        'nrs-champagne': '#E7DCD3',
        'nrs-beige': '#D2B48C',
        'nrs-charcoal': '#1A1A1A',
        'nrs-gold': '#C9A96E',
        'nrs-rosegold': '#B88970',
        'nrs-gray': '#8B817B',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Playfair Display', 'serif'],
        sans: ['var(--font-sans)', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config

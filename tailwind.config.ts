import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'nrs-black': '#050505',
        'nrs-ivory': '#F7F3EE',
        'nrs-offwhite': '#F0EBE3',
        'nrs-rosegold': '#B88970',
        'nrs-gold': '#C9A96E',
        'nrs-gray': '#8B817B',
        'nrs-charcoal': '#1A1A1A',
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

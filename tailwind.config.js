/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,html}',
  ],
  theme: {
    extend: {
      colors: {
        // ── C.R.A.T.E. Design Token System ────────────────────────────────────
        // Provisional palette — override when brand is confirmed by operator.
        'cr-slate':    '#2F3E46', // Core canvas backgrounds and structural surfaces
        'cr-sage':     '#7A9A86', // Growth indicator, POPIA consent confirmation, success
        'cr-coral':    '#E07A5F', // Alert state, primary CTA, active interaction
        'cr-cream':    '#F4F1DE', // Primary foreground reading surfaces
        'cr-charcoal': '#354F52', // Secondary framing boundaries, card borders
      },
      fontFamily: {
        // Proven pair from operational DNA — Nunito for headings, Inter for body
        heading: ['Nunito', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'card':       '0 2px 8px rgba(47, 62, 70, 0.12)',
        'card-hover': '0 8px 24px rgba(47, 62, 70, 0.20)',
        'nav':        '0 1px 4px rgba(47, 62, 70, 0.15)',
        'cta':        '0 4px 14px rgba(224, 122, 95, 0.40)',
      },
      borderRadius: {
        'xl':  '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
}

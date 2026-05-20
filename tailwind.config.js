/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Cores semanticas via CSS variables — definidas em src/index.css
        // (:root = dark, html.light = light). Permite toggle de tema sem
        // mexer em cada componente.
        bg: {
          DEFAULT: 'rgb(var(--bg) / <alpha-value>)',
          soft: 'rgb(var(--bg-soft) / <alpha-value>)',
          card: 'rgb(var(--bg-card) / <alpha-value>)',
          elev: 'rgb(var(--bg-elev) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          soft: 'rgb(var(--border-soft) / <alpha-value>)',
        },
        // Laranja (Tailwind orange) como cor principal
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        success: '#16a34a',
        warning: '#eab308',
        danger: '#ef4444',
        muted: {
          DEFAULT: '#71717a',
          soft: '#a1a1aa',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04)',
      },
      borderRadius: {
        xl: '0.9rem',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
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
        // Navy profundo como cor principal (domus.agn — premium sobria)
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#4f6ad8',
          600: '#2f4bb7',
          700: '#1E3A8A',
          800: '#172e6b',
          900: '#111f4d',
        },
        // Accent dourado suave — para destaques, badges premium
        accent: {
          50: '#fdf7ec',
          100: '#faedcf',
          200: '#f2d99a',
          300: '#e6c176',
          400: '#d4a574',
          500: '#c48b52',
          600: '#a26f3f',
          700: '#7d5530',
          800: '#5a3d22',
          900: '#3d2917',
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

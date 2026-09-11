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
        // Violet como cor principal (domus.agn — contemporaneo tech).
        // Diferencia do "SaaS bancario" (azul) e diz "moderno" sem
        // ser hype-startup-de-IA.
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        // Accent cyan pale — usado com PARCIMONIA em elementos raros
        // (glow em cards premium, hover states destacados). Nao e' pra
        // ser onipresente — o violet e o herói, o cyan e o twist.
        accent: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
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

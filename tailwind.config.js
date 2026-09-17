// Shades claras (50-400) de cada familia viram CSS vars que trocam de
// lado no light mode (ver bloco gerado no fim de src/index.css):
// dark: text-emerald-300 = emerald-300 · light: = emerald-700.
// Assim os ~1.400 usos de text-*-100/200/300/400 ficam legiveis nos dois
// temas sem tocar em componente. 500-950 continuam fixos.
const FAMILIAS_TEMA = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'stone',
]
const shadesTema = (nome) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400].map((s) => [s, `rgb(var(--${nome}-${s}) / <alpha-value>)`]),
  )

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
        ...Object.fromEntries(FAMILIAS_TEMA.map((f) => [f, shadesTema(f)])),
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
          // 50-400 seguem o mesmo flip de tema (vars --brand-*)
          ...shadesTema('brand'),
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
        // Semânticos do design system domus.agn (§6). purple/accent(violet)
        // seguem as escalas 'purple'/'brand' do Tailwind — não viram token
        // flat aqui pra não sobrescrever a escala.
        success: '#22c55e',
        warning: '#f97316',
        danger: '#dc2626',
        info: '#3b82f6',
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

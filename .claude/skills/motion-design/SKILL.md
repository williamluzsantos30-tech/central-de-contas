---
name: motion-design
description: Padrões de animação e transição pro Domus.agn — tempo, easing, coreografia entre elementos, micro-interações (hover, click, skeleton, expand/collapse). Use quando o pedido envolver animação, transição, movimento, feedback de estado (loading spinner, modal aparecer/sumir, card expandir, hover em link). Foco em animação editorial-premium: sutil, funcional, nunca chamativa.
---

# Motion Design — Domus.agn

Filosofia: **motion serve pra guiar atenção e confirmar ação**, nunca pra decorar. Toda animação precisa ter propósito.

Referências: **Linear** (transições sutis mas presentes), **Framer** (easing customizado), **Vercel Dashboard** (skeletons e loaders).

## Escala de tempo

Uma única escala pra a UI inteira. Consistência = premium.

| Uso | Duração | Tailwind |
|---|---|---|
| Hover / focus / cor | **150ms** | `duration-150` |
| Toggle small (chevron, check) | **200ms** | `duration-200` |
| Modal entrar/sair, expandir | **300ms** | `duration-300` |
| Chart animando (uma vez, no load) | **600ms** | custom |

Nunca use `duration-500` ou `duration-700` — fica lento.

## Easing

- **Padrão default:** deixa `transition` sem especificar easing (o CSS usa `ease` = smooth default). Bom pra 90% dos casos.
- **Aparecer / entrar:** `ease-out` — rápido no início, para suave. Usa em modal entering, popover open, toast enter.
- **Sair / fechar:** `ease-in` — acelera pra sumir. Toast dismiss, modal close.
- **Coreografia (in-out):** `ease-in-out` — para tabs slider, layout shift.

**NUNCA** `ease-linear`. Fica robótico.

## Propriedades que animam bem em CSS

Prioridade — animações performáticas em `transform` e `opacity`:

- `opacity` — fade in/out
- `transform: translate` — slide
- `transform: scale` — pop (usar com moderação)
- `transform: rotate` — chevron flip

**Evitar animar:**
- `width` / `height` — causa reflow, trava frames em cards com conteúdo
- `top` / `left` — mesmo problema
- `box-shadow` — repaint caro

Se precisar animar altura (expand/collapse), usa `grid` com `grid-template-rows: 0fr → 1fr` (truque moderno) ou biblioteca como framer-motion.

## Padrões testados no projeto

### 1. Hover em card/botão

```tsx
'transition-colors duration-150 hover:bg-bg-elev hover:border-brand-500/40'
```

**REGRA:** só muda cor. Nunca `hover:scale-105` em card — o layout sacode.

### 2. Focus em input

```tsx
'transition-colors focus:border-brand-500/60 focus:outline-none'
```

Ring sólido é feio no dark theme. Só a borda mudando.

### 3. Chevron expand/collapse

```tsx
<span className={cn('transition-transform duration-200', aberto ? 'rotate-180' : 'rotate-0')}>
  <ChevronDown size={12} />
</span>
```

### 4. Modal enter/exit

Atualmente usamos `fixed inset-0 z-50 bg-black/70` sem animação de enter/exit. **Pra elevar**:

```tsx
// Container overlay
'animate-in fade-in duration-200'

// Card do modal
'animate-in zoom-in-95 slide-in-from-bottom-2 duration-300 ease-out'
```

Precisa do plugin `tailwindcss-animate` (já instalado se subir shadcn) OU do `motion` (framer-motion mais leve).

### 5. Skeleton loading

Pra listas longas (>3 items), skeleton é melhor que "Carregando…":

```tsx
<div className="animate-pulse space-y-2">
  <div className="h-8 rounded bg-bg-elev" />
  <div className="h-8 rounded bg-bg-elev" />
  <div className="h-8 w-3/4 rounded bg-bg-elev" />
</div>
```

`animate-pulse` já vem no Tailwind. `bg-bg-elev` (não `bg-zinc-700`) mantém coerência.

### 6. Copiado! feedback

Depois de `navigator.clipboard.writeText()`:

```tsx
const [copiado, setCopiado] = useState(false)
async function copiar() {
  await navigator.clipboard.writeText(x)
  setCopiado(true)
  setTimeout(() => setCopiado(false), 2000)
}
// Botão troca: <CheckCircle2 /> "Copiado!" (emerald) por 2s
```

Timing: **2 segundos** — suficiente pra o olho registrar sem irritar.

### 7. Chart entrada

Charts SVG (bar chart da Visão Executiva, LTV timeline) devem animar no primeiro render:

```tsx
// Cada bar
<rect ... style={{
  animation: `growUp 600ms ease-out`,
  animationDelay: `${i * 50}ms`,
  transformOrigin: 'bottom',
}} />
```

**Delay em cascata** (`i * 50ms`) é o toque premium. Máximo total 800ms (10 bars * 50ms + 300ms animação).

## Quando NÃO animar

- **KPI numbers:** número não conta up. Só show. Exceção: se for um "wow moment" (novo cliente cadastrado, faturamento bateu meta) — aí sim, animação de contagem.
- **Toggles instantâneos:** checkbox, radio — não devem ter delay.
- **Search results:** aparece imediato. Fade in atrasa a percepção de rápido.
- **Erro:** feedback de erro é SEMPRE instantâneo. Cor vermelha aparece direto.

## Micro-interações premium (a fazer quando pedir polimento)

- **Botão pressed:** `active:scale-[0.98] transition-transform duration-75` — feedback tátil.
- **Item drag:** cursor `grab` / `grabbing` (já usei no `SocialMedia.tsx` reorder de artes).
- **Toast enter:** slide from top-right, `ease-out`, 250ms.
- **Progress bar:** anima a largura em `ease-out`, mas só na mudança (não em loop).
- **Number update:** quando o KPI muda por ação do user (não mudança orgânica), pisca sutil `bg-brand-500/10` por 300ms.

## Motion library — instalação (se precisar)

Não instalar por padrão. Só se surgir necessidade de:
- Coreografia entre múltiplos elementos
- Drag & drop com física
- Gestures avançados

Escolha: **`motion`** (antigo framer-motion) — leve, tree-shakable.

```bash
npm install motion
```

Uso mínimo:
```tsx
import { motion } from 'motion/react'
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} />
```

## Acessibilidade

Sempre respeitar `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Já colocar em `src/index.css` (verifica antes de duplicar).

## Checklist antes de commitar animação

- [ ] Duração dentro da escala (150/200/300ms)
- [ ] Easing coerente com direção (in/out/in-out)
- [ ] Anima só `opacity` e `transform` quando possível
- [ ] Testa em light mode também
- [ ] `prefers-reduced-motion` respeitado
- [ ] Sem `duration-500+` (feels slow)
- [ ] Sem `hover:scale` em card (layout sacode)
- [ ] Feedback instantâneo em erro/click, animação só em transição de estado

---
name: ui-ux-pro-max
description: Inteligência de design pra Domus.agn — paleta emerald/violet, tipografia, escala de espaçamento, contraste, hierarquia, acessibilidade WCAG AA. Use quando estiver decidindo COMO uma tela/componente/modal deve ser (estilos, cores, pares de fonte, pesos, tamanhos, borders, sombras, tokens de tema, semântica de estados success/warning/danger).
---

# UI/UX Pro Max — Domus.agn

Guia de decisões de design pra Central de Contas (Domus.agn). Carrega SEMPRE antes de:

- Criar componente novo (card, modal, botão, badge, tabela)
- Escolher cor/tipografia/espaçamento
- Redesenhar tela existente
- Decidir estados de feedback (loading, empty, error, success)

Se o pedido é "faça mais bonito", "melhore o design", "premium look" — leia isso antes de tocar em CSS.

## Identidade

**Nome:** domus.agn — "a casa da sua agência"  
**Personalidade:** editorial dark, moderno-atemporal (não hype de IA), premium sem ser bancário

Referências visuais: **Linear · Pitch · Craft · Superhuman · Vercel dashboard**.

**Fugir de:** cores primárias saturadas (chumbo/laranja), sombras coloridas, ícones cartoon, gradientes de arco-íris, glassmorphism exagerado, empty states com ilustrações estilo Notion 2020.

## Paleta

Tokens vivem em `tailwind.config.js` + CSS variables em `src/index.css`. Sempre usar tokens, nunca hex hardcoded.

### Cores semânticas (theme-aware)

| Token | Uso |
|---|---|
| `bg` | fundo da página |
| `bg-soft` | seção elevada 1 |
| `bg-card` | cards, modais |
| `bg-elev` | seção elevada 2 (dentro de card) |
| `border` | borda default |
| `border-soft` | divider fino |
| `muted` | text secundário |
| `zinc-100..500` | escala de texto (dark) |

### Brand (emerald — herói)

- `brand-400` `#34d399` — CTA hover, wordmark accent, badges highlight
- `brand-500` `#10b981` — CTA primary, links, focus ring
- `brand-600` `#059669` — CTA pressed, borders enfáticas

### Accent (stone — neutralidade quente)

- `accent-50..100` — off-whites premium, wordmark "domus"
- `accent-200..400` — dividers, borders finas em editorial

### Semânticos

| Estado | Cor | Uso |
|---|---|---|
| success | `emerald-*` | published, approved, saudável, promoter |
| warning | `amber-*` | atenção, revisar, neutro, alerta médio |
| danger | `red-*` | critical, churn, detrator, atrasado, error |
| info | `sky-*` | tempo real, banner informativo, link_publico |
| accent brand | `violet-*` | premium, NPS registrado, responsáveis |

**REGRA CRÍTICA**: se o significado é "saúde do negócio", use SEMPRE **verde** (não brand). Ex: MRR verde, LTV verde, receita crescendo verde. Brand emerald também é verde — coincide, mas semanticamente separe: "brand" = ação do usuário, "success" = estado do negócio.

## Tipografia

- **Sans padrão:** `Inter`. Loading via Google Fonts em `index.html`.
- **Serif (wordmark + títulos editoriais):** `Fraunces` — SEMPRE `font-serif`.
- Tabular numbers: `tabular-nums` em tudo que seja $, %, contagem, KPI.

### Escala de peso

| Uso | Peso | Tamanho comum |
|---|---|---|
| KPI grande | `font-bold` | `text-3xl` a `text-5xl` |
| Título de seção | `font-semibold` | `text-sm` |
| Label uppercase | `font-semibold` `uppercase` `tracking-wider` | `text-[10px]` a `text-[9px]` |
| Body | normal | `text-xs` a `text-sm` |
| Hint / muted | normal | `text-[10px]` a `text-[11px]` |

**REGRA:** labels de coluna e cabeçalhos de seção são SEMPRE `text-[10px] font-semibold uppercase tracking-wider text-muted`. É a assinatura visual da Central.

## Espaçamento

Escala consistente. Nunca invente um valor entre esses:
- Micro gap: `gap-1` (4px), `gap-1.5` (6px)
- Comum: `gap-2` (8px), `gap-3` (12px), `gap-4` (16px)
- Bloco: `gap-5` (20px), `gap-6` (24px)
- Seção: `mt-6`, `mt-8`

Padding de card: `p-3` (compacto), `p-4` (default), `p-5` (destaque).

## Componentes — receitas testadas

### Card básico

```tsx
<div className="rounded-xl border border-border bg-bg-card p-5">
  <div className="mb-4 flex items-center justify-between gap-2">
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-brand-300" />
      <h3 className="text-sm font-semibold text-zinc-100">Título</h3>
    </div>
    {/* actions */}
  </div>
  {/* body */}
</div>
```

### KPI card

- Label pequena em `text-[10px] uppercase tracking-wider text-muted`
- Valor grande `text-2xl` a `text-3xl` tabular-nums
- Sub-texto `text-[10px] text-muted`
- Ícone semântico ao lado da label

### Badge

Sempre com borda + bg com alpha (não sólido):
```tsx
'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium'
```
Cores: `border-{cor}-500/50 bg-{cor}-500/15 text-{cor}-200`.

### Botão de ação (primário)

```tsx
<Button size="sm" onClick={...}>
  <Icon size={12} /> Label
</Button>
```

Nunca `bg-brand-500` sólido puro em botão grande — sempre usa o componente `Button` do `@/components/ui/Button` pra manter consistência.

### Modal

Estrutura padrão:
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
  <div className="w-full max-w-md rounded-xl border border-border bg-bg-card p-5" onClick={(e) => e.stopPropagation()}>
    {/* header com título e X */}
    {/* subtitle text-[11px] text-muted */}
    {/* content */}
    {/* footer com Cancelar + Salvar */}
  </div>
</div>
```

### Estados

- **Loading:** `<p className="py-6 text-center text-xs text-muted">Carregando…</p>`
- **Empty:** border-dashed + centered + hint em muted + CTA opcional
- **Error:** `border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200`
- **Success feedback:** check verde + timeout de 2s

## Acessibilidade

Contraste mínimo AA (4.5:1 texto normal, 3:1 large):

- `text-zinc-100` sobre `bg-bg-card` = 15.6:1 ✓
- `text-muted` (`#a1a1aa`) sobre `bg-bg-card` = 4.8:1 ✓
- `text-[10px] text-muted` sobre `bg-bg-soft` — **cuidado**: 3.9:1 ❌ pra texto normal. OK só pra label/hint.

Ícones interativos SEMPRE têm `title="..."` pra tooltip nativo. Botão só com ícone tem `aria-label`.

Focus visível: `focus:border-brand-500/60 focus:outline-none` — nunca remove outline sem substituir.

## Hierarquia visual

Da mais importante à menos:
1. **Números grandes** (KPIs) — chamam atenção primeiro
2. **Títulos de seção** (font-semibold text-sm)
3. **Ações primárias** (botão brand)
4. **Corpo do conteúdo**
5. **Ações secundárias** (outline)
6. **Labels e hints** (muted)

Nunca competem: se todo mundo é bold e colorido, ninguém se destaca.

## Micro-detalhes que fazem diferença

- **Hover discreto:** `transition-colors` de 150ms, muda border ou bg com alpha baixo. Nunca scale, nunca sombra colorida.
- **Divider entre seções:** `border-t border-border pt-3 mt-3` — nunca linha sólida grossa.
- **Cantos arredondados:** `rounded-md` (6px) em pills/badges, `rounded-lg` (8px) em cards small, `rounded-xl` (12px) em cards principais. Nunca `rounded-full` em cards.
- **Sombras:** só em modais. Cards não têm sombra (borda dá a separação).

## Checklist antes de commitar UI

- [ ] Usa tokens (`bg-bg-card`, `border-border`) e não hex
- [ ] Números em `tabular-nums`
- [ ] Labels em `text-[10px] uppercase tracking-wider text-muted`
- [ ] Cores semânticas coerentes (verde = success, âmbar = atenção, vermelho = crítico, violet = premium)
- [ ] Contraste testado (label muted não sobre bg-soft com fonte tiny)
- [ ] Estados loading/empty/error existem
- [ ] Ícone com `title` ou `aria-label`
- [ ] Botão de fechar (X) em modal usa padrão
- [ ] Nenhum `alert()` — sempre modal ou banner inline
- [ ] Auto-save ou botão explícito? Escolhido conscientemente

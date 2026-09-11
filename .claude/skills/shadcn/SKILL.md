---
name: shadcn
description: Padrões e componentes shadcn/ui adaptados pro Domus.agn — instalação via CLI, customização com tokens do projeto, quais componentes já foram trazidos e onde estão, quando NÃO usar shadcn (ex: componentes complexos que já temos custom). Use quando o pedido envolver adicionar componente novo de UI, quando surgir dúvida se deve criar do zero ou puxar do shadcn, ou quando quiser padronizar comportamento (dropdown, dialog, select, tabs, tooltip).
---

# shadcn/ui — no contexto do Domus.agn

## Status atual no projeto

**Componentes UI próprios** vivem em `src/components/ui/`:
- `Button.tsx` — variants outline/ghost/danger
- `Input.tsx`
- `Select.tsx`
- `Textarea.tsx`
- `Badge.tsx`
- `Card.tsx` + `CardBody`, `CardHeader`, `CardTitle`
- `Modal.tsx`
- `Avatar.tsx`

**Estes NÃO são shadcn oficiais** — foram criados internamente com padrões próprios. Cuidado antes de "atualizar pra shadcn" porque quebra estilo do resto.

## Quando usar shadcn

**Bom uso:**
- Componente complexo que ainda não existe (ex: Dropdown com submenu, Combobox com search, Popover posicionado, Tabs animadas)
- Padrão de acessibilidade que precisa ser sólido (Focus trap em modal, roving tabindex em menu)
- Comportamento que já é chato de implementar (Toast queue, Form validation integrada)

**Mau uso:**
- Substituir Button/Input/Select existentes — quebra padronização
- Adicionar por hype "porque todo mundo usa"
- Trazer componente que a gente usa em 1 lugar só

## Instalação

**NUNCA instale o shadcn CLI globalmente** — sempre via `npx` pra pegar a versão certa:

```bash
npx shadcn@latest init
```

Vai pedir:
- Style: `default` (não use `new-york`, quebra layout)
- Base color: **`Zinc`** — bate com nosso `bg-zinc-*`
- CSS variables: **Yes** — casa com o sistema de tokens que já temos
- import alias for components: `@/components/ui-shadcn` — **CRÍTICO**: NÃO usar `@/components/ui` porque colide com os componentes próprios
- import alias for utils: `@/lib/utils` — já existe (cn function)

## Padrão de nome + pasta

Componente shadcn puxado vai em `src/components/ui-shadcn/*.tsx`. NUNCA sobrescreve os `src/components/ui/*`.

Assim fica claro:
- `import { Button } from '@/components/ui/Button'` — nosso
- `import { Popover } from '@/components/ui-shadcn/popover'` — shadcn

## Customização obrigatória depois de puxar

Ao rodar `npx shadcn@latest add popover`, o componente vem com classes hard-coded. **Antes de commitar:**

1. Troca `bg-background` → `bg-bg-card`
2. Troca `border` → `border-border`  
3. Troca `text-foreground` → `text-zinc-100`
4. Troca `text-muted-foreground` → `text-muted`
5. Adiciona `rounded-xl` em containers principais (padrão nosso, shadcn default é `rounded-md`)
6. Confere sombras: shadcn usa `shadow-md` — trocar por `border border-border` sempre que possível

## Componentes recomendados pra trazer

Se surgir necessidade destas features, PUXAR do shadcn:

| Componente | Uso previsto |
|---|---|
| `popover` | Menus dropdown compostos (mais complexo que `<select>`) |
| `command` | Command palette / search com Cmd+K |
| `tooltip` | Tooltips ricos (o `title` HTML é básico demais em UI premium) |
| `hover-card` | Preview de cliente ao hover no nome em tabelas |
| `context-menu` | Right-click actions em cards |
| `sheet` | Drawer lateral (mais elegante que Modal pra edição longa) |
| `combobox` | Select com search (o `<select>` nativo não busca) |

## Componentes que a gente NÃO deve trazer

- `button`, `input`, `select`, `textarea`, `badge`, `card`, `dialog` — já temos versão própria coerente com o resto
- `alert` — usa nosso padrão inline (`border border-{cor}-500/40 bg-{cor}-500/10 ...`)
- `separator` — `<div className="border-t border-border">` já resolve

## Setup step-by-step de um componente novo

Exemplo: quero adicionar Popover pro menu de ações rápidas.

```bash
# 1. Instala
npx shadcn@latest add popover

# 2. Arquivo criado em src/components/ui-shadcn/popover.tsx

# 3. Adapta: substitui os tokens (vide seção acima)

# 4. Testa em light/dark mode — nossa app tem toggle

# 5. Verifica se motion-design.md tem padrão de animação pra popover
```

## Erros comuns

- **Instalar em `@/components/ui`** — sobrescreve os componentes próprios. Sempre use `@/components/ui-shadcn`.
- **Não trocar tokens** — vira componente cinza-claro que destoa do dark theme editorial.
- **Trazer o `<Toaster>` do shadcn e o `<Toaster>` do sonner ao mesmo tempo** — escolhe UM. Sonner é mais elegante.
- **Copiar cegamente exemplo do site do shadcn** — os exemplos usam `bg-primary` que resolve pra nosso brand emerald, mas com contraste diferente. Sempre verificar.

## CLI útil

```bash
# lista o que ja foi instalado
npx shadcn@latest diff

# atualiza um componente pra ultima versao (revisa antes de commitar)
npx shadcn@latest add popover -o
```

/**
 * Formulário estruturado para Planejamento de Tráfego.
 * Cada bloco vira uma seção do PDF (diagnóstico, campanhas, estratégias).
 */
import { Plus, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { PlanejamentoEstrutura } from '@/types/database'

export function planejamentoEstruturaVazia(): PlanejamentoEstrutura {
  return {
    diagnostico: { pontos_fortes: [], oportunidades: [], desafios: [] },
    campanhas: [],
    estrategias: [],
  }
}

interface Props {
  value: PlanejamentoEstrutura
  onChange: (next: PlanejamentoEstrutura) => void
}

export function PlanejamentoEstruturaForm({ value, onChange }: Props) {
  const v = value ?? planejamentoEstruturaVazia()

  return (
    <div className="space-y-4">
      <SectionDiagnostico
        value={v.diagnostico}
        onChange={(diagnostico) => onChange({ ...v, diagnostico })}
      />
      <SectionCampanhas
        value={v.campanhas}
        onChange={(campanhas) => onChange({ ...v, campanhas })}
      />
      <SectionEstrategias
        value={v.estrategias}
        onChange={(estrategias) => onChange({ ...v, estrategias })}
      />
    </div>
  )
}

/* =========================================================
   Bloco: Diagnóstico
========================================================= */

function SectionDiagnostico({
  value,
  onChange,
}: {
  value: PlanejamentoEstrutura['diagnostico']
  onChange: (next: PlanejamentoEstrutura['diagnostico']) => void
}) {
  return (
    <Section title="Diagnóstico Estratégico" defaultOpen>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ListaBullets
          label="Pontos Fortes"
          accent="border-emerald-500/40 bg-emerald-500/5"
          values={value.pontos_fortes}
          onChange={(pontos_fortes) => onChange({ ...value, pontos_fortes })}
          placeholder="Ex.: Conteúdo orgânico forte"
        />
        <ListaBullets
          label="Oportunidades"
          accent="border-amber-500/40 bg-amber-500/5"
          values={value.oportunidades}
          onChange={(oportunidades) => onChange({ ...value, oportunidades })}
          placeholder="Ex.: Escalar com tráfego pago"
        />
      </div>
      <div className="mt-3">
        <ListaBullets
          label="Desafios"
          accent="border-red-500/40 bg-red-500/5"
          values={value.desafios}
          onChange={(desafios) => onChange({ ...value, desafios })}
          placeholder="Ex.: Baixa conversão no WhatsApp"
        />
      </div>
    </Section>
  )
}

/* =========================================================
   Bloco: Campanhas
========================================================= */

function SectionCampanhas({
  value,
  onChange,
}: {
  value: PlanejamentoEstrutura['campanhas']
  onChange: (next: PlanejamentoEstrutura['campanhas']) => void
}) {
  function add() {
    onChange([
      ...value,
      { titulo: '', subtitulo: '', objetivo: '', publico: '', criativos: [], formatos: [] },
    ])
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }
  function update(idx: number, patch: Partial<PlanejamentoEstrutura['campanhas'][number]>) {
    onChange(value.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  return (
    <Section title={`Campanhas ${value.length > 0 ? `(${value.length})` : ''}`} defaultOpen>
      {value.map((c, i) => (
        <div
          key={i}
          className="mt-3 rounded-lg border border-brand-500/30 bg-brand-500/5 p-3 first:mt-0"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wider text-brand-300">
              Campanha {i + 1}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded p-1 text-muted hover:bg-bg-elev hover:text-red-300"
              title="Remover campanha"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Título — ex.: Campanha 1: Captação de Seguidores"
              value={c.titulo}
              onChange={(e) => update(i, { titulo: e.target.value })}
            />
            <Input
              placeholder="Subtítulo — ex.: Reconhecimento de marca"
              value={c.subtitulo ?? ''}
              onChange={(e) => update(i, { subtitulo: e.target.value })}
            />
          </div>
          <Textarea
            placeholder="Objetivo — ex.: Aumentar seguidores qualificados no Instagram"
            value={c.objetivo}
            onChange={(e) => update(i, { objetivo: e.target.value })}
            className="mt-2 min-h-[60px]"
          />
          <Textarea
            placeholder="Público estratégico — ex.: Mulheres 25-40 anos, interesse em moda feminina, tendências..."
            value={c.publico}
            onChange={(e) => update(i, { publico: e.target.value })}
            className="mt-2 min-h-[60px]"
          />
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <ListaBullets
              label="Criativos Indicados"
              accent="border-border bg-bg-soft"
              values={c.criativos}
              onChange={(criativos) => update(i, { criativos })}
              placeholder="Ex.: Provador, '1 peça 3 looks'"
            />
            <ListaBullets
              label="Formatos Ideais"
              accent="border-border bg-bg-soft"
              values={c.formatos}
              onChange={(formatos) => update(i, { formatos })}
              placeholder="Ex.: Reels, Stories, Carrossel"
            />
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add} className="mt-3">
        <Plus size={12} /> Adicionar campanha
      </Button>
    </Section>
  )
}

/* =========================================================
   Bloco: Estratégias
========================================================= */

function SectionEstrategias({
  value,
  onChange,
}: {
  value: PlanejamentoEstrutura['estrategias']
  onChange: (next: PlanejamentoEstrutura['estrategias']) => void
}) {
  function add() {
    onChange([...value, { titulo: '', descricao: '', bullets: [] }])
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }
  function update(idx: number, patch: Partial<PlanejamentoEstrutura['estrategias'][number]>) {
    onChange(value.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  return (
    <Section title={`Estratégias adicionais ${value.length > 0 ? `(${value.length})` : ''}`}>
      {value.map((e, i) => (
        <div
          key={i}
          className="mt-3 rounded-lg border border-border bg-bg-soft p-3 first:mt-0"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted">
              Estratégia {i + 1}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded p-1 text-muted hover:bg-bg-elev hover:text-red-300"
              title="Remover estratégia"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <Input
            placeholder="Título — ex.: Explorar eventos da cidade"
            value={e.titulo}
            onChange={(ev) => update(i, { titulo: ev.target.value })}
          />
          <Textarea
            placeholder="Descrição — ex.: Shows e eventos locais aumentam muito as vendas"
            value={e.descricao}
            onChange={(ev) => update(i, { descricao: ev.target.value })}
            className="mt-2 min-h-[50px]"
          />
          <div className="mt-2">
            <ListaBullets
              label="Bullets"
              accent="border-border bg-bg-soft"
              values={e.bullets}
              onChange={(bullets) => update(i, { bullets })}
              placeholder="Ex.: Looks para evento"
            />
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add} className="mt-3">
        <Plus size={12} /> Adicionar estratégia
      </Button>
    </Section>
  )
}

/* =========================================================
   Helpers reutilizáveis
========================================================= */

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border border-border bg-bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-bg-elev"
      >
        <span className="text-sm font-semibold text-zinc-100">{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="border-t border-border p-3">{children}</div>}
    </div>
  )
}

function ListaBullets({
  label,
  accent,
  values,
  onChange,
  placeholder,
}: {
  label: string
  accent: string
  values: string[]
  onChange: (next: string[]) => void
  placeholder: string
}) {
  const [novo, setNovo] = useState('')

  function add() {
    const t = novo.trim()
    if (!t) return
    onChange([...values, t])
    setNovo('')
  }
  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx))
  }

  return (
    <div className={cn('rounded-md border p-2.5', accent)}>
      <label className="mb-2 block text-[10px] uppercase tracking-wider text-muted">
        {label}
      </label>
      {values.length > 0 && (
        <ul className="mb-2 space-y-1">
          {values.map((v, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded bg-bg-elev/60 px-2 py-1 text-xs"
            >
              <span className="flex-1 truncate">{v}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-muted hover:text-red-300"
              >
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1.5">
        <Input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <Button size="sm" variant="outline" onClick={add} disabled={!novo.trim()}>
          <Plus size={12} />
        </Button>
      </div>
    </div>
  )
}

/**
 * Formulário estruturado para Planejamento de Tráfego.
 * Visual inspirado no PlanejamentoMensalPanel do Social Media:
 * Cards escuros com ícones brand, hints "aparece na página X do PDF",
 * chips de sugestões, listas expansíveis com "+ Adicionar".
 */
import { useState } from 'react'
import {
  Plus,
  Trash2,
  X,
  Sparkles,
  Target,
  Megaphone,
  TrendingUp,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { PlanejamentoEstrutura } from '@/types/database'

const PILARES_SUGERIDOS = [
  'conexão',
  'autoridade',
  'prova social',
  'oferta',
  'remarketing',
  'urgência',
  'transformação',
  'educacional',
]

export function planejamentoEstruturaVazia(): PlanejamentoEstrutura {
  return {
    introducao: '',
    pilares: [],
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
  const v: PlanejamentoEstrutura = {
    ...planejamentoEstruturaVazia(),
    ...value,
  }

  return (
    <div className="space-y-4">
      <IntroducaoCard
        value={v.introducao ?? ''}
        onChange={(introducao) => onChange({ ...v, introducao })}
      />
      <DiagnosticoCard
        value={v.diagnostico}
        onChange={(diagnostico) => onChange({ ...v, diagnostico })}
      />
      <PilaresCard
        value={v.pilares ?? []}
        onChange={(pilares) => onChange({ ...v, pilares })}
      />
      <CampanhasCard
        value={v.campanhas}
        onChange={(campanhas) => onChange({ ...v, campanhas })}
      />
      <EstrategiasCard
        value={v.estrategias}
        onChange={(estrategias) => onChange({ ...v, estrategias })}
      />
    </div>
  )
}

/* =========================================================
   Introdução do planejamento
========================================================= */

function IntroducaoCard({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles size={14} className="text-brand-300" />
          Introdução do planejamento
        </CardTitle>
        <span className="text-[10px] text-muted">aparece na página 2 do PDF</span>
      </CardHeader>
      <CardBody>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex.: 'Trabalharemos com um funil de tráfego dividido em 3 estágios — Captação de Seguidores, Engajamento e Conversão WhatsApp. O foco do mês é validar criativos humanizados...'"
          className="min-h-[120px] text-sm leading-relaxed"
        />
      </CardBody>
    </Card>
  )
}

/* =========================================================
   Diagnóstico Estratégico (3 chip-lists)
========================================================= */

function DiagnosticoCard({
  value,
  onChange,
}: {
  value: PlanejamentoEstrutura['diagnostico']
  onChange: (v: PlanejamentoEstrutura['diagnostico']) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target size={14} className="text-brand-300" />
          Diagnóstico Estratégico
        </CardTitle>
        <span className="text-[10px] text-muted">aparece na página 3 do PDF</span>
      </CardHeader>
      <CardBody className="space-y-3">
        <ChipList
          label="Pontos Fortes"
          accent="emerald"
          values={value.pontos_fortes}
          onChange={(pontos_fortes) => onChange({ ...value, pontos_fortes })}
          placeholder="Ex.: Conteúdo orgânico forte"
        />
        <ChipList
          label="Oportunidades"
          accent="brand"
          values={value.oportunidades}
          onChange={(oportunidades) => onChange({ ...value, oportunidades })}
          placeholder="Ex.: Escalar com tráfego pago"
        />
        <ChipList
          label="Desafios"
          accent="red"
          values={value.desafios}
          onChange={(desafios) => onChange({ ...value, desafios })}
          placeholder="Ex.: Baixa conversão no WhatsApp"
        />
      </CardBody>
    </Card>
  )
}

/* =========================================================
   Pilares estratégicos (chips com sugestões)
========================================================= */

function PilaresCard({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [novo, setNovo] = useState('')

  function toggle(p: string) {
    onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p])
  }

  function addCustom() {
    const t = novo.trim().toLowerCase()
    if (!t || value.includes(t)) return
    onChange([...value, t])
    setNovo('')
  }

  function remove(p: string) {
    onChange(value.filter((x) => x !== p))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles size={14} className="text-brand-300" />
          Pilares estratégicos
        </CardTitle>
        <span className="text-[10px] text-muted">ângulos que vão guiar os criativos</span>
      </CardHeader>
      <CardBody className="space-y-3">
        {value.length === 0 ? (
          <p className="text-xs text-muted">Nenhum pilar selecionado.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {value.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 rounded-md border border-brand-500/40 bg-brand-500/15 px-2 py-1 text-xs text-brand-200"
              >
                {p}
                <button
                  onClick={() => remove(p)}
                  className="rounded p-0.5 hover:bg-brand-500/20"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">Sugestões</p>
          <div className="flex flex-wrap gap-1.5">
            {PILARES_SUGERIDOS.filter((p) => !value.includes(p)).map((p) => (
              <button
                key={p}
                onClick={() => toggle(p)}
                className="rounded-md border border-border bg-bg-soft px-2 py-1 text-xs text-zinc-300 hover:border-brand-500/40 hover:text-brand-300"
              >
                + {p}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
            placeholder="Adicionar pilar customizado"
            className="text-xs"
          />
          <Button size="sm" variant="outline" onClick={addCustom} disabled={!novo.trim()}>
            <Plus size={11} />
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

/* =========================================================
   Campanhas (lista expansível com "+ Adicionar")
========================================================= */

function CampanhasCard({
  value,
  onChange,
}: {
  value: PlanejamentoEstrutura['campanhas']
  onChange: (v: PlanejamentoEstrutura['campanhas']) => void
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone size={14} className="text-brand-300" />
          Campanhas ({value.length})
        </CardTitle>
        <Button size="sm" variant="outline" onClick={add}>
          <Plus size={12} /> Adicionar
        </Button>
      </CardHeader>
      <CardBody>
        {value.length === 0 ? (
          <p className="text-xs text-muted">Nenhuma campanha planejada ainda.</p>
        ) : (
          <div className="space-y-3">
            {value.map((c, i) => (
              <CampanhaItem
                key={i}
                index={i}
                campanha={c}
                onChange={(patch) => update(i, patch)}
                onRemove={() => remove(i)}
              />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function CampanhaItem({
  index,
  campanha,
  onChange,
  onRemove,
}: {
  index: number
  campanha: PlanejamentoEstrutura['campanhas'][number]
  onChange: (patch: Partial<PlanejamentoEstrutura['campanhas'][number]>) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-lg border border-brand-500/30 bg-brand-500/5">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="text-[11px] uppercase tracking-wider text-brand-300">
            Campanha {index + 1}
          </span>
          {campanha.titulo && (
            <span className="truncate text-sm text-zinc-100">— {campanha.titulo}</span>
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-muted hover:bg-bg-elev hover:text-red-300"
          title="Remover campanha"
        >
          <Trash2 size={12} />
        </button>
      </div>
      {open && (
        <div className="border-t border-brand-500/20 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Título — ex.: Campanha 1: Captação de Seguidores"
              value={campanha.titulo}
              onChange={(e) => onChange({ titulo: e.target.value })}
            />
            <Input
              placeholder="Subtítulo — ex.: Reconhecimento de marca"
              value={campanha.subtitulo ?? ''}
              onChange={(e) => onChange({ subtitulo: e.target.value })}
            />
          </div>
          <Textarea
            placeholder="Objetivo — ex.: Aumentar seguidores qualificados no Instagram"
            value={campanha.objetivo}
            onChange={(e) => onChange({ objetivo: e.target.value })}
            className="min-h-[60px]"
          />
          <Textarea
            placeholder="Público estratégico — ex.: Mulheres 25-40 anos, interesse em moda..."
            value={campanha.publico}
            onChange={(e) => onChange({ publico: e.target.value })}
            className="min-h-[60px]"
          />
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <ChipList
              label="Criativos Indicados"
              accent="brand"
              values={campanha.criativos}
              onChange={(criativos) => onChange({ criativos })}
              placeholder="Ex.: Provador, '1 peça 3 looks'"
            />
            <ChipList
              label="Formatos Ideais"
              accent="brand"
              values={campanha.formatos}
              onChange={(formatos) => onChange({ formatos })}
              placeholder="Ex.: Reels, Stories, Carrossel"
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================
   Estratégias (lista expansível)
========================================================= */

function EstrategiasCard({
  value,
  onChange,
}: {
  value: PlanejamentoEstrutura['estrategias']
  onChange: (v: PlanejamentoEstrutura['estrategias']) => void
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp size={14} className="text-brand-300" />
          Estratégias adicionais ({value.length})
        </CardTitle>
        <Button size="sm" variant="outline" onClick={add}>
          <Plus size={12} /> Adicionar
        </Button>
      </CardHeader>
      <CardBody>
        {value.length === 0 ? (
          <p className="text-xs text-muted">Nenhuma estratégia adicional planejada.</p>
        ) : (
          <div className="space-y-3">
            {value.map((e, i) => (
              <EstrategiaItem
                key={i}
                index={i}
                estrategia={e}
                onChange={(patch) => update(i, patch)}
                onRemove={() => remove(i)}
              />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function EstrategiaItem({
  index,
  estrategia,
  onChange,
  onRemove,
}: {
  index: number
  estrategia: PlanejamentoEstrutura['estrategias'][number]
  onChange: (patch: Partial<PlanejamentoEstrutura['estrategias'][number]>) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-lg border border-border bg-bg-soft">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="text-[11px] uppercase tracking-wider text-muted">
            Estratégia {index + 1}
          </span>
          {estrategia.titulo && (
            <span className="truncate text-sm text-zinc-100">— {estrategia.titulo}</span>
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-muted hover:bg-bg-elev hover:text-red-300"
          title="Remover estratégia"
        >
          <Trash2 size={12} />
        </button>
      </div>
      {open && (
        <div className="border-t border-border p-3 space-y-2">
          <Input
            placeholder="Título — ex.: Explorar eventos da cidade"
            value={estrategia.titulo}
            onChange={(e) => onChange({ titulo: e.target.value })}
          />
          <Textarea
            placeholder="Descrição — ex.: Shows e eventos locais aumentam muito as vendas"
            value={estrategia.descricao}
            onChange={(e) => onChange({ descricao: e.target.value })}
            className="min-h-[50px]"
          />
          <ChipList
            label="Bullets"
            accent="brand"
            values={estrategia.bullets}
            onChange={(bullets) => onChange({ bullets })}
            placeholder="Ex.: Looks para evento"
          />
        </div>
      )}
    </div>
  )
}

/* =========================================================
   Helper: ChipList — lista de bullets como chips
========================================================= */

function ChipList({
  label,
  accent,
  values,
  onChange,
  placeholder,
}: {
  label: string
  accent: 'brand' | 'emerald' | 'red'
  values: string[]
  onChange: (next: string[]) => void
  placeholder: string
}) {
  const [novo, setNovo] = useState('')

  function add() {
    const t = novo.trim()
    if (!t || values.includes(t)) return
    onChange([...values, t])
    setNovo('')
  }
  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx))
  }

  const accentMap: Record<
    typeof accent,
    { chip: string; remove: string; label: string }
  > = {
    brand: {
      chip: 'border-brand-500/40 bg-brand-500/15 text-brand-200',
      remove: 'hover:bg-brand-500/20',
      label: 'text-brand-300',
    },
    emerald: {
      chip: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
      remove: 'hover:bg-emerald-500/20',
      label: 'text-emerald-300',
    },
    red: {
      chip: 'border-red-500/40 bg-red-500/15 text-red-200',
      remove: 'hover:bg-red-500/20',
      label: 'text-red-300',
    },
  }
  const a = accentMap[accent]

  return (
    <div>
      <label className={cn('mb-1.5 block text-[10px] uppercase tracking-wider', a.label)}>
        {label}
      </label>
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v, i) => (
            <span
              key={i}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs',
                a.chip,
              )}
            >
              {v}
              <button
                type="button"
                onClick={() => remove(i)}
                className={cn('rounded p-0.5', a.remove)}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          className="h-8 text-xs"
        />
        <Button size="sm" variant="outline" onClick={add} disabled={!novo.trim()}>
          <Plus size={11} />
        </Button>
      </div>
    </div>
  )
}

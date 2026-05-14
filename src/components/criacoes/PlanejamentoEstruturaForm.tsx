/**
 * Formulário estruturado para Planejamento de Tráfego — Modelo A
 * "Por canal/plataforma". Cards: Visão geral, Meta Ads, Google Ads, KPIs alvo.
 * (Orgânico/Conteúdo foi removido — fica no Planejamento Mensal de Social Media.)
 */
import { useState } from 'react'
import { Plus, X, Target, Megaphone, TrendingUp, Calendar } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { PlanejamentoEstrutura } from '@/types/database'

export function planejamentoEstruturaVazia(): PlanejamentoEstrutura {
  return {
    visao_geral: { mes: '', objetivo: '', orcamento_total: '' },
    meta_ads: { objetivo: '', publico: '', criativos_previstos: [], budget: '' },
    google_ads: { objetivo: '', segmentacao: '', budget: '' },
    kpis: { cpl: '', ctr: '', cpc: '', conversoes: '' },
  }
}

interface Props {
  value: PlanejamentoEstrutura
  onChange: (next: PlanejamentoEstrutura) => void
}

export function PlanejamentoEstruturaForm({ value, onChange }: Props) {
  const v: PlanejamentoEstrutura = { ...planejamentoEstruturaVazia(), ...value }

  return (
    <div className="space-y-4">
      <VisaoGeralCard
        value={v.visao_geral ?? {}}
        onChange={(visao_geral) => onChange({ ...v, visao_geral })}
      />
      <MetaAdsCard
        value={v.meta_ads ?? {}}
        onChange={(meta_ads) => onChange({ ...v, meta_ads })}
      />
      <GoogleAdsCard
        value={v.google_ads ?? {}}
        onChange={(google_ads) => onChange({ ...v, google_ads })}
      />
      {/* Orgânico/Conteúdo removido — pilares/cadência são responsabilidade
          do Planejamento Mensal de Social Media, não do Trafego. */}
      <KPIsCard
        value={v.kpis ?? {}}
        onChange={(kpis) => onChange({ ...v, kpis })}
      />
    </div>
  )
}

/* =========================================================
   Visão Geral
========================================================= */

function VisaoGeralCard({
  value,
  onChange,
}: {
  value: NonNullable<PlanejamentoEstrutura['visao_geral']>
  onChange: (v: NonNullable<PlanejamentoEstrutura['visao_geral']>) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar size={14} className="text-brand-300" />
          Visão geral
        </CardTitle>
        <span className="text-[10px] text-muted">aparece na capa e abertura do PDF</span>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mês de referência">
            <Input
              value={value.mes ?? ''}
              onChange={(e) => onChange({ ...value, mes: e.target.value })}
              placeholder="Ex.: Maio 2026"
            />
          </Field>
          <Field label="Orçamento total">
            <Input
              value={value.orcamento_total ?? ''}
              onChange={(e) => onChange({ ...value, orcamento_total: e.target.value })}
              placeholder="Ex.: R$ 4.500"
            />
          </Field>
        </div>
        <Field label="Objetivo do mês">
          <Textarea
            value={value.objetivo ?? ''}
            onChange={(e) => onChange({ ...value, objetivo: e.target.value })}
            placeholder="Ex.: Gerar 80 leads qualificados pra avaliação ortodôntica (CPL alvo R$ 35)"
            className="min-h-[70px]"
          />
        </Field>
      </CardBody>
    </Card>
  )
}

/* =========================================================
   Meta Ads
========================================================= */

function MetaAdsCard({
  value,
  onChange,
}: {
  value: NonNullable<PlanejamentoEstrutura['meta_ads']>
  onChange: (v: NonNullable<PlanejamentoEstrutura['meta_ads']>) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone size={14} className="text-brand-300" />
          Meta Ads (Instagram + Facebook)
        </CardTitle>
        <span className="text-[10px] text-muted">aparece como página própria no PDF</span>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Objetivo">
            <Textarea
              value={value.objetivo ?? ''}
              onChange={(e) => onChange({ ...value, objetivo: e.target.value })}
              placeholder="Ex.: Geração de leads via conversa no Direct"
              className="min-h-[60px]"
            />
          </Field>
          <Field label="Budget">
            <Input
              value={value.budget ?? ''}
              onChange={(e) => onChange({ ...value, budget: e.target.value })}
              placeholder="Ex.: R$ 3.150 (70% do total)"
            />
          </Field>
        </div>
        <Field label="Público estratégico">
          <Textarea
            value={value.publico ?? ''}
            onChange={(e) => onChange({ ...value, publico: e.target.value })}
            placeholder="Ex.: Mulheres 25-40 anos, classe A/B, interesse em estética..."
            className="min-h-[60px]"
          />
        </Field>
        <ChipList
          label="Criativos previstos"
          values={value.criativos_previstos ?? []}
          onChange={(criativos_previstos) => onChange({ ...value, criativos_previstos })}
          placeholder="Ex.: Reel depoimento, Carrossel educativo, Story oferta"
        />
      </CardBody>
    </Card>
  )
}

/* =========================================================
   Google Ads
========================================================= */

function GoogleAdsCard({
  value,
  onChange,
}: {
  value: NonNullable<PlanejamentoEstrutura['google_ads']>
  onChange: (v: NonNullable<PlanejamentoEstrutura['google_ads']>) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target size={14} className="text-brand-300" />
          Google Ads
        </CardTitle>
        <span className="text-[10px] text-muted">opcional — só preenche se rodar Google</span>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Objetivo">
            <Textarea
              value={value.objetivo ?? ''}
              onChange={(e) => onChange({ ...value, objetivo: e.target.value })}
              placeholder="Ex.: Capturar intenção de busca direta"
              className="min-h-[60px]"
            />
          </Field>
          <Field label="Budget">
            <Input
              value={value.budget ?? ''}
              onChange={(e) => onChange({ ...value, budget: e.target.value })}
              placeholder="Ex.: R$ 1.350 (30% do total)"
            />
          </Field>
        </div>
        <Field label="Palavras-chave / Segmentação">
          <Textarea
            value={value.segmentacao ?? ''}
            onChange={(e) => onChange({ ...value, segmentacao: e.target.value })}
            placeholder='Ex.: "ortodontia invisalign zona sul", "avaliação ortodôntica gratuita"...'
            className="min-h-[60px]"
          />
        </Field>
      </CardBody>
    </Card>
  )
}

/* =========================================================
   KPIs alvo
========================================================= */

function KPIsCard({
  value,
  onChange,
}: {
  value: NonNullable<PlanejamentoEstrutura['kpis']>
  onChange: (v: NonNullable<PlanejamentoEstrutura['kpis']>) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp size={14} className="text-brand-300" />
          KPIs alvo
        </CardTitle>
        <span className="text-[10px] text-muted">metas mensuráveis do mês</span>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="CPL alvo">
            <Input
              value={value.cpl ?? ''}
              onChange={(e) => onChange({ ...value, cpl: e.target.value })}
              placeholder="Ex.: R$ 35"
            />
          </Field>
          <Field label="CTR alvo">
            <Input
              value={value.ctr ?? ''}
              onChange={(e) => onChange({ ...value, ctr: e.target.value })}
              placeholder="Ex.: > 2.5%"
            />
          </Field>
          <Field label="CPC alvo">
            <Input
              value={value.cpc ?? ''}
              onChange={(e) => onChange({ ...value, cpc: e.target.value })}
              placeholder="Ex.: R$ 1,20"
            />
          </Field>
          <Field label="Conversões esperadas">
            <Input
              value={value.conversoes ?? ''}
              onChange={(e) => onChange({ ...value, conversoes: e.target.value })}
              placeholder="Ex.: 80 leads"
            />
          </Field>
        </div>
      </CardBody>
    </Card>
  )
}

/* =========================================================
   Helper: ChipList (lista de bullets)
========================================================= */

function ChipList({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string
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

  return (
    <div>
      <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted">
        {label}
      </label>
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v, i) => (
            <span
              key={i}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs',
                'border-brand-500/40 bg-brand-500/15 text-brand-200',
              )}
            >
              {v}
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded p-0.5 hover:bg-brand-500/20"
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

/* =========================================================
   Helper: Field (label + child)
========================================================= */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted">
        {label}
      </label>
      {children}
    </div>
  )
}


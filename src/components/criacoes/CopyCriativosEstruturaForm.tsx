/**
 * Formulário estruturado para Copy de Criativos — mesma linha do Roteiro
 * (3 atos), adaptada pra peças estáticas:
 *   Setup → Headline (Gancho) → Corpo → CTA → Hashtags
 */
import { useState } from 'react'
import { Plus, X, Image as ImageIcon, Play, Target, Flag, Hash } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { CopyCriativosEstrutura } from '@/types/database'

export function copyCriativosEstruturaVazia(): CopyCriativosEstrutura {
  return {
    formato: 'feed_estatico',
    plataforma: '',
    headline: { texto: '', subheadline: '' },
    corpo: { texto: '', pontos_chave: [] },
    cta: { texto: '', link: '' },
    hashtags: '',
  }
}

const formatoLabel: Record<NonNullable<CopyCriativosEstrutura['formato']>, string> = {
  feed_estatico: 'Feed estático',
  story: 'Story',
  carrossel: 'Carrossel',
  outro: 'Outro',
}

interface Props {
  value: CopyCriativosEstrutura
  onChange: (next: CopyCriativosEstrutura) => void
}

export function CopyCriativosEstruturaForm({ value, onChange }: Props) {
  const v: CopyCriativosEstrutura = { ...copyCriativosEstruturaVazia(), ...value }

  return (
    <div className="space-y-4">
      {/* Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon size={14} className="text-brand-300" />
            Setup do criativo
          </CardTitle>
          <span className="text-[10px] text-muted">aparece no header do PDF</span>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Formato">
              <Select
                value={v.formato ?? 'feed_estatico'}
                onChange={(e) =>
                  onChange({
                    ...v,
                    formato: e.target.value as CopyCriativosEstrutura['formato'],
                  })
                }
              >
                {(Object.keys(formatoLabel) as Array<keyof typeof formatoLabel>).map(
                  (k) => (
                    <option key={k} value={k}>
                      {formatoLabel[k]}
                    </option>
                  ),
                )}
              </Select>
            </Field>
            <Field label="Plataforma">
              <Input
                value={v.plataforma ?? ''}
                onChange={(e) => onChange({ ...v, plataforma: e.target.value })}
                placeholder="Ex.: Meta Ads, Instagram, Google Ads"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Ato 1 — Headline / Gancho */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play size={14} className="text-brand-300" />
            Headline / Gancho
          </CardTitle>
          <span className="text-[10px] text-muted">a primeira linha que para o scroll</span>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="Texto da headline">
            <Textarea
              value={v.headline?.texto ?? ''}
              onChange={(e) =>
                onChange({ ...v, headline: { ...v.headline, texto: e.target.value } })
              }
              placeholder='Ex.: "Cansada de esconder o sorriso nas fotos?"'
              className="min-h-[70px]"
            />
          </Field>
          <Field label="Subheadline / Reforço (opcional)">
            <Textarea
              value={v.headline?.subheadline ?? ''}
              onChange={(e) =>
                onChange({
                  ...v,
                  headline: { ...v.headline, subheadline: e.target.value },
                })
              }
              placeholder='Ex.: "Você não está sozinha. 1.200 mulheres recuperaram a confiança com a Dra. Maria."'
              className="min-h-[60px]"
            />
          </Field>
        </CardBody>
      </Card>

      {/* Ato 2 — Corpo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target size={14} className="text-brand-300" />
            Corpo / Argumento
          </CardTitle>
          <span className="text-[10px] text-muted">dor, solução, prova social, autoridade</span>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="Texto do corpo">
            <Textarea
              value={v.corpo?.texto ?? ''}
              onChange={(e) =>
                onChange({ ...v, corpo: { ...v.corpo, texto: e.target.value } })
              }
              placeholder="O argumento principal da copy — pode contar a dor, apresentar a solução, validar com prova social, gerar autoridade..."
              className="min-h-[120px]"
            />
          </Field>
          <PontosChaveList
            values={v.corpo?.pontos_chave ?? []}
            onChange={(pontos_chave) =>
              onChange({ ...v, corpo: { ...v.corpo, pontos_chave } })
            }
          />
        </CardBody>
      </Card>

      {/* Ato 3 — CTA / Fechamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag size={14} className="text-brand-300" />
            CTA / Fechamento
          </CardTitle>
          <span className="text-[10px] text-muted">a chamada pra ação final</span>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="Texto do CTA">
            <Input
              value={v.cta?.texto ?? ''}
              onChange={(e) =>
                onChange({ ...v, cta: { ...v.cta, texto: e.target.value } })
              }
              placeholder='Ex.: "Agende sua avaliação gratuita" · "Clique no link da bio"'
            />
          </Field>
          <Field label="Link / URL (opcional)">
            <Input
              value={v.cta?.link ?? ''}
              onChange={(e) =>
                onChange({ ...v, cta: { ...v.cta, link: e.target.value } })
              }
              placeholder="https://wa.me/55... ou landing page de destino"
            />
          </Field>
        </CardBody>
      </Card>

      {/* Hashtags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash size={14} className="text-brand-300" />
            Hashtags
          </CardTitle>
          <span className="text-[10px] text-muted">opcional</span>
        </CardHeader>
        <CardBody>
          <Textarea
            value={v.hashtags ?? ''}
            onChange={(e) => onChange({ ...v, hashtags: e.target.value })}
            placeholder="#ortodontia #invisalign #sorrisoperfeito #drmariadeo #spzonasul"
            className="min-h-[60px] text-sm"
          />
        </CardBody>
      </Card>
    </div>
  )
}

/** Chips de "pontos-chave" do corpo (benefícios, dores, etc). */
function PontosChaveList({
  values,
  onChange,
}: {
  values: string[]
  onChange: (next: string[]) => void
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
        Pontos-chave (bullets opcionais)
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
          placeholder='Ex.: "15 anos de experiência" · "Alinhadores invisíveis" · "Resultados em 9 meses"'
          className="h-8 text-xs"
        />
        <Button size="sm" variant="outline" onClick={add} disabled={!novo.trim()}>
          <Plus size={11} />
        </Button>
      </div>
    </div>
  )
}

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

/**
 * Achata a estrutura num texto plano — usado quando aprovamos a Copy
 * Criativos e enviamos pro Webdesign (campo `copy_texto` é só string).
 */
export function flattenCopyCriativos(e: CopyCriativosEstrutura): string {
  const linhas: string[] = []
  if (e.formato || e.plataforma) {
    const setup = [
      e.formato ? formatoLabel[e.formato] : '',
      e.plataforma,
    ]
      .filter(Boolean)
      .join(' · ')
    if (setup) linhas.push(`[SETUP] ${setup}`)
  }
  if (e.headline?.texto || e.headline?.subheadline) {
    linhas.push('', '[HEADLINE]')
    if (e.headline?.texto) linhas.push(e.headline.texto)
    if (e.headline?.subheadline) linhas.push('', e.headline.subheadline)
  }
  if (e.corpo?.texto || (e.corpo?.pontos_chave?.length ?? 0) > 0) {
    linhas.push('', '[CORPO]')
    if (e.corpo?.texto) linhas.push(e.corpo.texto)
    if ((e.corpo?.pontos_chave?.length ?? 0) > 0) {
      linhas.push('')
      for (const p of e.corpo!.pontos_chave!) linhas.push(`• ${p}`)
    }
  }
  if (e.cta?.texto || e.cta?.link) {
    linhas.push('', '[CTA]')
    if (e.cta?.texto) linhas.push(e.cta.texto)
    if (e.cta?.link) linhas.push(`→ ${e.cta.link}`)
  }
  if (e.hashtags && e.hashtags.trim()) {
    linhas.push('', e.hashtags)
  }
  return linhas.join('\n').trim()
}

/**
 * Formulário estruturado para Roteiro — Modelo A "3 atos clássicos".
 * Cards: Setup (formato + duração) → Gancho → Desenvolvimento → Fechamento.
 */
import { Film, Play, Target, Flag, Music } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import type { RoteiroEstrutura } from '@/types/database'

export function roteiroEstruturaVazia(): RoteiroEstrutura {
  return {
    formato: 'reel',
    duracao: '',
    gancho: { texto: '', direcao: '' },
    desenvolvimento: { texto: '', acoes: '' },
    fechamento: { texto: '', cta: '' },
    trilha: '',
  }
}

const formatoLabel: Record<NonNullable<RoteiroEstrutura['formato']>, string> = {
  reel: 'Reel (Instagram)',
  carrossel: 'Carrossel',
  tiktok: 'TikTok',
  story: 'Story',
  outro: 'Outro',
}

interface Props {
  value: RoteiroEstrutura
  onChange: (next: RoteiroEstrutura) => void
}

export function RoteiroEstruturaForm({ value, onChange }: Props) {
  const v: RoteiroEstrutura = { ...roteiroEstruturaVazia(), ...value }

  return (
    <div className="space-y-4">
      {/* Setup do roteiro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film size={14} className="text-brand-300" />
            Setup do roteiro
          </CardTitle>
          <span className="text-[10px] text-muted">aparece no header do PDF</span>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Formato">
              <Select
                value={v.formato ?? 'reel'}
                onChange={(e) =>
                  onChange({ ...v, formato: e.target.value as RoteiroEstrutura['formato'] })
                }
              >
                {(Object.keys(formatoLabel) as Array<keyof typeof formatoLabel>).map((k) => (
                  <option key={k} value={k}>
                    {formatoLabel[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duração estimada">
              <Input
                value={v.duracao ?? ''}
                onChange={(e) => onChange({ ...v, duracao: e.target.value })}
                placeholder="Ex.: 60s"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Ato 1 — Gancho */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play size={14} className="text-brand-300" />
            Gancho (0–3s)
          </CardTitle>
          <span className="text-[10px] text-muted">os 3 segundos que prendem a atenção</span>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="Texto / Fala">
            <Textarea
              value={v.gancho?.texto ?? ''}
              onChange={(e) =>
                onChange({ ...v, gancho: { ...v.gancho, texto: e.target.value } })
              }
              placeholder='Ex.: "Eu evitava sorrir há 8 ANOS."'
              className="min-h-[70px]"
            />
          </Field>
          <Field label="Direção de câmera / Visual">
            <Textarea
              value={v.gancho?.direcao ?? ''}
              onChange={(e) =>
                onChange({ ...v, gancho: { ...v.gancho, direcao: e.target.value } })
              }
              placeholder="Ex.: Close no rosto, ela cobre a boca rindo. Texto em tela: 'Eu evitava sorrir há 8 anos'"
              className="min-h-[70px]"
            />
          </Field>
        </CardBody>
      </Card>

      {/* Ato 2 — Desenvolvimento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target size={14} className="text-brand-300" />
            Desenvolvimento
          </CardTitle>
          <span className="text-[10px] text-muted">o corpo do vídeo — argumento + prova</span>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="Texto / Fala">
            <Textarea
              value={v.desenvolvimento?.texto ?? ''}
              onChange={(e) =>
                onChange({
                  ...v,
                  desenvolvimento: { ...v.desenvolvimento, texto: e.target.value },
                })
              }
              placeholder='Ex.: "Toda foto eu tava de boca fechada... aí descobri os alinhadores invisíveis."'
              className="min-h-[110px]"
            />
          </Field>
          <Field label="Ações / Visual">
            <Textarea
              value={v.desenvolvimento?.acoes ?? ''}
              onChange={(e) =>
                onChange({
                  ...v,
                  desenvolvimento: { ...v.desenvolvimento, acoes: e.target.value },
                })
              }
              placeholder="Ex.: Cortes pra consultório, Dra mostra alinhadores. Sequência antes e depois."
              className="min-h-[70px]"
            />
          </Field>
        </CardBody>
      </Card>

      {/* Ato 3 — Fechamento / CTA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag size={14} className="text-brand-300" />
            Fechamento / CTA
          </CardTitle>
          <span className="text-[10px] text-muted">a chamada pra ação final</span>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="Texto / Fala final">
            <Textarea
              value={v.fechamento?.texto ?? ''}
              onChange={(e) =>
                onChange({ ...v, fechamento: { ...v.fechamento, texto: e.target.value } })
              }
              placeholder='Ex.: "Vagas limitadas pra avaliação ortodôntica gratuita esta semana."'
              className="min-h-[70px]"
            />
          </Field>
          <Field label="CTA (chamada pra ação)">
            <Input
              value={v.fechamento?.cta ?? ''}
              onChange={(e) =>
                onChange({ ...v, fechamento: { ...v.fechamento, cta: e.target.value } })
              }
              placeholder="Ex.: Link na bio · Manda mensagem · Agenda agora"
            />
          </Field>
        </CardBody>
      </Card>

      {/* Extras */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music size={14} className="text-brand-300" />
            Trilha sugerida
          </CardTitle>
          <span className="text-[10px] text-muted">opcional</span>
        </CardHeader>
        <CardBody>
          <Input
            value={v.trilha ?? ''}
            onChange={(e) => onChange({ ...v, trilha: e.target.value })}
            placeholder='Ex.: "[Nome da música]" — emocional, lo-fi, energético, etc.'
          />
        </CardBody>
      </Card>
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

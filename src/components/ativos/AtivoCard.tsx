import { useState } from 'react'
import {
  Target,
  BarChart3,
  MapPin,
  Link2,
  Users,
  Lightbulb,
  ChevronDown,
  ExternalLink,
  Clock,
  Pencil,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { cn, formatDateTime, statusAtivoLabel, tipoAtivoLabel } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { Ativo, StatusAtivo, TipoAtivo } from '@/types/database'

const iconByTipo: Record<TipoAtivo, React.ComponentType<{ size?: number; className?: string }>> = {
  meta_pixel: Target,
  ga4: BarChart3,
  google_meu_negocio: MapPin,
  bio_estruturada: Link2,
  publicos_meta_ads: Users,
}

/** Cor de identidade de cada tipo (usada na "moldura" do ícone) */
const accentByTipo: Record<TipoAtivo, { box: string; icon: string; glow: string }> = {
  meta_pixel: {
    box: 'border-blue-500/30 bg-blue-500/10',
    icon: 'text-blue-300',
    glow: 'group-hover/asset:shadow-[0_0_25px_-6px_rgba(59,130,246,0.6)]',
  },
  ga4: {
    box: 'border-amber-500/30 bg-amber-500/10',
    icon: 'text-amber-300',
    glow: 'group-hover/asset:shadow-[0_0_25px_-6px_rgba(245,158,11,0.6)]',
  },
  google_meu_negocio: {
    box: 'border-emerald-500/30 bg-emerald-500/10',
    icon: 'text-emerald-300',
    glow: 'group-hover/asset:shadow-[0_0_25px_-6px_rgba(16,185,129,0.6)]',
  },
  bio_estruturada: {
    box: 'border-fuchsia-500/30 bg-fuchsia-500/10',
    icon: 'text-fuchsia-300',
    glow: 'group-hover/asset:shadow-[0_0_25px_-6px_rgba(217,70,239,0.6)]',
  },
  publicos_meta_ads: {
    box: 'border-cyan-500/30 bg-cyan-500/10',
    icon: 'text-cyan-300',
    glow: 'group-hover/asset:shadow-[0_0_25px_-6px_rgba(6,182,212,0.6)]',
  },
}

const statusVisual: Record<
  StatusAtivo,
  { dot: string; pill: string; corner: string; label: string }
> = {
  funcional: {
    dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]',
    pill: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    corner: 'from-emerald-500/15',
    label: 'Funcional',
  },
  configurado: {
    dot: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]',
    pill: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    corner: 'from-amber-500/15',
    label: 'Configurado',
  },
  com_problema: {
    dot: 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse',
    pill: 'border-red-500/30 bg-red-500/10 text-red-300',
    corner: 'from-red-500/15',
    label: 'Com problema',
  },
  pendente: {
    dot: 'bg-zinc-500',
    pill: 'border-border bg-bg-soft text-muted',
    corner: 'from-zinc-500/5',
    label: 'Pendente',
  },
}

type BoaPratica = { title: string; items: (string | { label: string; items: string[] })[] }

const boasPraticasByTipo: Partial<Record<TipoAtivo, BoaPratica>> = {
  google_meu_negocio: {
    title: 'Boas práticas — Google Meu Negócio',
    items: [
      'Nome da empresa sem palavras-chave forçadas',
      'Categoria principal bem definida (e categorias secundárias relevantes)',
      'Endereço, telefone e horário 100% atualizados',
      'Descrição com palavras-chave naturais e locais',
      'Pedir avaliação para todos os clientes satisfeitos',
      'Usar fotos reais da empresa (ambiente, equipe, estrutura)',
      'Inserir link para WhatsApp',
      'Linkar com site ou landing page',
    ],
  },
  bio_estruturada: {
    title: 'Boas práticas — Bio estruturada',
    items: [
      'Use quebra de linha (bio fácil de ler)',
      'Evite texto corrido',
      'Use emoji com função (não poluir)',
      'Seja específico (nada genérico tipo “ajudo pessoas”)',
      'Pense em palavra-chave + clareza + benefício',
      'Nome do perfil pode ter keyword (ex: “William | Tráfego Médico”)',
      'Link da landing page e do WhatsApp',
    ],
  },
  publicos_meta_ads: {
    title: 'Boas práticas — Públicos Meta Ads',
    items: [
      {
        label: 'Tipos de engajamento para públicos',
        items: ['Engajamento', 'Visitas', 'Mensagem', 'Seguidores', 'Salvou'],
      },
      {
        label: 'Janelas de retenção (dias)',
        items: ['1', '3', '7', '14', '30', '60', '90', '180'],
      },
      {
        label: 'Tempo gasto no site',
        items: ['5%', '10%', '25%'],
      },
      'Todos os visitantes do site',
    ],
  },
}

export function AtivoCard({ ativo, onSaved }: { ativo: Ativo; onSaved: () => void }) {
  const { profile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [showTips, setShowTips] = useState(false)
  const [form, setForm] = useState({
    status: ativo.status,
    link: ativo.link ?? '',
    observacoes: ativo.observacoes ?? '',
  })
  const Icon = iconByTipo[ativo.tipo]
  const tips = boasPraticasByTipo[ativo.tipo]
  const accent = accentByTipo[ativo.tipo]
  const status = statusVisual[ativo.status]

  async function save() {
    await supabase
      .from('ativos')
      .update({
        status: form.status,
        link: form.link || null,
        observacoes: form.observacoes || null,
        ultima_verificacao: new Date().toISOString(),
        verificado_por: profile?.id ?? null,
      })
      .eq('id', ativo.id)
    setEditing(false)
    onSaved()
  }

  return (
    <Card className="group/asset relative flex flex-col overflow-hidden">
      {/* corner gradient sutil baseado no status */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full blur-3xl opacity-70',
          'bg-gradient-to-br to-transparent',
          status.corner,
        )}
      />

      <CardBody className="relative flex flex-1 flex-col gap-4">
        {/* Header: icon + nome + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-all duration-300',
                accent.box,
                accent.glow,
                'group-hover/asset:scale-105',
              )}
            >
              <Icon size={18} className={accent.icon} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-zinc-100 leading-tight">
                {tipoAtivoLabel[ativo.tipo]}
              </h3>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                <span
                  className={cn(
                    'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                    status.pill,
                  )}
                >
                  {status.label}
                </span>
              </div>
            </div>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-brand-300"
              title="Editar"
            >
              <Pencil size={13} />
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as StatusAtivo })}
            >
              <option value="pendente">Pendente</option>
              <option value="configurado">Configurado</option>
              <option value="funcional">Funcional</option>
              <option value="com_problema">Com problema</option>
            </Select>
            <Input
              placeholder="Link (opcional)"
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
            />
            <Textarea
              placeholder="Observações"
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={save}>
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-2.5">
              {ativo.observacoes && (
                <div
                  className={cn(
                    'flex gap-2 rounded-md border px-2.5 py-2 text-xs',
                    ativo.status === 'com_problema'
                      ? 'border-red-500/25 bg-red-500/5 text-red-200'
                      : 'border-border bg-bg-soft text-zinc-300',
                  )}
                >
                  {ativo.status === 'com_problema' && (
                    <AlertTriangle size={12} className="mt-0.5 shrink-0 text-red-400" />
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{ativo.observacoes}</p>
                </div>
              )}

              {ativo.link && (
                <a
                  href={ativo.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group/link inline-flex items-center gap-1.5 self-start rounded-md border border-border bg-bg-soft px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:border-brand-500/40 hover:bg-brand-500/5 hover:text-brand-300"
                >
                  <ExternalLink size={11} className="opacity-70" />
                  <span className="max-w-[180px] truncate">{ativo.link.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
            </div>

            {/* Footer: ações primeiro, timestamp sempre por último */}
            <div className="mt-auto flex flex-col gap-2.5 border-t border-border/60 pt-3">
              {tips && (
                <>
                  <button
                    onClick={() => setShowTips((v) => !v)}
                    className={cn(
                      'inline-flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-[11px] transition-colors',
                      showTips
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                        : 'border-border text-muted hover:border-amber-500/40 hover:text-amber-200',
                    )}
                    title="Ver boas práticas"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Lightbulb size={12} />
                      Boas práticas
                    </span>
                    <ChevronDown
                      size={12}
                      className={cn('transition-transform duration-200', showTips && 'rotate-180')}
                    />
                  </button>
                  {showTips && <BoasPraticasBlock tips={tips} />}
                </>
              )}
              <div className="flex items-center gap-1.5 text-[10.5px] text-muted">
                <Clock size={10} className="opacity-60" />
                {ativo.ultima_verificacao
                  ? `Verificado ${formatDateTime(ativo.ultima_verificacao)}`
                  : 'Ainda não verificado'}
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}

function BoasPraticasBlock({ tips }: { tips: BoaPratica }) {
  return (
    <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 animate-fade-in">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
        <Lightbulb size={12} />
        {tips.title}
      </div>
      <ul className="space-y-1.5 text-xs text-zinc-300">
        {tips.items.map((item, i) =>
          typeof item === 'string' ? (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 text-amber-400">•</span>
              <span>{item}</span>
            </li>
          ) : (
            <li key={i} className="flex flex-col gap-1">
              <span className="flex gap-2">
                <span className="mt-0.5 text-amber-400">•</span>
                <span className="font-medium text-zinc-200">{item.label}:</span>
              </span>
              <div className="ml-4 flex flex-wrap gap-1">
                {item.items.map((sub) => (
                  <span
                    key={sub}
                    className="rounded border border-border bg-bg-soft px-1.5 py-0.5 text-[11px] text-zinc-300"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}

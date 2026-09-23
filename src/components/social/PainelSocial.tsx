import { Link } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { formatDateBR } from '@/lib/dates'
import type {
  Cliente,
  ClientePerfilSetup,
  ItemSocialMedia,
  PlanejamentoSocialMedia,
} from '@/types/database'

interface Props {
  cliente: Cliente
  setup: ClientePerfilSetup | null
  items: ItemSocialMedia[]
  planejamentos: PlanejamentoSocialMedia[]
}

/**
 * Painel inicial da operação de Social Media (substitui a "Visão geral"
 * no contexto SM). Cobre 6.1 (rotina diária) e parte de 7 (KPIs) do playbook.
 */
export function PainelSocial({ cliente, setup, items, planejamentos }: Props) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const hojeStr = hoje.toISOString().slice(0, 10)
  const seteDiasFrente = new Date(hoje)
  seteDiasFrente.setDate(seteDiasFrente.getDate() + 7)
  const seteDiasFrenteStr = seteDiasFrente.toISOString().slice(0, 10)

  // Items do mês corrente
  const monthStart = `${hojeStr.slice(0, 7)}-01`
  const monthEnd = `${hojeStr.slice(0, 7)}-31` // string compare é OK

  const itemsDoMes = items.filter(
    (i) => i.prazo && i.prazo.slice(0, 10) >= monthStart && i.prazo.slice(0, 10) <= monthEnd,
  )

  // Próximos 7 dias — posts que ainda NÃO foram ao ar (publicado_em vazio).
  // Atenção: "conclusao" = arte pronta, NÃO publicado; o marcador de
  // publicação é publicado_em (setado no "Marcar como publicado").
  const proximos = items
    .filter(
      (i) =>
        i.prazo &&
        i.prazo.slice(0, 10) >= hojeStr &&
        i.prazo.slice(0, 10) <= seteDiasFrenteStr &&
        !i.publicado_em,
    )
    .sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''))
    .slice(0, 8)

  // Atrasados
  const atrasados = items.filter(
    (i) => i.status !== 'conclusao' && i.prazo && i.prazo.slice(0, 10) < hojeStr,
  )

  // KPI: % no prazo no mês
  const concluidos = itemsDoMes.filter((i) => i.status === 'conclusao').length
  const totalMes = itemsDoMes.length
  const pctNoPrazo = totalMes === 0 ? 0 : Math.round((concluidos / totalMes) * 100)

  // Setup completo?
  const setupOk =
    setup &&
    setup.foto_status === 'ok' &&
    setup.bio_status === 'ok' &&
    setup.destaques_status === 'ok' &&
    setup.contato_status === 'ok'

  // Alertas (cumulativos)
  const alertas: { tipo: 'erro' | 'atencao'; mensagem: string }[] = []
  if (atrasados.length > 0) {
    alertas.push({
      tipo: 'erro',
      mensagem: `${atrasados.length} post(s) atrasado(s) — comunique o AM imediatamente (playbook 8)`,
    })
  }
  if (cliente.jornada_social === 'postando' && !setupOk) {
    alertas.push({
      tipo: 'erro',
      mensagem:
        'Cliente está "Postando" mas o Setup do Perfil ainda tem item(s) pendente(s). Resolva antes da próxima postagem.',
    })
  }
  if (planejamentos.length === 0) {
    alertas.push({
      tipo: 'atencao',
      mensagem: 'Nenhum planejamento mensal cadastrado ainda. Crie um em "Planejamento mensal".',
    })
  }
  if (!cliente.instagram_handle) {
    alertas.push({
      tipo: 'atencao',
      mensagem: 'Sem @ do Instagram cadastrado — bloqueia integração com Meta API no futuro.',
    })
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Coluna esquerda: KPIs */}
      <div className="space-y-3 md:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>KPIs do mês</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <KpiInline
              label="% posts no prazo"
              value={`${pctNoPrazo}%`}
              tone={pctNoPrazo >= 80 ? 'success' : pctNoPrazo >= 50 ? 'warning' : 'danger'}
              icon={<TrendingUp size={14} />}
            />
            <KpiInline
              label="Posts publicados"
              value={`${concluidos}/${totalMes}`}
              tone="brand"
              icon={<CheckCircle2 size={14} />}
            />
            <KpiInline
              label="Atrasados"
              value={String(atrasados.length)}
              tone={atrasados.length > 0 ? 'danger' : 'success'}
              icon={<AlertCircle size={14} />}
            />
            <KpiInline
              label="Planejamentos"
              value={String(planejamentos.length)}
              tone="brand"
              icon={<Sparkles size={14} />}
            />
          </CardBody>
        </Card>
      </div>

      {/* Coluna meio: alertas + próximos */}
      <div className="space-y-3 md:col-span-2">
        {alertas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Alertas</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              {alertas.map((a, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
                    a.tipo === 'erro'
                      ? 'border-red-500/40 bg-red-500/10 text-red-200'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-200',
                  )}
                >
                  <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                  <span>{a.mensagem}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Próximos 7 dias</CardTitle>
            <Link
              to={`/social/clientes/${cliente.id}?tab=calendario`}
              className="text-xs text-pink-300 hover:underline"
            >
              ver calendário
            </Link>
          </CardHeader>
          <CardBody>
            {proximos.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">
                Nenhum post programado nos próximos 7 dias.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {proximos.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg-soft px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <DiaCircle prazo={p.prazo} hojeStr={hojeStr} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-100">{p.titulo}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge tone="neutral" className="!text-[9px]">
                            {p.formato}
                          </Badge>
                          <span className="text-[10px] text-muted capitalize">
                            {p.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={12} className="flex-shrink-0 text-muted" />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {atrasados.length > 0 && (
          <Card className="border-red-500/30">
            <CardHeader>
              <CardTitle className="text-red-300">Posts atrasados</CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="space-y-1.5">
                {atrasados.slice(0, 5).map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertCircle size={12} className="flex-shrink-0 text-red-300" />
                      <p className="truncate font-medium">{p.titulo}</p>
                    </div>
                    <span className="text-[10px] text-red-300">
                      {formatDateBR(p.prazo)}
                    </span>
                  </li>
                ))}
                {atrasados.length > 5 && (
                  <p className="text-[10px] text-muted text-center pt-1">
                    +{atrasados.length - 5} outros
                  </p>
                )}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}

function DiaCircle({ prazo, hojeStr }: { prazo: string | null; hojeStr: string }) {
  if (!prazo) return null
  const data = prazo.slice(0, 10)
  const ehHoje = data === hojeStr
  // dia direto da string (data.slice(8, 10)) — evita off-by-one de fuso
  const dia = parseInt(data.slice(8, 10), 10)
  return (
    <div
      className={cn(
        'inline-grid h-8 w-8 flex-shrink-0 place-items-center rounded border text-[11px] font-semibold tabular-nums',
        ehHoje
          ? 'border-amber-400 bg-amber-400/15 text-amber-200'
          : 'border-pink-500/40 bg-pink-500/10 text-pink-200',
      )}
    >
      {dia}
    </div>
  )
}

function KpiInline({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: string
  tone: 'success' | 'warning' | 'danger' | 'brand'
  icon: React.ReactNode
}) {
  const cor = {
    success: 'text-emerald-300',
    warning: 'text-amber-300',
    danger: 'text-red-300',
    brand: 'text-pink-300',
  }[tone]
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 text-xs text-muted">
        <span className={cor}>{icon}</span>
        {label}
      </span>
      <span className={cn('text-lg font-semibold tabular-nums', cor)}>{value}</span>
    </div>
  )
}

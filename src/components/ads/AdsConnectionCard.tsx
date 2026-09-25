/**
 * AdsConnectionCard — bloco de conexão de uma plataforma de anúncios na Ficha
 * do Cliente. Três estados: não conectado (2 modos), conexão direta e vínculo
 * via conta de agência (MCC no Google / Business Manager no Meta). Trata token
 * expirado. Genérico: o comportamento e os textos vêm do adapter.
 *
 * Tudo simulado (ver adsPlatform.ts): nenhuma chamada real de API.
 */
import { useEffect, useState } from 'react'
import { Building2, CheckCircle2, AlertTriangle, RefreshCw, Unlink, Link2 } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import {
  diasAtrasAds,
  fmtDataHoraAds,
  modoConexaoLabel,
  type AdsConexao,
  type AdsPlatformAdapter,
} from './adsPlatform'

export function AdsConnectionCard({
  adapter,
  clienteId,
  nomeCliente,
  onChanged,
}: {
  adapter: AdsPlatformAdapter
  clienteId: string
  nomeCliente: string
  onChanged: () => void
}) {
  const [estado, setEstado] = useState<AdsConexao>(() => adapter.getState(clienteId))
  const [modo, setModo] = useState<'direta' | 'agencia' | null>(null) // sub-form aberto
  const [contaId, setContaId] = useState('')
  const agency = adapter.getAgencyConfig()
  const Icon = adapter.icon
  const t = adapter.textos

  useEffect(() => {
    setEstado(adapter.getState(clienteId))
    setModo(null)
    setContaId('')
  }, [adapter, clienteId])

  function aplicar(s: AdsConexao) {
    setEstado(s)
    setModo(null)
    setContaId('')
    onChanged()
  }

  function confirmar() {
    const id = contaId.trim()
    if (!id) return
    aplicar(modo === 'agencia' ? adapter.vincularAgencia(clienteId, id) : adapter.conectarDireta(clienteId, id))
  }

  // ── Conectado (direta ou via agência) ──────────────────────────────────────
  if (estado.modo !== 'nao_conectado') {
    const expirado = estado.tokenStatus === 'expirado'
    return (
      <Card className={cn('border', expirado ? 'border-amber-500/40' : 'border-emerald-500/30')}>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                  expirado ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300',
                )}
              >
                <Icon size={17} />
              </div>
              <div>
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-zinc-100">
                  {expirado ? (
                    <AlertTriangle size={13} className="text-amber-300" />
                  ) : (
                    <CheckCircle2 size={13} className="text-emerald-300" />
                  )}
                  {adapter.nome} conectado — Conta{' '}
                  <span className={cn('tabular-nums', adapter.cores.texto)}>{estado.contaId}</span>
                  <span className="text-[11px] font-normal text-muted">· {modoConexaoLabel(adapter, estado.modo)}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {expirado
                    ? `Última sincronização: ${diasAtrasAds(estado.ultimaSincronizacao)} dias atrás — token expirado`
                    : `Última sincronização: ${fmtDataHoraAds(estado.ultimaSincronizacao)}`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {expirado ? (
                <Button size="sm" onClick={() => aplicar(adapter.simularSincronizacao(clienteId))}>
                  <RefreshCw size={13} /> Reenviar link de reconexão
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => aplicar(adapter.simularSincronizacao(clienteId))}>
                  <RefreshCw size={13} /> Sincronizar agora
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => aplicar(adapter.desconectar(clienteId))}>
                <Unlink size={13} /> Desconectar
              </Button>
            </div>
          </div>

          {expirado && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.07] px-3 py-2 text-[11px] text-amber-200">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              A conexão do {adapter.nome} deste cliente expirou. Reenvie o link de reconexão — os dados exibidos
              mantêm o último sincronizado.
            </div>
          )}
        </CardBody>
      </Card>
    )
  }

  // ── Não conectado ───────────────────────────────────────────────────────────
  return (
    <Card className="border border-border">
      <CardBody className="space-y-3">
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
              adapter.cores.fundoIcone,
              adapter.cores.texto,
            )}
          >
            <Icon size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">Integração com {adapter.nome}</p>
            <p className="mt-0.5 max-w-xl text-[11px] text-muted">{t.descricaoIntegracao}</p>
          </div>
        </div>

        {modo ? (
          <div className="rounded-lg border border-border bg-bg-soft/40 p-3">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
              ID da conta de anúncios ({modo === 'agencia' ? `via ${t.agenciaSigla}` : 'conexão direta'})
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={contaId}
                onChange={(e) => setContaId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmar()
                }}
                placeholder={t.contaPlaceholder}
                className="max-w-xs tabular-nums"
                autoFocus
              />
              <Button size="sm" onClick={confirmar} disabled={!contaId.trim()}>
                {modo === 'agencia' ? <Building2 size={13} /> : <Link2 size={13} />} Confirmar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setModo(null)}>
                Cancelar
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-muted">
              {modo === 'agencia' ? t.descricaoAgencia(nomeCliente) : t.descricaoDireta}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setModo('direta')}>
              <Link2 size={13} /> {t.botaoDireta}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModo('agencia')}
              disabled={!agency.conectado}
              title={agency.conectado ? undefined : `Configure o ${t.agenciaSigla} em Configurações › Integrações`}
            >
              <Building2 size={13} /> {t.botaoAgencia}
            </Button>
          </div>
        )}

        {!agency.conectado && !modo && (
          <p className="text-[10px] text-muted">
            A conexão via {t.agenciaSigla} exige a {t.agenciaNome} da agência configurada em{' '}
            <span className="text-zinc-300">Configurações › Integrações</span>.
          </p>
        )}
      </CardBody>
    </Card>
  )
}

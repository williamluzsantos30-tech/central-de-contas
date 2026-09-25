/**
 * GoogleAdsConnectionCard — bloco de conexão do Google Ads na Ficha do Cliente
 * (Operacional Tráfego › Visão geral). Três estados: não conectado (2 modos),
 * conexão direta e vínculo via Conta Gerenciadora (MCC). Trata token expirado.
 *
 * Tudo simulado (ver mockGoogleAds): nenhuma chamada real à Google Ads API.
 */
import { useEffect, useState } from 'react'
import { Megaphone, Building2, CheckCircle2, AlertTriangle, RefreshCw, Unlink, Link2 } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import {
  conectarDireta,
  desconectarGoogleAds,
  fmtDataHoraGA,
  diasAtrasGA,
  getAgencyGoogleAdsConfig,
  getGoogleAdsState,
  modoConexaoGaLabel,
  simularSincronizacaoGA,
  vincularMcc,
  type GoogleAdsConexao,
} from './mockGoogleAds'

export function GoogleAdsConnectionCard({
  clienteId,
  nomeCliente,
  onChanged,
}: {
  clienteId: string
  nomeCliente: string
  onChanged: () => void
}) {
  const [estado, setEstado] = useState<GoogleAdsConexao>(() => getGoogleAdsState(clienteId))
  const [modo, setModo] = useState<'direta' | 'mcc' | null>(null) // sub-form aberto
  const [contaId, setContaId] = useState('')
  const agency = getAgencyGoogleAdsConfig()

  useEffect(() => {
    setEstado(getGoogleAdsState(clienteId))
  }, [clienteId])

  function aplicar(s: GoogleAdsConexao) {
    setEstado(s)
    setModo(null)
    setContaId('')
    onChanged()
  }

  function confirmar() {
    const id = contaId.trim()
    if (!id) return
    aplicar(modo === 'mcc' ? vincularMcc(clienteId, id) : conectarDireta(clienteId, id))
  }

  // ── Conectado (direta ou MCC) ───────────────────────────────────────────────
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
                <Megaphone size={17} />
              </div>
              <div>
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-zinc-100">
                  {expirado ? (
                    <AlertTriangle size={13} className="text-amber-300" />
                  ) : (
                    <CheckCircle2 size={13} className="text-emerald-300" />
                  )}
                  Conectado — Conta <span className="tabular-nums text-sky-300">{estado.contaId}</span>
                  <span className="text-[11px] font-normal text-muted">· {modoConexaoGaLabel[estado.modo]}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {expirado
                    ? `Última sincronização: ${diasAtrasGA(estado.ultimaSincronizacao)} dias atrás — token expirado`
                    : `Última sincronização: ${fmtDataHoraGA(estado.ultimaSincronizacao)}`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {expirado && (
                <Button size="sm" onClick={() => aplicar(simularSincronizacaoGA(clienteId))}>
                  <RefreshCw size={13} /> Reenviar link de reconexão
                </Button>
              )}
              {!expirado && (
                <Button variant="outline" size="sm" onClick={() => aplicar(simularSincronizacaoGA(clienteId))}>
                  <RefreshCw size={13} /> Sincronizar agora
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => aplicar(desconectarGoogleAds(clienteId))}>
                <Unlink size={13} /> Desconectar
              </Button>
            </div>
          </div>

          {expirado && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.07] px-3 py-2 text-[11px] text-amber-200">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              A conexão do Google Ads deste cliente expirou. Reenvie o link de reconexão — os dados exibidos
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
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/15 text-sky-300">
            <Megaphone size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">Integração com Google Ads</p>
            <p className="mt-0.5 max-w-xl text-[11px] text-muted">
              Conecte a conta de anúncios para puxar as métricas e campanhas automaticamente
              (investimento, cliques, conversões, CPA). Há dois caminhos, conforme o acesso disponível.
            </p>
          </div>
        </div>

        {modo ? (
          <div className="rounded-lg border border-border bg-bg-soft/40 p-3">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
              ID da conta de anúncios ({modo === 'mcc' ? 'via MCC' : 'conexão direta'})
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={contaId}
                onChange={(e) => setContaId(e.target.value)}
                placeholder="123-456-7890"
                className="max-w-xs tabular-nums"
              />
              <Button size="sm" onClick={confirmar} disabled={!contaId.trim()}>
                {modo === 'mcc' ? <Building2 size={13} /> : <Link2 size={13} />} Confirmar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setModo(null)}>
                Cancelar
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-muted">
              {modo === 'mcc'
                ? `Vincula ${nomeCliente} à Conta Gerenciadora da agência — sem autorização individual do cliente.`
                : 'Simula o fluxo OAuth: o cliente autoriza a própria conta de anúncios do Google Ads.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setModo('direta')}>
              <Link2 size={13} /> 🔗 Conectar Google Ads
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModo('mcc')}
              disabled={!agency.conectado}
              title={agency.conectado ? undefined : 'Configure o MCC em Configurações › Integrações'}
            >
              <Building2 size={13} /> 🏢 Vincular via Conta Gerenciadora (MCC)
            </Button>
          </div>
        )}

        {!agency.conectado && !modo && (
          <p className="text-[10px] text-muted">
            A conexão via MCC exige a Conta Gerenciadora configurada em{' '}
            <span className="text-zinc-300">Configurações › Integrações</span>.
          </p>
        )}
      </CardBody>
    </Card>
  )
}

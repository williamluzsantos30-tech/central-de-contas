/**
 * InstagramConnectionCard — bloco de conexão do Instagram na Ficha do Cliente
 * (aba Operacional Social › Métricas). Três estados: não conectado (2 modos),
 * conexão direta e conexão via agência. Trata token expirado (Modo A).
 *
 * Tudo simulado (ver mockInstagram): nenhuma chamada real à Meta API.
 */
import { useState } from 'react'
import { Instagram, Building2, CheckCircle2, AlertTriangle, RefreshCw, Unlink, Link2 } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import {
  conectarDireta,
  desconectarInstagram,
  fmtDataHora,
  diasAtras,
  getAgencyConfig,
  getInstagramState,
  simularTokenExpirado,
  vincularAgencia,
  type ClienteInstagram,
} from './mockInstagram'

export function InstagramConnectionCard({
  clienteId,
  nomeCliente,
  onChanged,
}: {
  clienteId: string
  nomeCliente: string
  onChanged: () => void
}) {
  const [estado, setEstado] = useState<ClienteInstagram>(() => getInstagramState(clienteId))
  const [modo, setModo] = useState<'direta' | 'agencia' | null>(null) // form de handle aberto
  const [handle, setHandle] = useState('')
  const agency = getAgencyConfig()

  function aplicar(s: ClienteInstagram) {
    setEstado(s)
    setModo(null)
    setHandle('')
    onChanged()
  }

  function confirmar() {
    const h = handle.trim() || nomeCliente.toLowerCase().replace(/[^a-z0-9]/g, '')
    aplicar(modo === 'agencia' ? vincularAgencia(clienteId, h) : conectarDireta(clienteId, h))
  }

  // ── Conectado (direta ou agência) ─────────────────────────────────────────
  if (estado.modoConexao !== 'nao_conectado') {
    const viaAgencia = estado.modoConexao === 'agencia'
    const expirado = estado.tokenStatus === 'expirado'
    return (
      <Card className={cn('border', expirado ? 'border-amber-500/40' : 'border-emerald-500/30')}>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', expirado ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300')}>
                <Instagram size={17} />
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
                  {expirado ? <AlertTriangle size={13} className="text-amber-300" /> : <CheckCircle2 size={13} className="text-emerald-300" />}
                  {viaAgencia ? 'Conectado via Business Manager MovMed' : 'Conectado diretamente'}
                  <span className="text-brand-300">@{estado.handle}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {expirado
                    ? `Última sincronização: ${diasAtras(estado.ultimaSincronizacao)} dias atrás — token expirado`
                    : `Última sincronização: ${fmtDataHora(estado.ultimaSincronizacao)}`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {expirado && (
                <Button size="sm" onClick={() => aplicar(conectarDireta(clienteId, estado.handle))}>
                  <RefreshCw size={13} /> Reenviar link de reconexão
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => aplicar(desconectarInstagram(clienteId))}>
                <Unlink size={13} /> {viaAgencia ? 'Desvincular' : 'Desconectar'}
              </Button>
            </div>
          </div>

          {expirado && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.07] px-3 py-2 text-[11px] text-amber-200">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              A conexão com o Instagram deste cliente expirou. Peça para reconectar — os cards mantêm o último dado sincronizado.
            </div>
          )}

          {/* Dev/simulação: força a expiração do token (só Modo A). */}
          {!viaAgencia && !expirado && (
            <button onClick={() => aplicar(simularTokenExpirado(clienteId))} className="text-[10px] text-muted underline decoration-dotted hover:text-amber-300">
              simular expiração de token
            </button>
          )}
        </CardBody>
      </Card>
    )
  }

  // ── Não conectado ─────────────────────────────────────────────────────────
  return (
    <Card className="border border-border">
      <CardBody className="space-y-3">
        <div className="flex items-start gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
            <Instagram size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">Integração com Instagram</p>
            <p className="mt-0.5 max-w-xl text-[11px] text-muted">
              Conecte a conta para puxar as métricas automaticamente (posts, alcance, seguidores, engajamento).
              Nem todo cliente cede acesso — por isso há dois caminhos.
            </p>
          </div>
        </div>

        {modo ? (
          <div className="rounded-lg border border-border bg-bg-soft/40 p-3">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
              @ do Instagram do cliente ({modo === 'agencia' ? 'via agência' : 'conexão direta'})
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@cliente" className="max-w-xs" />
              <Button size="sm" onClick={confirmar}>
                {modo === 'agencia' ? <Building2 size={13} /> : <Link2 size={13} />} Confirmar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setModo(null)}>Cancelar</Button>
            </div>
            {modo === 'direta' && (
              <p className="mt-2 text-[10px] text-muted">
                Simula o fluxo OAuth: o cliente autoriza a própria conta Business/Creator (vinculada a uma Página do Facebook).
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setModo('direta')}>
              <Link2 size={13} /> Conectar Instagram do Cliente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModo('agencia')}
              disabled={!agency.conectado}
              title={agency.conectado ? undefined : 'Configure a conta de agência em Configurações › Integrações'}
            >
              <Building2 size={13} /> Vincular via Conta de Agência
            </Button>
          </div>
        )}

        {!agency.conectado && !modo && (
          <p className="text-[10px] text-muted">
            A conexão via agência exige o Business Manager configurado em <span className="text-zinc-300">Configurações › Integrações</span>.
          </p>
        )}
      </CardBody>
    </Card>
  )
}

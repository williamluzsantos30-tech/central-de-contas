import { useEffect, useState } from 'react'
import {
  Camera,
  FileText,
  Star,
  Phone,
  CheckCircle2,
  Clock,
  Circle,
  ExternalLink,
  Save,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { Cliente, ClientePerfilSetup, PerfilItemStatus } from '@/types/database'

interface Props {
  cliente: Cliente
  setup: ClientePerfilSetup | null
  onChanged: () => void
}

/**
 * Painel do Setup do Perfil — playbook 3.0.
 * 4 itens obrigatórios: Foto, Bio, Destaques, Contato.
 * Cada um com: status (pendente/em_revisao/ok), evidência, observação.
 *
 * Banner vermelho fica no topo se cliente está "Postando" mas o perfil
 * ainda tem itens pendentes (regra de ouro do playbook).
 */
export function SetupPerfilPanel({ cliente, setup, onChanged }: Props) {
  const { profile } = useAuth()
  const [s, setS] = useState<ClientePerfilSetup | null>(setup)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setS(setup)
  }, [setup])

  // Se a tabela não existe ainda (em produção sem migration 009 rodada),
  // ou se o cliente nunca teve setup, oferece criar do zero.
  if (!s) {
    return (
      <Card>
        <CardBody className="space-y-3 text-center">
          <p className="text-sm text-muted">
            Este cliente ainda não tem setup de perfil registrado.
          </p>
          <Button onClick={() => criarSetupInicial(cliente.id, onChanged)}>
            Criar checklist do perfil
          </Button>
        </CardBody>
      </Card>
    )
  }

  async function update(patch: Partial<ClientePerfilSetup>) {
    if (!s) return
    const novo = { ...s, ...patch } as ClientePerfilSetup
    setS(novo) // optimistic update
    setSaving(true)
    await supabase
      .from('cliente_perfil_setup')
      .update({
        ...patch,
        ultima_revisao_em: new Date().toISOString(),
        ultima_revisao_por: profile?.id ?? null,
      })
      .eq('cliente_id', cliente.id)
    setSaving(false)
    onChanged()
  }

  // Conta quantos itens estão "ok"
  const okCount =
    [s.foto_status, s.bio_status, s.destaques_status, s.contato_status].filter(
      (st) => st === 'ok',
    ).length
  const totalItens = 4
  const completo = okCount === totalItens
  const postando = cliente.jornada_social === 'postando'
  const alerta = postando && !completo

  return (
    <div className="space-y-4">
      {alerta && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Atenção: cliente em produção com setup incompleto</p>
            <p className="text-xs opacity-90">
              {cliente.nome} está com jornada <strong>Postando</strong> mas {totalItens - okCount}{' '}
              item(s) do perfil ainda não está(ão) OK. Conforme o playbook (Regra de Ouro):
              <em> "Perfil desalinhado enfraquece o tráfego."</em> Resolva antes da próxima postagem.
            </p>
          </div>
        </div>
      )}

      {/* Progresso geral */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">Setup do perfil</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {okCount}/{totalItens}
                <span className="ml-2 text-sm font-normal text-muted">itens completos</span>
              </p>
            </div>
            <div className="flex-1 max-w-[300px]">
              <div className="h-2 overflow-hidden rounded-full bg-bg-soft">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    completo ? 'bg-emerald-500' : 'bg-amber-500',
                  )}
                  style={{ width: `${(okCount / totalItens) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted">
                {completo ? '✓ Perfil otimizado e pronto pra tráfego' : 'Conforme playbook 3.0 — obrigatório completar'}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Itens */}
      <ItemPanel
        icon={Camera}
        titulo="Foto de perfil"
        subtitulo="Profissional, nítida, coerente com o posicionamento"
        status={s.foto_status}
        onStatusChange={(st) => update({ foto_status: st })}
        obs={s.foto_obs}
        onObsChange={(v) => update({ foto_obs: v })}
        extra={
          <FotoEvidencia
            url={s.foto_url}
            onUrlChange={(v) => update({ foto_url: v })}
          />
        }
        saving={saving}
      />

      <ItemPanel
        icon={FileText}
        titulo="Bio estratégica"
        subtitulo="Clareza de especialidade, proposta de valor e autoridade"
        status={s.bio_status}
        onStatusChange={(st) => update({ bio_status: st })}
        obs={s.bio_obs}
        onObsChange={(v) => update({ bio_obs: v })}
        extra={
          <BioEvidencia
            texto={s.bio_texto}
            onTextoChange={(v) => update({ bio_texto: v })}
          />
        }
        saving={saving}
      />

      <ItemPanel
        icon={Star}
        titulo="Destaques"
        subtitulo="Organizados, atualizados e alinhados à jornada do paciente/cliente"
        status={s.destaques_status}
        onStatusChange={(st) => update({ destaques_status: st })}
        obs={s.destaques_obs}
        onObsChange={(v) => update({ destaques_obs: v })}
        saving={saving}
      />

      <ItemPanel
        icon={Phone}
        titulo="Endereço e informações de contato"
        subtitulo="Corretos e padronizados (WhatsApp, e-mail, endereço)"
        status={s.contato_status}
        onStatusChange={(st) => update({ contato_status: st })}
        obs={s.contato_obs}
        onObsChange={(v) => update({ contato_obs: v })}
        saving={saving}
      />

      {s.ultima_revisao_em && (
        <p className="text-[11px] text-muted">
          Última revisão: {new Date(s.ultima_revisao_em).toLocaleDateString('pt-BR')} ·{' '}
          {new Date(s.ultima_revisao_em).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  )
}

async function criarSetupInicial(clienteId: string, onChanged: () => void) {
  await supabase.from('cliente_perfil_setup').insert({ cliente_id: clienteId })
  onChanged()
}

function ItemPanel({
  icon: Icon,
  titulo,
  subtitulo,
  status,
  onStatusChange,
  obs,
  onObsChange,
  extra,
  saving,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  titulo: string
  subtitulo: string
  status: PerfilItemStatus
  onStatusChange: (s: PerfilItemStatus) => void
  obs: string | null
  onObsChange: (v: string) => void
  extra?: React.ReactNode
  saving: boolean
}) {
  const [obsLocal, setObsLocal] = useState(obs ?? '')
  useEffect(() => setObsLocal(obs ?? ''), [obs])

  const borderClass =
    status === 'ok'
      ? 'border-emerald-500/40'
      : status === 'em_revisao'
      ? 'border-amber-500/40'
      : 'border-border'

  return (
    <Card className={cn('border', borderClass)}>
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'grid h-9 w-9 place-items-center rounded-lg border',
              status === 'ok'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : status === 'em_revisao'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-border bg-bg-soft text-muted',
            )}
          >
            <Icon size={16} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-zinc-100">{titulo}</h3>
            <p className="text-[11px] text-muted">{subtitulo}</p>
          </div>
          <StatusSelector value={status} onChange={onStatusChange} disabled={saving} />
        </div>

        {extra}

        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">
            Observações
          </label>
          <Textarea
            value={obsLocal}
            onChange={(e) => setObsLocal(e.target.value)}
            onBlur={() => obsLocal !== (obs ?? '') && onObsChange(obsLocal)}
            placeholder="Detalhes da última revisão, problemas a corrigir, etc."
            className="min-h-[60px] text-xs"
            disabled={saving}
          />
        </div>
      </CardBody>
    </Card>
  )
}

function StatusSelector({
  value,
  onChange,
  disabled,
}: {
  value: PerfilItemStatus
  onChange: (s: PerfilItemStatus) => void
  disabled?: boolean
}) {
  const opts: { val: PerfilItemStatus; label: string; tone: string; icon: React.ReactNode }[] = [
    { val: 'pendente', label: 'Pendente', tone: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300', icon: <Circle size={11} /> },
    { val: 'em_revisao', label: 'Em revisão', tone: 'border-amber-500/40 bg-amber-500/10 text-amber-200', icon: <Clock size={11} /> },
    { val: 'ok', label: 'OK', tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200', icon: <CheckCircle2 size={11} /> },
  ]

  return (
    <div className="inline-flex flex-shrink-0 gap-1">
      {opts.map((o) => (
        <button
          key={o.val}
          onClick={() => onChange(o.val)}
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors',
            value === o.val
              ? o.tone
              : 'border-border text-muted hover:text-zinc-200 hover:border-zinc-500',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

function FotoEvidencia({ url, onUrlChange }: { url: string | null; onUrlChange: (v: string) => void }) {
  const [val, setVal] = useState(url ?? '')
  useEffect(() => setVal(url ?? ''), [url])
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => val !== (url ?? '') && onUrlChange(val)}
          placeholder="Cole o link da foto atual ou um print"
          className="flex-1 min-w-[200px] text-xs"
        />
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs text-zinc-200 hover:bg-bg-elev"
          >
            <ExternalLink size={11} />
            Abrir
          </a>
        )}
      </div>
      {url && /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url) && (
        <img
          src={url}
          alt="foto de perfil"
          className="h-24 w-24 rounded-full border border-border object-cover"
        />
      )}
    </div>
  )
}

function BioEvidencia({
  texto,
  onTextoChange,
}: {
  texto: string | null
  onTextoChange: (v: string) => void
}) {
  const [val, setVal] = useState(texto ?? '')
  useEffect(() => setVal(texto ?? ''), [texto])
  return (
    <div>
      <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">
        Texto da bio aprovada
      </label>
      <Textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => val !== (texto ?? '') && onTextoChange(val)}
        placeholder="Cole aqui o texto exato da bio que está/deveria estar no perfil."
        className="min-h-[80px] font-mono text-xs leading-relaxed"
      />
    </div>
  )
}

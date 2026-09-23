/**
 * SyncResponsaveisButton — "🔄 Sincronizar Responsáveis pelo Squad".
 *
 * Correção retroativa: para clientes já cadastrados SEM Gestor de Tráfego /
 * Social Media, mas cujo squad tem UM responsável único daquela função em
 * Membros da Equipe, propõe o vínculo. O usuário revisa e confirma em lote
 * (não sobrescreve nada já preenchido).
 */
import { useState } from 'react'
import { RefreshCw, CheckCircle2, Users2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { suggestResponsavelBySquad } from '@/lib/responsaveisSquad'
import type { Cliente, Profile } from '@/types/database'

interface Proposta {
  clienteId: string
  clienteNome: string
  squad: string
  campo: 'gestor_id' | 'social_media_id'
  campoLabel: string
  membroId: string
  membroNome: string
}

const chave = (p: Proposta) => `${p.clienteId}:${p.campo}`

export function SyncResponsaveisButton({ onApplied }: { onApplied?: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [feito, setFeito] = useState<string | null>(null)

  async function abrir() {
    setOpen(true)
    setFeito(null)
    setLoading(true)
    const [cRes, sRes, pRes] = await Promise.all([
      supabase.from('clientes').select('id, nome, squad, gestor_id, social_media_id').is('arquivado_em', null),
      supabase.from('squads').select('id, nome'),
      supabase.from('profiles').select('*').eq('ativo', true).eq('aprovado', true),
    ])
    const clientes = (cRes.data as Pick<Cliente, 'id' | 'nome' | 'squad' | 'gestor_id' | 'social_media_id'>[]) ?? []
    const squadIdPorNome = new Map(((sRes.data as { id: string; nome: string }[]) ?? []).map((s) => [s.nome, s.id]))
    const profiles = (pRes.data as Profile[]) ?? []
    const nomePorId = new Map(profiles.map((p) => [p.id, p.nome]))

    const props: Proposta[] = []
    for (const c of clientes) {
      const sid = c.squad ? squadIdPorNome.get(c.squad) : null
      if (!sid) continue
      if (!c.gestor_id) {
        const sug = suggestResponsavelBySquad(profiles, sid, 'gestor_trafego')
        if (sug) props.push({ clienteId: c.id, clienteNome: c.nome, squad: c.squad!, campo: 'gestor_id', campoLabel: 'Gestor de Tráfego', membroId: sug, membroNome: nomePorId.get(sug) ?? '—' })
      }
      if (!c.social_media_id) {
        const sug = suggestResponsavelBySquad(profiles, sid, 'social_media')
        if (sug) props.push({ clienteId: c.id, clienteNome: c.nome, squad: c.squad!, campo: 'social_media_id', campoLabel: 'Social Media', membroId: sug, membroNome: nomePorId.get(sug) ?? '—' })
      }
    }
    setPropostas(props)
    setSelecionadas(new Set(props.map(chave)))
    setLoading(false)
  }

  function toggle(p: Proposta) {
    setSelecionadas((prev) => {
      const n = new Set(prev)
      const k = chave(p)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }

  async function aplicar() {
    setSalvando(true)
    // Agrupa por cliente (um cliente pode receber gestor E social no mesmo update).
    const patches = new Map<string, Record<string, string>>()
    for (const p of propostas) {
      if (!selecionadas.has(chave(p))) continue
      const patch = patches.get(p.clienteId) ?? {}
      patch[p.campo] = p.membroId
      patches.set(p.clienteId, patch)
    }
    await Promise.all([...patches.entries()].map(([id, patch]) => supabase.from('clientes').update(patch).eq('id', id)))
    setSalvando(false)
    setFeito(`${patches.size} cliente(s) atualizados.`)
    setPropostas([])
    onApplied?.()
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={abrir}>
        <RefreshCw size={13} /> Sincronizar Responsáveis pelo Squad
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Sincronizar Responsáveis pelo Squad"
          className="max-w-2xl"
          footer={
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted">{selecionadas.size} de {propostas.length} selecionados</span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setOpen(false)} disabled={salvando}>Fechar</Button>
                <Button onClick={aplicar} disabled={salvando || selecionadas.size === 0 || propostas.length === 0}>
                  <CheckCircle2 size={14} /> {salvando ? 'Aplicando…' : `Aplicar (${selecionadas.size})`}
                </Button>
              </div>
            </div>
          }
        >
          <p className="mb-3 text-[11px] text-muted">
            Clientes sem responsável cujo squad tem <strong className="text-zinc-300">exatamente um</strong> membro
            daquela função. Nada já preenchido é sobrescrito. Revise e confirme.
          </p>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted">Analisando…</p>
          ) : feito ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              <CheckCircle2 size={15} /> {feito}
            </div>
          ) : propostas.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-soft/40 p-4 text-xs text-muted">
              <Users2 size={15} /> Nenhum vínculo a sugerir — todos os clientes elegíveis já têm responsável, ou o squad não tem um responsável único.
            </div>
          ) : (
            <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
              {propostas.map((p) => {
                const sel = selecionadas.has(chave(p))
                return (
                  <label key={chave(p)} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-bg-soft/40 px-3 py-2.5 hover:border-brand-500/30">
                    <input type="checkbox" checked={sel} onChange={() => toggle(p)} className="h-4 w-4 accent-brand-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">{p.clienteNome}</p>
                      <p className="text-[11px] text-muted">squad <span className="text-zinc-300">{p.squad}</span></p>
                    </div>
                    <Badge tone={p.campo === 'gestor_id' ? 'brand' : 'neutral'} className="!text-[9px]">{p.campoLabel}</Badge>
                    <span className="shrink-0 text-xs text-zinc-200">→ {p.membroNome}</span>
                  </label>
                )
              })}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}

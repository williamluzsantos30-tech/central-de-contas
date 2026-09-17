import { useEffect, useMemo, useState } from 'react'
import { Users2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { temCargo } from '@/lib/cargos'
import { TIPOS_CLIENTE, tipoClienteLabel } from '@/lib/utils'
import { useSquads } from '@/hooks/useSquads'
import type { Cliente, ModuloCliente, Profile } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  cliente?: Cliente | null
  onSaved: () => void
  /**
   * Módulo a ser pré-marcado quando criando um novo cliente.
   * Usado pra que "Novo cliente" da tela de Tráfego abra com
   * 'trafego' já marcado, e da tela de Social Media com
   * 'social_media' já marcado.
   * Default: 'trafego' (compat com fluxo atual).
   */
  defaultModulo?: ModuloCliente
}

const todayISO = () => new Date().toISOString().slice(0, 10)

const empty = {
  nome: '',
  nicho: '',
  squad: '',
  tipo: '',
  modulos: ['trafego'] as ModuloCliente[],
  gestor_id: '',
  account_manager_id: '',
  social_media_id: '',
  status: 'ativo',
  jornada: '',
  jornada_social: '',
  nps: '' as string | number,
  semaforo: '',
  plataformas: 'ambos',
  data_inicio: todayISO(),
  verba_mensal: '' as string | number,
  verba_google: '' as string | number,
  verba_meta: '' as string | number,
  fonte_crm: 'nativo',
  kommo_account_id: '',
  observacoes: '',
}

export function ClienteForm({ open, onClose, cliente, onSaved, defaultModulo = 'trafego' }: Props) {
  const [form, setForm] = useState({ ...empty, modulos: [defaultModulo] as ModuloCliente[] })
  const [profilesAll, setProfilesAll] = useState<Profile[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { nomes: squadsAtivos, squads } = useSquads()

  // Squad selecionado (por nome) + seus membros — pra mostrar "membros
  // deste squad" e marcar "(mesmo squad)" nos dropdowns de responsáveis.
  const squadSelecionadoId = useMemo(
    () => squads.find((s) => s.nome === form.squad)?.id ?? null,
    [squads, form.squad],
  )
  const membrosSquad = useMemo(
    () =>
      squadSelecionadoId
        ? profilesAll.filter((p) => p.squad_id === squadSelecionadoId)
        : [],
    [profilesAll, squadSelecionadoId],
  )
  const mesmoSquad = (p: Profile) =>
    squadSelecionadoId && p.squad_id === squadSelecionadoId ? ' (mesmo squad)' : ''

  // Profiles agrupados por cargo — cada dropdown só lista quem é
  // diretamente vinculado àquela função.
  const accountManagers = useMemo(
    () => profilesAll.filter((p) => temCargo(p, 'account_manager')),
    [profilesAll],
  )
  const gestoresTrafego = useMemo(
    () => profilesAll.filter((p) => temCargo(p, 'gestor_trafego')),
    [profilesAll],
  )
  const socialMedias = useMemo(
    () => profilesAll.filter((p) => temCargo(p, 'social_media')),
    [profilesAll],
  )

  useEffect(() => {
    if (!open) return
    supabase
      .from('profiles')
      .select('*')
      .eq('ativo', true)
      .eq('aprovado', true)
      .order('nome')
      .then(({ data }) => setProfilesAll((data as Profile[]) ?? []))
    if (cliente) {
      setForm({
        nome: cliente.nome,
        nicho: cliente.nicho ?? '',
        squad: cliente.squad ?? '',
        tipo: cliente.tipo ?? '',
        modulos:
          cliente.modulos && cliente.modulos.length > 0
            ? cliente.modulos
            : ['trafego'],
        gestor_id: cliente.gestor_id ?? '',
        account_manager_id: cliente.account_manager_id ?? '',
        social_media_id: cliente.social_media_id ?? '',
        status: cliente.status,
        jornada: cliente.jornada ?? '',
        jornada_social: cliente.jornada_social ?? '',
        nps: cliente.nps ?? '',
        semaforo: cliente.semaforo ?? '',
        plataformas: cliente.plataformas ?? 'ambos',
        data_inicio: (cliente.data_inicio ?? todayISO()).slice(0, 10),
        verba_mensal: cliente.verba_mensal ?? '',
        verba_google: cliente.verba_google ?? '',
        verba_meta: cliente.verba_meta ?? '',
        fonte_crm: cliente.fonte_crm,
        kommo_account_id: cliente.kommo_account_id ?? '',
        observacoes: cliente.observacoes ?? '',
      })
    } else {
      setForm({ ...empty, modulos: [defaultModulo] })
    }
    setError(null)
  }, [open, cliente, defaultModulo])

  async function save() {
    setSaving(true)
    setError(null)
    const isNovo = !cliente
    // Sem o seletor "Atende em": os módulos derivam de QUEM atende o cliente.
    // Tráfego é a base (contexto de criação ou gestor vinculado); social entra
    // quando há um Social Media responsável vinculado (que no social é sempre
    // obrigatório). É o que faz o Operacional Social aparecer na ficha.
    const mods = new Set<ModuloCliente>(
      cliente?.modulos && cliente.modulos.length > 0 ? cliente.modulos : [defaultModulo],
    )
    if (form.gestor_id) mods.add('trafego')
    if (form.social_media_id) mods.add('social_media')
    else mods.delete('social_media')
    if (mods.size === 0) mods.add('trafego')
    const modulosFinal = Array.from(mods)

    // Novo cliente sempre comeca em 'onboarding'. Edicao preserva a jornada
    // atual (definida em outra tela). Mesma logica pra jornada_social se o
    // cliente atende Social Media.
    const jornadaFinal = isNovo && modulosFinal.includes('trafego') ? 'onboarding' : form.jornada || null
    const jornadaSocialFinal =
      isNovo && modulosFinal.includes('social_media') ? 'onboarding' : form.jornada_social || null

    const payload = {
      nome: form.nome.trim(),
      nicho: form.nicho || null,
      squad: form.squad || null,
      tipo: form.tipo || null,
      modulos: modulosFinal,
      gestor_id: form.gestor_id || null,
      account_manager_id: form.account_manager_id || null,
      social_media_id: form.social_media_id || null,
      status: form.status,
      jornada: jornadaFinal,
      jornada_social: jornadaSocialFinal,
      nps: form.nps === '' ? null : Number(form.nps),
      semaforo: form.semaforo || null,
      plataformas: form.plataformas || null,
      data_inicio: form.data_inicio || todayISO(),
      verba_mensal: form.verba_mensal === '' ? null : Number(form.verba_mensal),
      verba_google: form.verba_google === '' ? null : Number(form.verba_google),
      verba_meta: form.verba_meta === '' ? null : Number(form.verba_meta),
      fonte_crm: form.fonte_crm,
      kommo_account_id: form.kommo_account_id || null,
      observacoes: form.observacoes || null,
    }
    if (!payload.nome) {
      setError('Nome é obrigatório')
      setSaving(false)
      return
    }
    if (!form.tipo) {
      setError('Tipo de Serviço é obrigatório')
      setSaving(false)
      return
    }
    if (!form.squad) {
      setError('Squad é obrigatório')
      setSaving(false)
      return
    }
    if (!form.account_manager_id) {
      setError('Account Manager é obrigatório')
      setSaving(false)
      return
    }
    if (form.verba_mensal === '' || Number(form.verba_mensal) <= 0) {
      setError('Ticket Mensal é obrigatório e precisa ser maior que zero')
      setSaving(false)
      return
    }
    const { error: err } = cliente
      ? await supabase.from('clientes').update(payload).eq('id', cliente.id)
      : await supabase.from('clientes').insert(payload)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cliente ? `Editar Cliente: ${cliente.nome}` : 'Novo cliente'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        <Field label="Nome *">
          <Input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Clínica Exemplo"
          />
        </Field>

        <Field label="Squad *">
          <Select value={form.squad} onChange={(e) => setForm({ ...form, squad: e.target.value })}>
            <option value="">Selecione o squad</option>
            {/* Se o cliente já tem um squad que não está ativo no banco, ainda mostra ele aqui */}
            {form.squad && !squadsAtivos.includes(form.squad) && (
              <option value={form.squad}>{form.squad} (desativado)</option>
            )}
            {squadsAtivos.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        {form.squad && (
          <div className="-mt-1 rounded-lg border border-border bg-bg-soft px-3 py-2.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
              <Users2 size={11} /> Membros deste squad
            </p>
            {membrosSquad.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {membrosSquad.map((m) => (
                  <span
                    key={m.id}
                    className="rounded border border-border bg-bg-elev px-1.5 py-0.5 text-[11px] text-zinc-300"
                  >
                    {m.nome}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted">Nenhum membro vinculado a este squad ainda.</p>
            )}
          </div>
        )}

        <Field label="Account Manager *">
          <Select
            value={form.account_manager_id}
            onChange={(e) => setForm({ ...form, account_manager_id: e.target.value })}
          >
            <option value="">Selecione o AM</option>
            {accountManagers.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
                {mesmoSquad(g)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Gestor de Tráfego (opcional)">
          <Select
            value={form.gestor_id}
            onChange={(e) => setForm({ ...form, gestor_id: e.target.value })}
          >
            <option value="">Nenhum</option>
            {gestoresTrafego.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
                {mesmoSquad(g)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Social Media (opcional)">
          <Select
            value={form.social_media_id}
            onChange={(e) => setForm({ ...form, social_media_id: e.target.value })}
          >
            <option value="">Nenhum</option>
            {socialMedias.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
                {mesmoSquad(g)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Ticket Mensal (R$) *">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.verba_mensal}
            onChange={(e) => setForm({ ...form, verba_mensal: e.target.value })}
            placeholder="0,00"
          />
          <p className="mt-1 text-[10px] text-muted">
            Fee mensal que o cliente paga pra agência. Alimenta o MRR na Visão Executiva.
          </p>
        </Field>

        <Field label="Data de Entrada">
          <Input
            type="date"
            value={form.data_inicio}
            onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
          />
        </Field>

        <Field label="Especialidade">
          <Input
            value={form.nicho}
            onChange={(e) => setForm({ ...form, nicho: e.target.value })}
            placeholder="Ex: Dermatologia, Cardiologia..."
          />
        </Field>

        {/* Campos que alimentam KPIs/relatórios — mantidos abaixo dos
            principais. Jornada/verbas/plataforma/CRM saíram (form enxuto);
            jornada nova = 'onboarding' automático no save. */}
        <Field label="Tipo de Serviço *">
          <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="">—</option>
            {TIPOS_CLIENTE.map((t) => (
              <option key={t} value={t}>
                {tipoClienteLabel[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Observações">
          <Textarea
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={full ? 'col-span-2 flex flex-col gap-1.5' : 'flex flex-col gap-1.5'}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}


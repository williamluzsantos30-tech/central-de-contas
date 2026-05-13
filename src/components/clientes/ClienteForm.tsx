import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { temCargo } from '@/lib/cargos'
import {
  TIPOS_CLIENTE,
  tipoClienteLabel,
  JORNADAS_CLIENTE,
  jornadaClienteLabel,
  JORNADAS_SOCIAL,
  jornadaSocialLabel,
} from '@/lib/utils'
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
  const { nomes: squadsAtivos } = useSquads()

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

  function toggleModulo(m: ModuloCliente) {
    setForm((prev) => {
      const has = prev.modulos.includes(m)
      const next = has ? prev.modulos.filter((x) => x !== m) : [...prev.modulos, m]
      // Garante pelo menos um módulo marcado
      return { ...prev, modulos: next.length > 0 ? next : prev.modulos }
    })
  }

  async function save() {
    setSaving(true)
    setError(null)
    const payload = {
      nome: form.nome.trim(),
      nicho: form.nicho || null,
      squad: form.squad || null,
      tipo: form.tipo || null,
      modulos: form.modulos.length > 0 ? form.modulos : ['trafego'],
      gestor_id: form.gestor_id || null,
      account_manager_id: form.account_manager_id || null,
      social_media_id: form.social_media_id || null,
      status: form.status,
      jornada: form.jornada || null,
      jornada_social: form.jornada_social || null,
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
    // Cliente em SM precisa ter Social Media responsável vinculado
    if (form.modulos.includes('social_media') && !form.social_media_id) {
      setError('Cliente em Social Media precisa ter um responsável vinculado.')
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

  // Flags pra mostrar/esconder campos conforme os módulos selecionados.
  const temTrafego = form.modulos.includes('trafego')
  const temSocial = form.modulos.includes('social_media')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cliente ? 'Editar cliente' : 'Novo cliente'}
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

      {/* Módulos: define em qual(is) operação(ões) o cliente aparece */}
      <div className="mb-3 rounded-lg border border-border bg-bg-soft px-3 py-2.5">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
          Atende em
        </div>
        <div className="flex flex-wrap gap-2">
          <ModuloCheckbox
            checked={form.modulos.includes('trafego')}
            onChange={() => toggleModulo('trafego')}
            label="Tráfego pago"
            tone="orange"
          />
          <ModuloCheckbox
            checked={form.modulos.includes('social_media')}
            onChange={() => toggleModulo('social_media')}
            label="Social Media"
            tone="pink"
          />
        </div>
        <p className="mt-1.5 text-[10px] text-muted">
          Define em qual operação o cliente aparece. Pode marcar os dois se ele contrata os dois serviços.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" full>
          <Input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Clínica Exemplo"
          />
        </Field>
        <Field label="Nicho">
          <Input
            value={form.nicho}
            onChange={(e) => setForm({ ...form, nicho: e.target.value })}
            placeholder="Dermato, Oftalmo..."
          />
        </Field>
        <Field label="Squad">
          <Select value={form.squad} onChange={(e) => setForm({ ...form, squad: e.target.value })}>
            <option value="">—</option>
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
        <Field label="Tipo">
          <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="">—</option>
            {TIPOS_CLIENTE.map((t) => (
              <option key={t} value={t}>
                {tipoClienteLabel[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Account Manager">
          <Select
            value={form.account_manager_id}
            onChange={(e) => setForm({ ...form, account_manager_id: e.target.value })}
          >
            <option value="">—</option>
            {accountManagers.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Select>
        </Field>
        {temTrafego && (
          <Field label="Gestor de Tráfego">
            <Select
              value={form.gestor_id}
              onChange={(e) => setForm({ ...form, gestor_id: e.target.value })}
            >
              <option value="">—</option>
              {gestoresTrafego.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {temSocial && (
          <Field label="Social Media (responsável) *">
            <Select
              value={form.social_media_id}
              onChange={(e) => setForm({ ...form, social_media_id: e.target.value })}
            >
              <option value="">— selecione —</option>
              {socialMedias.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Status">
          <Select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="ativo">Ativo</option>
            <option value="atencao">Atenção</option>
            <option value="pausado">Pausado</option>
            <option value="churn">Churn</option>
          </Select>
        </Field>
        {temTrafego && (
          <Field label={temSocial ? 'Jornada (Tráfego)' : 'Jornada'}>
            <Select
              value={form.jornada}
              onChange={(e) => setForm({ ...form, jornada: e.target.value })}
            >
              <option value="">—</option>
              {JORNADAS_CLIENTE.map((j) => (
                <option key={j} value={j}>
                  {jornadaClienteLabel[j]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {temSocial && (
          <Field label={temTrafego ? 'Jornada (Social Media)' : 'Jornada'}>
            <Select
              value={form.jornada_social}
              onChange={(e) => setForm({ ...form, jornada_social: e.target.value })}
            >
              <option value="">—</option>
              {JORNADAS_SOCIAL.map((j) => (
                <option key={j} value={j}>
                  {jornadaSocialLabel[j]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {temTrafego && (
          <Field label="Plataformas">
            <Select
              value={form.plataformas}
              onChange={(e) => setForm({ ...form, plataformas: e.target.value })}
            >
              <option value="google_ads">Google Ads</option>
              <option value="meta_ads">Meta Ads</option>
              <option value="ambos">Google + Meta</option>
            </Select>
          </Field>
        )}
        <Field label="Data de entrada">
          <Input
            type="date"
            value={form.data_inicio}
            onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
          />
        </Field>
        {temTrafego && (
          <>
            <Field label="Verba Google (R$)">
              <Input
                type="number"
                step="0.01"
                value={form.verba_google}
                onChange={(e) => setForm({ ...form, verba_google: e.target.value })}
                placeholder="0,00"
              />
            </Field>
            <Field label="Verba Meta (R$)">
              <Input
                type="number"
                step="0.01"
                value={form.verba_meta}
                onChange={(e) => setForm({ ...form, verba_meta: e.target.value })}
                placeholder="0,00"
              />
            </Field>
            <Field label="Fonte CRM">
              <Select
                value={form.fonte_crm}
                onChange={(e) => setForm({ ...form, fonte_crm: e.target.value })}
              >
                <option value="nativo">Nativo</option>
                <option value="kommo">Kommo</option>
              </Select>
            </Field>
            {form.fonte_crm === 'kommo' && (
              <Field label="Kommo account ID">
                <Input
                  value={form.kommo_account_id}
                  onChange={(e) => setForm({ ...form, kommo_account_id: e.target.value })}
                />
              </Field>
            )}
          </>
        )}
        <Field label="Observações" full>
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

function ModuloCheckbox({
  checked,
  onChange,
  label,
  tone,
}: {
  checked: boolean
  onChange: () => void
  label: string
  tone: 'orange' | 'pink'
}) {
  const baseChecked =
    tone === 'orange'
      ? 'border-orange-400/60 bg-orange-500/15 text-orange-200'
      : 'border-pink-400/60 bg-pink-500/15 text-pink-200'
  const baseUnchecked =
    'border-border bg-bg-elev text-muted hover:text-zinc-200 hover:border-zinc-500'
  return (
    <button
      type="button"
      onClick={onChange}
      className={
        'inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ' +
        (checked ? baseChecked : baseUnchecked)
      }
    >
      <span
        className={
          'inline-grid h-3.5 w-3.5 place-items-center rounded border ' +
          (checked
            ? tone === 'orange'
              ? 'border-orange-400 bg-orange-400/30'
              : 'border-pink-400 bg-pink-400/30'
            : 'border-zinc-500')
        }
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label}
    </button>
  )
}

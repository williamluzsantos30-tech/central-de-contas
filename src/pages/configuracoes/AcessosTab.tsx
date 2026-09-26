/**
 * Configurações › Gerenciar Acessos (movido do Admin em 25/09/2026).
 * Aprovar/rejeitar quem pediu acesso, criar usuário, ativar/desativar,
 * nível de acesso (role) e foto. A FUNÇÃO de cada pessoa (papel) e o squad
 * NÃO são editados aqui — vêm de Configurações › Equipe Operacional (aqui
 * só aparecem, com atalho pra lá). O `cargo`/`cargos_extras` antigo não é
 * mais editável; lib/cargos lê o papel junto.
 *
 * SÓ ADMIN: a aba só aparece (e só renderiza) pra role 'admin' — ver
 * Configuracoes.tsx. Configurações é aberta a todos; isto não.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Clock, Eye, EyeOff, RefreshCw, UserCheck, UserPlus, X } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { cn, formatDateTime, userRoleLabel } from '@/lib/utils'
import { EditarFotoPerfilModal } from '@/components/layout/EditarFotoPerfilModal'
import type { Profile } from '@/types/database'

/**
 * Usuários do sistema divididos em pendentes (aguardando aprovação) e
 * aprovados, com papel e squad da Equipe Operacional (só leitura aqui).
 */
export function useUsuariosAcesso(ativo = true) {
  const [usuarios, setUsuarios] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    const completo = await supabase
      .from('profiles')
      .select('*, papel:papeis_operacionais!profiles_papel_fk(*), squad:squads!profiles_squad_fk(*)')
      .order('nome')
    // Sem as FKs da Equipe Operacional (083) → lista simples, sem papel/squad.
    const { data } = completo.error ? await supabase.from('profiles').select('*').order('nome') : completo
    setUsuarios((data as Profile[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    if (ativo) void load()
  }, [ativo, load])
  const pendentes = useMemo(() => usuarios.filter((u) => !u.aprovado), [usuarios])
  const aprovados = useMemo(() => usuarios.filter((u) => u.aprovado), [usuarios])
  return { pendentes, aprovados, loading, reload: load }
}

/* =========================================================
   Tab: Gerenciar Acessos
   ========================================================= */

/**
 * Papel · Squad vindos da Equipe Operacional — SÓ LEITURA aqui: a função
 * de cada pessoa (gestor, social media, AM…) é definida lá, não em Acessos.
 */
function PapelEquipe({ u, onIrParaEquipe }: { u: Profile; onIrParaEquipe?: () => void }) {
  if (!u.papel) {
    return (
      <button
        type="button"
        onClick={onIrParaEquipe}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-orange-500/50 px-2 py-0.5 text-[10px] text-orange-300 transition-colors hover:bg-orange-500/10"
        title="Definir papel e squad em Configurações › Equipe Operacional"
      >
        Sem papel — definir em Equipe Operacional
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onIrParaEquipe}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-elev px-2 py-0.5 text-[10px] text-zinc-300 transition-colors hover:border-brand-500/40"
      title="Papel e squad vêm de Configurações › Equipe Operacional"
    >
      {u.papel.nome}
      <span className="text-muted">· {u.squad?.nome ?? 'sem squad'}</span>
    </button>
  )
}

export function AcessosTab({
  pendentes,
  aprovados,
  loading,
  onChange,
  onIrParaEquipe,
}: {
  pendentes: Profile[]
  aprovados: Profile[]
  loading: boolean
  onChange: () => void
  /** Abre a aba Equipe Operacional (onde papel e squad são definidos). */
  onIrParaEquipe?: () => void
}) {
  const [criarOpen, setCriarOpen] = useState(false)
  const [editFoto, setEditFoto] = useState<Profile | null>(null)

  async function aprovar(p: Profile) {
    await supabase.from('profiles').update({ aprovado: true, ativo: true }).eq('id', p.id)
    onChange()
  }
  async function rejeitar(p: Profile) {
    if (!confirm(`Rejeitar acesso de ${p.nome}?`)) return
    await supabase.from('profiles').delete().eq('id', p.id)
    onChange()
  }
  async function toggleAtivo(p: Profile) {
    await supabase.from('profiles').update({ ativo: !p.ativo }).eq('id', p.id)
    onChange()
  }
  async function alterarRole(p: Profile, role: Profile['role']) {
    await supabase.from('profiles').update({ role }).eq('id', p.id)
    onChange()
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setCriarOpen(true)}>
          <UserPlus size={14} /> Criar Usuário
        </Button>
      </div>

      {/* Aguardando aprovação */}
      <Card className="overflow-hidden">
        <div className="relative border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-300">
              <Clock size={15} />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-amber-200 leading-tight flex items-center gap-2">
                Aguardando Aprovação
                {pendentes.length > 0 && (
                  <Badge tone="warning">{pendentes.length}</Badge>
                )}
              </h3>
              <p className="text-[11px] text-muted leading-tight mt-0.5">
                Novos usuários que solicitaram acesso ao sistema
              </p>
            </div>
          </div>
        </div>
        <CardBody className="p-4">
          {loading ? (
            <p className="text-xs text-muted">Carregando...</p>
          ) : pendentes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg-soft/40 py-10 text-center">
              <UserCheck size={28} className="text-muted/60" />
              <p className="text-sm text-muted">Nenhum usuário aguardando aprovação</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {pendentes.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.03] px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={u.nome} url={u.avatar_url} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100 truncate">{u.nome}</p>
                      <p className="text-[11px] text-muted truncate">{u.email}</p>
                      <p className="text-[10px] text-muted/70 mt-0.5">
                        Solicitado em {formatDateTime(u.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <PapelEquipe u={u} onIrParaEquipe={onIrParaEquipe} />
                    <Select
                      value={u.role}
                      onChange={(e) => alterarRole(u, e.target.value as Profile['role'])}
                      className="w-28 h-8 text-[12px]"
                    >
                      <option value="admin">{userRoleLabel.admin}</option>
                      <option value="gestor">{userRoleLabel.gestor}</option>
                      <option value="supervisor">{userRoleLabel.supervisor}</option>
                    </Select>
                    <button
                      onClick={() => aprovar(u)}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[12px] text-emerald-300 transition-colors hover:bg-emerald-500/20"
                    >
                      <Check size={13} /> Aprovar
                    </button>
                    <button
                      onClick={() => rejeitar(u)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[12px] text-red-300 transition-colors hover:bg-red-500/20"
                    >
                      <X size={13} /> Rejeitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Usuários aprovados */}
      <Card className="overflow-hidden">
        <div className="relative border-b border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
              <UserCheck size={15} />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-emerald-200 leading-tight flex items-center gap-2">
                Usuários Aprovados
                <Badge tone="success">{aprovados.length}</Badge>
              </h3>
              <p className="text-[11px] text-muted leading-tight mt-0.5">
                Usuários com acesso ao sistema
              </p>
            </div>
          </div>
        </div>
        <CardBody className="p-4">
          {loading ? (
            <p className="text-xs text-muted">Carregando...</p>
          ) : aprovados.length === 0 ? (
            <p className="text-xs text-muted">Nenhum usuário aprovado.</p>
          ) : (
            <ul className="space-y-2">
              {aprovados.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg-soft/40 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      onClick={() => setEditFoto(u)}
                      className="group relative shrink-0"
                      title="Trocar foto"
                    >
                      <Avatar name={u.nome} url={u.avatar_url} size="sm" />
                      <span className="absolute inset-0 grid place-items-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="text-[8px] text-white">📷</span>
                      </span>
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100 truncate">{u.nome}</p>
                      <p className="text-[11px] text-muted truncate">{u.email}</p>
                    </div>
                    {!u.ativo && (
                      <Badge tone="neutral" className="text-[10px]">
                        desativado
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <PapelEquipe u={u} onIrParaEquipe={onIrParaEquipe} />
                    <Select
                      value={u.role}
                      onChange={(e) => alterarRole(u, e.target.value as Profile['role'])}
                      className="w-28 h-8 text-[12px]"
                      title="Nível de acesso"
                    >
                      <option value="admin">{userRoleLabel.admin}</option>
                      <option value="gestor">{userRoleLabel.gestor}</option>
                      <option value="supervisor">{userRoleLabel.supervisor}</option>
                    </Select>
                    <Button
                      size="sm"
                      variant={u.ativo ? 'secondary' : 'primary'}
                      onClick={() => toggleAtivo(u)}
                    >
                      {u.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <CriarUsuarioModal open={criarOpen} onClose={() => setCriarOpen(false)} onCreated={onChange} />

      {editFoto && (
        <EditarFotoPerfilModal
          open
          onClose={() => setEditFoto(null)}
          profile={editFoto}
          onSaved={onChange}
        />
      )}
    </div>
  )
}

/* =========================================================
   Modal: Criar Usuário
   ========================================================= */

function generateRandomPassword(length = 12) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*'
  let out = ''
  const arr = new Uint32Array(length)
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(arr)
    for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length]
  } else {
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

function CriarUsuarioModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    role: 'gestor' as Profile['role'],
    aprovadoImediato: true,
  })
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm({
        nome: '',
        email: '',
        senha: '',
        role: 'gestor',
        aprovadoImediato: true,
      })
      setShowPwd(false)
      setError(null)
    }
  }, [open])

  async function save() {
    if (!form.nome.trim()) return setError('Nome é obrigatório')
    if (!form.email.trim()) return setError('E-mail é obrigatório')
    if (!form.senha.trim()) return setError('Senha é obrigatória')
    if (form.senha.length < 6) return setError('Senha precisa ter pelo menos 6 caracteres')
    setSaving(true)
    setError(null)

    const email = form.email.trim()

    // Verifica se já existe profile com esse e-mail
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, nome, role')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      // Email já existe — pergunta se quer atualizar
      const ok = confirm(
        `Já existe um cadastro com esse e-mail:\n\n` +
          `• Nome: ${existing.nome}\n` +
          `• Role: ${existing.role}\n\n` +
          `Deseja atualizar os dados desse cadastro com as informações que você acabou de preencher?`,
      )
      if (!ok) {
        setSaving(false)
        setError('Use um e-mail diferente ou confirme a atualização.')
        return
      }
      const { error: errUpd } = await supabase
        .from('profiles')
        .update({
          nome: form.nome.trim(),
          role: form.role,
          ativo: true,
          aprovado: form.aprovadoImediato,
        })
        .eq('id', (existing as { id: string }).id)
      setSaving(false)
      if (errUpd) {
        setError(errUpd.message)
        return
      }
      onCreated()
      onClose()
      return
    }

    // A senha em si não é persistida em `profiles` — em Supabase real ela vai para `auth.users`
    // através do fluxo de Auth (signUp/invite). O admin deve compartilhar a senha manualmente
    // com o usuário ou usar o botão "Convidar" do Supabase Dashboard.
    const { error: err } = await supabase.from('profiles').insert({
      nome: form.nome.trim(),
      email,
      role: form.role,
      avatar_url: null,
      ativo: true,
      aprovado: form.aprovadoImediato,
    })
    setSaving(false)
    if (err) {
      // Mensagem amigável para alguns erros conhecidos
      const msg = err.message
      if (msg.includes('profiles_email_key') || msg.includes('duplicate key')) {
        setError('Esse e-mail já está cadastrado.')
      } else if (msg.includes('null value in column "id"')) {
        setError(
          'A migration de profiles ainda não foi aplicada no Supabase. Rode o arquivo migration-001-profiles-independente.sql no SQL Editor.',
        )
      } else if (msg.includes("'senha' column")) {
        setError('Versão antiga em cache. Atualize a página com Ctrl+Shift+R.')
      } else {
        setError(msg)
      }
      return
    }
    onCreated()
    onClose()
  }

  const pwdStrength = passwordStrength(form.senha)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Criar usuário"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Criando...' : 'Criar'}
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <Field label="Nome">
          <Input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Nome completo"
            autoFocus
          />
        </Field>
        <Field label="E-mail">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="usuario@empresa.com"
          />
        </Field>
        <Field label="Senha">
          <div className="relative">
            <Input
              type={showPwd ? 'text' : 'password'}
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              className="pr-20"
            />
            <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, senha: generateRandomPassword(12) }))
                }
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-brand-300"
                title="Gerar senha aleatória"
              >
                <RefreshCw size={13} />
              </button>
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-zinc-100"
                title={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
          {form.senha.length > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex h-1 flex-1 gap-0.5">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'flex-1 rounded-full transition-colors',
                      i < pwdStrength.score ? pwdStrength.color : 'bg-bg-elev',
                    )}
                  />
                ))}
              </div>
              <span className={cn('text-[10px]', pwdStrength.text)}>{pwdStrength.label}</span>
            </div>
          )}
          <p className="mt-1 text-[10px] text-muted">
            Anote ou compartilhe esta senha com o usuário. Para login, ele deverá usá-la na primeira
            entrada.
          </p>
        </Field>
        <Field label="Nível de acesso">
          <Select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Profile['role'] })}
          >
            <option value="admin">{userRoleLabel.admin}</option>
            <option value="gestor">{userRoleLabel.gestor}</option>
            <option value="supervisor">{userRoleLabel.supervisor}</option>
          </Select>
        </Field>
        <p className="rounded-md border border-border bg-bg-soft px-3 py-2 text-[11px] text-muted">
          A função (gestor de tráfego, social media, account manager…) e o squad são definidos depois em{' '}
          <span className="text-zinc-200">Configurações › Equipe Operacional</span>.
        </p>
        <label className="flex items-center gap-2 rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-zinc-200">
          <input
            type="checkbox"
            checked={form.aprovadoImediato}
            onChange={(e) => setForm({ ...form, aprovadoImediato: e.target.checked })}
            className="h-4 w-4 accent-brand-500"
          />
          Aprovar acesso imediatamente
        </label>
      </div>
    </Modal>
  )
}

function passwordStrength(s: string): {
  score: number
  label: string
  color: string
  text: string
} {
  if (s.length === 0) return { score: 0, label: '', color: '', text: '' }
  let score = 0
  if (s.length >= 6) score++
  if (s.length >= 10) score++
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) score++
  if (/[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s)) score++
  if (s.length < 6) {
    return { score: 1, label: 'Muito curta', color: 'bg-red-500', text: 'text-red-300' }
  }
  if (score <= 1) return { score: 1, label: 'Fraca', color: 'bg-red-500', text: 'text-red-300' }
  if (score === 2) return { score: 2, label: 'Razoável', color: 'bg-amber-400', text: 'text-amber-300' }
  if (score === 3) return { score: 3, label: 'Boa', color: 'bg-lime-400', text: 'text-lime-300' }
  return { score: 4, label: 'Forte', color: 'bg-emerald-400', text: 'text-emerald-300' }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}

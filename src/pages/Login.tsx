import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'

export default function Login() {
  const { session, signIn, signUp, loading } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  if (loading) return null
  if (session) return <Navigate to="/" replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    const res =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, nome || email.split('@')[0])
    setSubmitting(false)
    if (res.error) setError(res.error)
    else if (mode === 'signup') setSuccess('Conta criada! Verifique seu e-mail se a confirmação estiver ativa.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-card p-8 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-500 text-white font-bold">
            M
          </div>
          <div>
            <h1 className="text-base font-semibold">MovMed</h1>
            <p className="text-xs text-muted">Central de Contas</p>
          </div>
        </div>

        <h2 className="mb-4 text-lg font-semibold">
          {mode === 'signin' ? 'Entrar' : 'Criar conta'}
        </h2>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <Input
              placeholder="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          )}
          <Input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              {success}
            </div>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? 'Aguarde...' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>

        <button
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="mt-4 w-full text-center text-xs text-muted hover:text-zinc-200"
        >
          {mode === 'signin' ? 'Não tem conta? Criar uma.' : 'Já tem conta? Entrar.'}
        </button>
      </div>
    </div>
  )
}

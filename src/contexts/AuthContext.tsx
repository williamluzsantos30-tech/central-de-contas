import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

interface AuthCtx {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, nome: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthCtx | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string, email?: string) {
    // Tenta primeiro pelo novo campo auth_user_id (após migration)
    const byAuth = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle()
    if (byAuth.data) {
      setProfile(byAuth.data as Profile)
      return
    }
    // Fallback 1: id == userId (estrutura antiga / antes da migration)
    const byId = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (byId.data) {
      setProfile(byId.data as Profile)
      return
    }
    // Fallback 2: por e-mail (caso o admin tenha criado o profile e ainda não foi linkado)
    if (email) {
      const byEmail = await supabase.from('profiles').select('*').eq('email', email).maybeSingle()
      if (byEmail.data) {
        setProfile(byEmail.data as Profile)
        // Se temos auth_user_id no schema, faz o link agora
        try {
          await supabase
            .from('profiles')
            .update({ auth_user_id: userId })
            .eq('id', (byEmail.data as Profile).id)
        } catch {
          /* coluna auth_user_id pode não existir ainda — ignora */
        }
        return
      }
    }
    setProfile(null)
  }

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session)
        if (data.session?.user)
          loadProfile(data.session.user.id, data.session.user.email).finally(() =>
            setLoading(false),
          )
        else setLoading(false)
      })
      .catch(() => setLoading(false))

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s?.user) loadProfile(s.user.id, s.user.email)
      else setProfile(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message }
  }

  async function signUp(email: string, password: string, nome: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome } },
    })
    return { error: error?.message }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function refreshProfile() {
    if (session?.user) await loadProfile(session.user.id, session.user.email)
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { mockClient } from './mockDb'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = !!url && !!anonKey
export const isDemoMode = !isSupabaseConfigured

if (isDemoMode) {
  console.info(
    '[domus.agn] Modo DEMO ativo com dados fictícios. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env para conectar ao Supabase real.',
  )
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } })
  : (mockClient as unknown as SupabaseClient)

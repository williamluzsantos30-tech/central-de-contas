// Edge Function: crm-intake
// Recebe POST de Apps Script (ou qualquer cliente) e cria um lead na
// plataforma via RPC intake_lead_from_sheets.
//
// Deploy SEM JWT verify (publica) — autorizacao e feita pelo token
// do cliente no payload, nao pelo JWT do Supabase.
//
//   supabase functions deploy crm-intake --no-verify-jwt
//
// CORS aberto pra qualquer origem (Apps Script POSTa via UrlFetchApp).
//
// Payload esperado:
//   {
//     "token": "<crm_sheets_token do cliente>",
//     "nome": "Maria",
//     "telefone": "+55 11 99999",
//     "email": "...",
//     "etapa": "...",
//     "valor": 1234.56,
//     "data_entrada": "2026-05-19T..." (ISO),
//     "observacoes": "...",
//     "fonte": "sheets" | "forms" | "test"
//   }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const token = (body.token as string | undefined) ?? ''
  if (!token || token.length < 16) {
    return json({ ok: false, error: 'Token inválido ou ausente' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await supabase.rpc('intake_lead_from_sheets', {
    p_token: token,
    p_nome: (body.nome as string | null) ?? null,
    p_telefone: (body.telefone as string | null) ?? null,
    p_email: (body.email as string | null) ?? null,
    p_etapa: (body.etapa as string | null) ?? null,
    p_valor: (body.valor as number | null) ?? null,
    p_data_entrada: (body.data_entrada as string | null) ?? null,
    p_observacoes: (body.observacoes as string | null) ?? null,
    p_fonte: (body.fonte as string | undefined) ?? 'sheets',
    p_external_ref: (body.external_ref as string | null) ?? null,
  })

  if (error) {
    return json({ ok: false, error: error.message }, 400)
  }

  return json({ ok: true, lead_id: data })
})

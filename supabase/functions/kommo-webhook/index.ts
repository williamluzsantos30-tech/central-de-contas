// Webhook do Kommo → insere/atualiza leads vinculados ao cliente pelo kommo_account_id
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const body = await req.json().catch(() => ({}))
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Exemplo de payload (ajuste conforme config real do Kommo):
  // { account_id: "123", lead: { id, name, custom_fields, status_id, price, created_at } }
  const accountId = body?.account_id?.toString()
  const lead = body?.lead ?? {}
  if (!accountId || !lead?.id) {
    return new Response(JSON.stringify({ ok: false, err: 'invalid_payload' }), { status: 400 })
  }

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id')
    .eq('kommo_account_id', accountId)
    .maybeSingle()

  if (!cliente) {
    return new Response(JSON.stringify({ ok: false, err: 'cliente_not_found' }), { status: 404 })
  }

  const phone =
    lead.custom_fields?.find((f: any) => f.code === 'PHONE')?.values?.[0]?.value ?? null
  const email =
    lead.custom_fields?.find((f: any) => f.code === 'EMAIL')?.values?.[0]?.value ?? null

  await supabase.from('leads').upsert(
    {
      cliente_id: cliente.id,
      origem: 'kommo',
      kommo_lead_id: lead.id.toString(),
      nome: lead.name ?? null,
      telefone: phone,
      email,
      etapa: lead.status_id?.toString() ?? null,
      valor: lead.price ?? null,
      data_entrada: lead.created_at
        ? new Date(lead.created_at * 1000).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    },
    { onConflict: 'kommo_lead_id' },
  )

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  })
})

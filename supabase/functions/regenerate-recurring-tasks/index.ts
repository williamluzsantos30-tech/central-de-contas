// Deno edge function — agende em cron diário (00:10 UTC, por ex.)
// Gera novas instâncias de tarefas recorrentes quando a anterior foi concluída.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Se a data cair em sáb/dom, empurra pra segunda. */
function skipWeekend(d: Date): Date {
  const dow = d.getDay() // 0=dom, 6=sab
  if (dow === 6) d.setDate(d.getDate() + 2)
  else if (dow === 0) d.setDate(d.getDate() + 1)
  return d
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const today = new Date().toISOString().slice(0, 10)
  const { data: concluidas } = await supabase
    .from('tarefas')
    .select('*')
    .eq('status', 'concluida')
    .in('frequencia', ['diaria', 'semanal', 'mensal'])

  let criadas = 0
  for (const t of concluidas ?? []) {
    const offset = t.frequencia === 'diaria' ? 1 : t.frequencia === 'semanal' ? 7 : 30
    const proxVenc = new Date()
    proxVenc.setDate(proxVenc.getDate() + offset)
    skipWeekend(proxVenc)
    const proxVencISO = proxVenc.toISOString().slice(0, 10)

    // Já existe uma nova instância não concluída para este template+cliente?
    const { data: existentes } = await supabase
      .from('tarefas')
      .select('id')
      .eq('cliente_id', t.cliente_id)
      .eq('template_id', t.template_id)
      .neq('status', 'concluida')

    if (existentes && existentes.length > 0) continue

    await supabase.from('tarefas').insert({
      cliente_id: t.cliente_id,
      template_id: t.template_id,
      nome: t.nome,
      descricao: t.descricao,
      frequencia: t.frequencia,
      prioridade: t.prioridade,
      responsavel_id: t.responsavel_id,
      data_vencimento: proxVencISO,
    })
    criadas++
  }

  return new Response(JSON.stringify({ ok: true, criadas, today }), {
    headers: { 'content-type': 'application/json' },
  })
})

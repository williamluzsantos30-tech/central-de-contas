// Edge Function: ai-generate
// =============================================================
// Recebe { tipo, briefing, prompt, anexos, cliente } do frontend,
// envia para OpenAI (GPT-4o), e devolve o texto gerado.
//
// As anexos podem ser:
//   - data URL de imagem  (data:image/png;base64,...)
//   - data URL de PDF     (data:application/pdf;base64,...) — convertido em texto via unpdf
//   - URL pública (http/https)
//
// Variáveis de ambiente necessárias (Supabase Secrets):
//   OPENAI_API_KEY  → chave da OpenAI (sk-proj-...)
//
// Como deployar:
//   supabase functions deploy ai-generate
// =============================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { extractText, getDocumentProxy } from 'https://esm.sh/unpdf@0.12.1'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Anexo {
  nome: string
  tipo: string
  url: string
}

interface RequestBody {
  tipo: 'copy_lp' | 'planejamento' | 'roteiro' | 'copy_criativos'
  briefing?: string
  prompt?: string
  anexos?: Anexo[]
  cliente?: { nome?: string; nicho?: string | null; plataformas?: string | null }
}

const tipoLabel: Record<RequestBody['tipo'], string> = {
  copy_lp: 'Copy de Landing Page',
  planejamento: 'Planejamento de tráfego',
  roteiro: 'Roteiro de vídeo / Reels',
  copy_criativos: 'Copy de criativos para Meta Ads / Google Ads',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (!OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY nao configurada nos Secrets do Supabase' }, 500)
  }

  // Verifica autenticacao
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Nao autenticado' }, 401)

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      })
      if (!userRes.ok) return json({ error: 'Token invalido ou expirado' }, 401)
    } catch {
      // permite seguir
    }
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return json({ error: 'Body invalido — esperado JSON' }, 400)
  }

  const { tipo, briefing = '', prompt = '', anexos = [], cliente = {} } = body
  if (!tipo) return json({ error: 'tipo é obrigatorio' }, 400)

  // Pré-processa os anexos: extrai texto de PDFs/txts ANTES de montar a mensagem
  const anexosProcessados: Array<
    | { tipo: 'image'; nome: string; url: string }
    | { tipo: 'texto'; nome: string; conteudo: string }
    | { tipo: 'erro'; nome: string; motivo: string }
  > = []

  for (const a of anexos) {
    if (a.tipo.startsWith('image/')) {
      anexosProcessados.push({ tipo: 'image', nome: a.nome, url: a.url })
    } else if (a.tipo === 'application/pdf' || a.tipo === 'text/plain') {
      try {
        const conteudo = await extrairTexto(a)
        anexosProcessados.push({ tipo: 'texto', nome: a.nome, conteudo })
      } catch (err) {
        anexosProcessados.push({
          tipo: 'erro',
          nome: a.nome,
          motivo: (err as Error).message ?? 'erro desconhecido',
        })
      }
    } else {
      anexosProcessados.push({
        tipo: 'erro',
        nome: a.nome,
        motivo: `tipo ${a.tipo} nao suportado`,
      })
    }
  }

  // Sistema: prompt customizado + regra forte de priorizacao
  const systemPrompt =
    (prompt.trim() ||
      `Voce e um copywriter especializado em marketing medico. Produza ${tipoLabel[tipo]} com base no briefing.`) +
    `\n\n[REGRAS DE PRIORIZACAO DE FONTES — ORDEM DECRESCENTE]
1. ARQUIVOS ANEXADOS (briefings em PDF, identidade visual, prints) — quando preenchidos, sao a fonte de verdade. Use o nome, nicho, dados e tom DELES, mesmo que conflitem com os campos "Cliente" e "Nicho" passados como meta-dado.
2. BRIEFING DIGITADO pelo time — segunda fonte mais confiavel.
3. CAMPOS Cliente/Nicho/Plataformas — meta-dados de menor prioridade, usados so como pista quando nao ha informacao melhor.

Se houver conflito de informacao (ex: anexo fala de Dr. Thiago mas o campo Cliente diz Dra. Nina), confie no anexo.`

  // User: monta o prompt com TODO o material
  const userTextParts: string[] = []
  userTextParts.push(`Tipo de criação: ${tipoLabel[tipo]}`)

  if (cliente.nome) userTextParts.push(`Cliente cadastrado no sistema: ${cliente.nome}`)
  if (cliente.nicho) userTextParts.push(`Nicho cadastrado: ${cliente.nicho}`)
  if (cliente.plataformas) userTextParts.push(`Plataformas: ${cliente.plataformas}`)

  userTextParts.push('')
  userTextParts.push('=== BRIEFING DIGITADO PELO TIME ===')
  userTextParts.push(briefing.trim() || '(em branco)')

  // Adiciona conteudo dos PDFs/txts dentro do user message
  const anexosTexto = anexosProcessados.filter((a) => a.tipo === 'texto') as Array<{
    tipo: 'texto'
    nome: string
    conteudo: string
  }>
  const anexosImagem = anexosProcessados.filter((a) => a.tipo === 'image') as Array<{
    tipo: 'image'
    nome: string
    url: string
  }>
  const anexosErro = anexosProcessados.filter((a) => a.tipo === 'erro') as Array<{
    tipo: 'erro'
    nome: string
    motivo: string
  }>

  if (anexosTexto.length > 0) {
    userTextParts.push('')
    userTextParts.push(
      `=== ${anexosTexto.length} ARQUIVO(S) DE BRIEFING/REFERENCIA ANEXADO(S) ===`,
    )
    userTextParts.push(
      'IMPORTANTE: leia o conteudo abaixo e use ele como fonte principal de informacao sobre o cliente, mesmo que conflite com os campos cadastrados no sistema.',
    )
    for (const a of anexosTexto) {
      userTextParts.push('')
      userTextParts.push(`--- Inicio do arquivo "${a.nome}" ---`)
      userTextParts.push(a.conteudo.slice(0, 25000))
      userTextParts.push(`--- Fim do arquivo "${a.nome}" ---`)
    }
  }

  if (anexosImagem.length > 0) {
    userTextParts.push('')
    userTextParts.push(
      `=== ${anexosImagem.length} IMAGEM(NS) DE REFERENCIA ANEXADA(S) ===`,
    )
    userTextParts.push(
      'Analise as imagens enviadas para entender identidade visual, tom, exemplos de concorrentes etc.',
    )
  }

  if (anexosErro.length > 0) {
    userTextParts.push('')
    userTextParts.push(
      `[AVISO: ${anexosErro.length} arquivo(s) nao puderam ser lidos: ${anexosErro
        .map((a) => `${a.nome} (${a.motivo})`)
        .join('; ')}]`,
    )
  }

  userTextParts.push('')
  userTextParts.push(
    'Gere o conteudo final agora seguindo TODAS as instrucoes do system prompt e priorizando o material anexado quando disponivel.',
  )

  // Monta o user content (texto + imagens, se houver)
  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = []

  userContent.push({ type: 'text', text: userTextParts.join('\n') })
  for (const img of anexosImagem) {
    userContent.push({ type: 'image_url', image_url: { url: img.url } })
  }

  // Chama OpenAI
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.7,
        max_tokens: 2500,
      }),
    })

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text()
      return json(
        { error: `OpenAI retornou erro ${openaiRes.status}`, details: errorText.slice(0, 500) },
        502,
      )
    }

    const data = await openaiRes.json()
    const content = data?.choices?.[0]?.message?.content as string | undefined
    if (!content) return json({ error: 'OpenAI retornou resposta vazia', raw: data }, 502)

    return json({
      text: content,
      usage: data.usage,
      model: data.model,
      anexos_lidos: anexosTexto.map((a) => ({
        nome: a.nome,
        chars_extraidos: a.conteudo.length,
      })),
      anexos_erro: anexosErro,
    })
  } catch (err) {
    return json({ error: 'Erro chamando OpenAI', details: (err as Error).message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Extrai texto de um anexo. Suporta PDFs (via unpdf) e text/plain.
 */
async function extrairTexto(anexo: Anexo): Promise<string> {
  let bytes: Uint8Array
  if (anexo.url.startsWith('data:')) {
    const base64 = anexo.url.split(',')[1] ?? ''
    bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  } else {
    const r = await fetch(anexo.url)
    if (!r.ok) throw new Error(`Falha ao baixar (${r.status})`)
    bytes = new Uint8Array(await r.arrayBuffer())
  }

  if (anexo.tipo === 'text/plain') {
    return new TextDecoder('utf-8').decode(bytes)
  }

  // PDF — extração robusta com unpdf (lib serverless-friendly baseada em PDF.js)
  const pdf = await getDocumentProxy(bytes)
  const { text } = await extractText(pdf, { mergePages: true })
  const cleaned = (Array.isArray(text) ? text.join('\n') : String(text)).trim()
  return (
    cleaned ||
    '(PDF sem texto digital extraivel — provavelmente escaneado, precisa de OCR)'
  )
}

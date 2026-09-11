/**
 * Formulario NPS publico — /publico/nps/:token
 *
 * Cliente responde sem login. Renderiza template baseado no `tipo`
 * do survey (onboarding | operacao) e nas modulos do cliente
 * (adiciona bloco Social Media condicional).
 *
 * Ao submeter, chama RPC responder_nps_publico que:
 *   1. Valida token e nao respondido ainda
 *   2. Salva respostas jsonb + nps_score no survey
 *   3. Atualiza cliente.nps
 *   4. Cria evento na Timeline do cliente
 *
 * Depois de responder, mostra tela de agradecimento.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { getTemplate, type Pergunta } from '@/lib/npsTemplates'

interface SurveyPub {
  survey_id: string
  cliente_nome: string
  cliente_instagram: string | null
  tipo: 'onboarding' | 'operacao'
  ja_respondido: boolean
  tem_social_media: boolean
}

export default function PublicoNps() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [survey, setSurvey] = useState<SurveyPub | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [respostas, setRespostas] = useState<Record<string, unknown>>({})
  const [outroTexto, setOutroTexto] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erroSubmit, setErroSubmit] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    supabase
      .rpc('get_nps_survey_publico', { p_token: token })
      .then(({ data, error }) => {
        if (error) {
          setErro('Link inválido ou expirado.')
        } else if (!data || data.length === 0) {
          setErro('Link inválido.')
        } else {
          setSurvey(data[0] as SurveyPub)
        }
        setLoading(false)
      })
  }, [token])

  const template = useMemo(
    () => (survey ? getTemplate(survey.tipo) : null),
    [survey],
  )

  // Perguntas visiveis (aplica mostrarSe)
  const blocosVisiveis = useMemo(() => {
    if (!template || !survey) return []
    return template.blocos
      .map((b) => ({
        ...b,
        perguntas: b.perguntas.filter(
          (p) =>
            !p.mostrarSe ||
            p.mostrarSe({ temSocialMedia: survey.tem_social_media }),
        ),
      }))
      .filter((b) => b.perguntas.length > 0)
  }, [template, survey])

  function setResposta(key: string, valor: unknown) {
    setRespostas((prev) => ({ ...prev, [key]: valor }))
  }

  async function submeter() {
    if (!template || !survey) return
    setErroSubmit(null)

    // Valida obrigatorias
    for (const b of blocosVisiveis) {
      for (const p of b.perguntas) {
        if (p.obrigatoria) {
          const v = respostas[p.key]
          if (v === undefined || v === null || v === '') {
            setErroSubmit(`Responda: "${p.titulo.slice(0, 60)}${p.titulo.length > 60 ? '…' : ''}"`)
            return
          }
        }
      }
    }

    // Merge outros
    const finalRespostas: Record<string, unknown> = { ...respostas }
    for (const k of Object.keys(outroTexto)) {
      if (outroTexto[k]?.trim()) {
        finalRespostas[`${k}_outro`] = outroTexto[k].trim()
      }
    }

    // NPS principal
    const npsPergunta = template.blocos
      .flatMap((b) => b.perguntas)
      .find((p) => p.ehNpsPrincipal)
    if (!npsPergunta) {
      setErroSubmit('Formulário sem pergunta NPS principal — contate a equipe.')
      return
    }
    const scoreRaw = respostas[npsPergunta.key]
    const score = typeof scoreRaw === 'number' ? scoreRaw : Number(scoreRaw)
    if (isNaN(score)) {
      setErroSubmit('Escolha uma nota de 0 a 10 na última pergunta.')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.rpc('responder_nps_publico', {
      p_token: token,
      p_respostas: finalRespostas,
      p_nps_score: score,
    })
    setSubmitting(false)
    if (error) {
      setErroSubmit(error.message)
      return
    }
    setSucesso(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-zinc-100 flex items-center justify-center p-6">
        <p className="text-sm text-muted">Carregando…</p>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-bg text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-center">
          <p className="text-lg font-semibold text-red-200">{erro}</p>
          <p className="mt-2 text-sm text-red-300/80">
            Esse link pode ter sido revogado ou já usado. Peça à sua agência
            pra gerar um novo.
          </p>
        </div>
      </div>
    )
  }

  if (!survey || !template) return null

  if (survey.ja_respondido || sucesso) {
    return (
      <div className="min-h-screen bg-bg text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-8 text-center">
          <CheckCircle2 size={48} className="mx-auto text-emerald-300 mb-3" />
          <h2 className="text-xl font-semibold text-emerald-200">Obrigado!</h2>
          <p className="mt-2 text-sm text-emerald-300/80">
            Sua resposta foi registrada. Sua opinião ajuda nossa equipe a
            melhorar continuamente.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-zinc-100">
      <main className="mx-auto max-w-2xl px-6 py-8">
        {/* Cabecalho da pesquisa */}
        <div className="mb-5 rounded-xl border border-brand-500/40 bg-brand-500/[0.06] p-5">
          <h1 className="text-xl font-bold text-zinc-100">{template.titulo}</h1>
          <p className="mt-1 text-xs text-muted">{template.subtitulo}</p>
          <p className="mt-3 text-sm text-zinc-200 leading-relaxed">
            {template.saudacao(survey.cliente_nome)}
          </p>
        </div>

        {/* Blocos */}
        <div className="space-y-4">
          {blocosVisiveis.map((bloco, bi) => (
            <div
              key={`${bloco.titulo}-${bi}`}
              className="rounded-xl border border-border bg-bg-card p-5"
            >
              <div className="mb-4 border-b border-border pb-3">
                <h3 className="text-sm font-semibold text-zinc-100">
                  {bloco.titulo}
                </h3>
                {bloco.subtitulo && (
                  <p className="mt-1 text-[11px] text-muted">{bloco.subtitulo}</p>
                )}
              </div>
              <div className="space-y-5">
                {bloco.perguntas.map((p) => (
                  <RenderPergunta
                    key={p.key}
                    pergunta={p}
                    valor={respostas[p.key]}
                    onChange={(v) => setResposta(p.key, v)}
                    valorOutro={outroTexto[p.key] ?? ''}
                    onChangeOutro={(v) =>
                      setOutroTexto((prev) => ({ ...prev, [p.key]: v }))
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}
        {erroSubmit && (
          <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {erroSubmit}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={submeter}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Send size={14} />
            {submitting ? 'Enviando…' : 'Enviar respostas'}
          </button>
        </div>

        <p className="mt-6 text-center text-[10px] text-muted">
          Pesquisa confidencial · Respondida uma única vez
        </p>
      </main>
    </div>
  )
}

// -------- Render de cada tipo de pergunta --------
function RenderPergunta({
  pergunta,
  valor,
  onChange,
  valorOutro,
  onChangeOutro,
}: {
  pergunta: Pergunta
  valor: unknown
  onChange: (v: unknown) => void
  valorOutro: string
  onChangeOutro: (v: string) => void
}) {
  return (
    <div>
      <p className="mb-2 text-sm text-zinc-100 leading-snug">
        {pergunta.titulo}
        {pergunta.obrigatoria && <span className="ml-1 text-brand-400">*</span>}
      </p>

      {pergunta.tipo === 'escala5' && (
        <EscalaBotoes
          min={1}
          max={5}
          valor={typeof valor === 'number' ? valor : null}
          onChange={onChange}
          labels={pergunta.escalaLabels}
        />
      )}

      {pergunta.tipo === 'escala10' && (
        <EscalaBotoes
          min={0}
          max={10}
          valor={typeof valor === 'number' ? valor : null}
          onChange={onChange}
          labels={pergunta.escalaLabels}
        />
      )}

      {pergunta.tipo === 'texto' && (
        <textarea
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Sua resposta…"
          rows={3}
          className="w-full resize-none rounded-md border border-border bg-bg-soft px-3 py-2 text-sm text-zinc-100 placeholder:text-muted focus:border-brand-500/60 focus:outline-none"
        />
      )}

      {pergunta.tipo === 'opcoes' && pergunta.opcoes && (
        <div className="space-y-1.5">
          {pergunta.opcoes.map((op) => (
            <label
              key={op}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                valor === op
                  ? 'border-brand-500/60 bg-brand-500/10 text-brand-200'
                  : 'border-border bg-bg-soft/40 hover:border-brand-500/30',
              )}
            >
              <input
                type="radio"
                name={pergunta.key}
                checked={valor === op}
                onChange={() => onChange(op)}
                className="accent-brand-500"
              />
              {op}
            </label>
          ))}
          {pergunta.permiteOutro && (
            <label
              className={cn(
                'flex cursor-pointer flex-col gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                valor === '__outro__'
                  ? 'border-brand-500/60 bg-brand-500/10'
                  : 'border-border bg-bg-soft/40 hover:border-brand-500/30',
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name={pergunta.key}
                  checked={valor === '__outro__'}
                  onChange={() => onChange('__outro__')}
                  className="accent-brand-500"
                />
                Outro
              </span>
              {valor === '__outro__' && (
                <input
                  type="text"
                  value={valorOutro}
                  onChange={(e) => onChangeOutro(e.target.value)}
                  placeholder="Descreva…"
                  className="rounded-md border border-border bg-bg-soft px-2 py-1.5 text-sm text-zinc-100 placeholder:text-muted focus:border-brand-500/60 focus:outline-none"
                />
              )}
            </label>
          )}
        </div>
      )}
    </div>
  )
}

function EscalaBotoes({
  min,
  max,
  valor,
  onChange,
  labels,
}: {
  min: number
  max: number
  valor: number | null
  onChange: (v: number) => void
  labels?: { min: string; max: string }
}) {
  const numeros = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {numeros.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              'grid h-9 w-9 place-items-center rounded-full border text-xs font-semibold transition-colors',
              valor === n
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-border bg-bg-soft text-zinc-200 hover:border-brand-500/50',
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {labels && (
        <div className="mt-1.5 flex justify-between text-[10px] text-muted">
          <span>{labels.min}</span>
          <span>{labels.max}</span>
        </div>
      )}
    </div>
  )
}

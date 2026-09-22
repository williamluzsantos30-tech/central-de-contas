/**
 * CodigoCulturaModal — "Código de Cultura MovMed".
 *
 * Há um MANUAL BASE (MANUAL_CULTURA_PADRAO) e cada pessoa personaliza a PRÓPRIA
 * cópia: edita o texto (markdown leve) e salva. A cópia é por usuário
 * (tabela `codigo_cultura`, RLS por dono — migration 091). Fallback: se a
 * tabela não existir ou não houver login, usa localStorage do navegador.
 */
import { useEffect, useState } from 'react'
import { BookOpen, Pencil, RotateCcw, Save } from 'lucide-react'
import { Modal, PrimaryButton, OutlineButton } from '@/components/ds'
import { MarkdownLite } from '@/components/ui/MarkdownLite'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export const MANUAL_CULTURA_PADRAO = `# Manual de Cultura MovMed

## Apresentação Pessoal, Postura Profissional e Trabalho Remoto

Na MovMed, a forma como nos apresentamos é a primeira mensagem que entregamos — antes de qualquer palavra. Cuidado com a aparência e com a postura demonstra respeito pelo cliente, pelos colegas e por nós mesmos. Uma equipe bem apresentada transmite **confiança**, **organização** e **seriedade**, valores que sustentam tudo o que fazemos.

Este manual vale tanto no atendimento presencial quanto no trabalho de casa. O padrão é o mesmo em qualquer lugar.

---

## Parte 1 — Apresentação Pessoal e Postura Profissional

Não se trata de vaidade. Trata-se de profissionalismo.

### 1. Padrão geral (todos)

- **Higiene em primeiro lugar**: corpo, mãos e unhas limpos e cuidados. Hálito e odor sob atenção ao longo do dia.
- **Roupa limpa, passada e em bom estado**: nada amassado, manchado, rasgado ou desbotado.
- **Cabelo arrumado**: limpo, penteado e organizado.
- **Sapatos limpos** e adequados ao ambiente de trabalho.
- **Discrição**: perfumes e acessórios com moderação.

### 2. Para os homens

- **Cabelo cortado** e bem aparado. Sem aspecto desleixado.
- **Barba feita** ou, se mantida, **completamente alinhada e aparada** — nunca por fazer.
- **Camisa básica preta** (padrão MovMed) ou uniforme da empresa.
- Sempre que possível, **blazer** por cima — eleva a apresentação e transmite autoridade.
- Calça em bom estado, alinhada ao padrão da camisa/uniforme.

### 3. Para as mulheres

- **Cabelo arrumado**: preso ou solto, mas sempre cuidado e organizado.
- **Camisa básica preta** (padrão MovMed) ou uniforme da empresa.
- **Blazer** quando possível, mantendo o padrão de elegância e sobriedade.
- Maquiagem e acessórios discretos, alinhados a um ambiente profissional.

---

## Parte 2 — Trabalho Remoto (home office)

O padrão de profissionalismo não muda em casa.

- **Ambiente organizado** e neutro para chamadas e reuniões (fundo limpo, boa iluminação).
- **Câmera ligada** nas reuniões, sempre que possível.
- **Mesma apresentação pessoal** das regras acima em qualquer chamada com cliente.
- **Pontualidade** e disponibilidade nos horários combinados.

---

> Este é o manual base da MovMed. Esta é a **sua cópia** — edite, complemente ou adapte ao seu contexto. As mudanças ficam só na sua versão.`

const lsKey = (uid: string | null) => `codigo-cultura-${uid ?? 'anon'}`

export function CodigoCulturaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useAuth()
  const uid = session?.user?.id ?? null

  const [conteudo, setConteudo] = useState(MANUAL_CULTURA_PADRAO)
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [modoBanco, setModoBanco] = useState(true)

  // Carrega a cópia da pessoa ao abrir.
  useEffect(() => {
    if (!open) return
    setEditando(false)
    let cancel = false
    async function load() {
      setCarregando(true)
      // 1) localStorage (fallback / cache local por usuário)
      let local: string | null = null
      try {
        local = window.localStorage.getItem(lsKey(uid))
      } catch {
        /* indisponível */
      }
      // 2) banco (fonte de verdade quando existe e há login)
      if (uid) {
        const { data, error } = await supabase.from('codigo_cultura').select('conteudo').eq('user_id', uid).maybeSingle()
        if (cancel) return
        if (error) {
          setModoBanco(false)
          setConteudo(local ?? MANUAL_CULTURA_PADRAO)
        } else {
          setModoBanco(true)
          setConteudo(data?.conteudo ?? local ?? MANUAL_CULTURA_PADRAO)
        }
      } else {
        setModoBanco(false)
        setConteudo(local ?? MANUAL_CULTURA_PADRAO)
      }
      setCarregando(false)
    }
    load()
    return () => {
      cancel = true
    }
  }, [open, uid])

  function abrirEdicao() {
    setRascunho(conteudo)
    setEditando(true)
  }

  async function salvar() {
    const texto = rascunho.trim() ? rascunho : MANUAL_CULTURA_PADRAO
    setSalvando(true)
    // cache local sempre
    try {
      window.localStorage.setItem(lsKey(uid), texto)
    } catch {
      /* indisponível */
    }
    // banco quando disponível
    if (uid && modoBanco) {
      const { error } = await supabase
        .from('codigo_cultura')
        .upsert({ user_id: uid, conteudo: texto, updated_at: new Date().toISOString() })
      if (error) setModoBanco(false)
    }
    setSalvando(false)
    setConteudo(texto)
    setEditando(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Código de Cultura MovMed" className="max-w-2xl">
      <p className="-mt-1 mb-4 flex items-center gap-1.5 text-[11px] text-muted">
        <BookOpen size={12} className="text-brand-300" /> Manual de conduta e valores da empresa
      </p>

      {carregando ? (
        <p className="py-8 text-center text-sm text-muted">Carregando…</p>
      ) : editando ? (
        <>
          <textarea
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            rows={16}
            className="w-full rounded-lg border border-border bg-bg-soft px-3 py-2 font-mono text-xs leading-relaxed text-zinc-100 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            placeholder="Escreva em markdown leve (# título, - lista, **negrito**)…"
          />
          <p className="mt-1.5 text-[10px] text-muted">
            Suporta <strong className="text-zinc-300"># títulos</strong>, listas (<code>-</code>, <code>1.</code>), <strong className="text-zinc-300">**negrito**</strong>, tabelas (<code>|</code>) e citações (<code>&gt;</code>).
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <OutlineButton size="sm" onClick={() => setRascunho(MANUAL_CULTURA_PADRAO)}>
              <RotateCcw size={13} /> Restaurar padrão
            </OutlineButton>
            <div className="flex items-center gap-2">
              <OutlineButton size="sm" onClick={() => setEditando(false)}>Cancelar</OutlineButton>
              <PrimaryButton size="sm" onClick={salvar} disabled={salvando}>
                <Save size={13} /> {salvando ? 'Salvando…' : 'Salvar minha cópia'}
              </PrimaryButton>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted">Sua cópia personalizável</span>
            <OutlineButton size="sm" onClick={abrirEdicao}>
              <Pencil size={13} /> Personalizar
            </OutlineButton>
          </div>
          <MarkdownLite text={conteudo} />
          {!modoBanco && (
            <p className="mt-3 text-[10px] text-muted">
              Salvando localmente neste navegador. Rode a migration 091 no Supabase para guardar a sua cópia na conta.
            </p>
          )}
        </>
      )}
    </Modal>
  )
}

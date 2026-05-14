/**
 * Preview de como ficou o CriacoesPanel reformulado.
 * Usa dados fictícios — não chama Supabase. Rota: /preview/criacoes-panel
 */
import { useState } from 'react'
import {
  FileText,
  Target,
  Film,
  Megaphone,
  Plus,
} from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { CriacaoModal } from '@/components/criacoes/CriacoesPanel'
import {
  formatDateTime,
  statusCriacaoLabel,
  tipoCriacaoDescricao,
  tipoCriacaoLabel,
  TIPOS_CRIACAO,
} from '@/lib/utils'
import type { Cliente, Criacao, StatusCriacao, TipoCriacao } from '@/types/database'

const tipoIcone: Record<TipoCriacao, React.ComponentType<{ size?: number; className?: string }>> = {
  copy_lp: FileText,
  planejamento: Target,
  roteiro: Film,
  copy_criativos: Megaphone,
}

// Dados fictícios — 1-3 criações por tipo, status variados, alguns com
// conteúdo gerado, outros só com briefing, um já enviado pra webdesign.
const agora = new Date()
const hoje = agora.toISOString()
const ontem = new Date(agora.getTime() - 86400000).toISOString()
const semanaPassada = new Date(agora.getTime() - 7 * 86400000).toISOString()

const responsavelPaloma = {
  id: 'p1',
  nome: 'Paloma Bruno',
  email: 'paloma@movmed.com',
  role: 'gestor' as const,
  cargo: 'social_media' as const,
  cargos_extras: ['designer' as const],
  squad_id: null,
  avatar_url: null,
  ativo: true,
  aprovado: true,
  created_at: semanaPassada,
}

const responsavelLucas = {
  id: 'p2',
  nome: 'Lucas Almeida',
  email: 'lucas@movmed.com',
  role: 'gestor' as const,
  cargo: 'designer' as const,
  cargos_extras: [],
  squad_id: null,
  avatar_url: null,
  ativo: true,
  aprovado: true,
  created_at: semanaPassada,
}

const criacoesFake: Criacao[] = [
  // ============ COPY LP (2 itens) ============
  {
    id: 'c1',
    cliente_id: 'fake',
    tipo: 'copy_lp',
    titulo: 'LP Avaliação Ortodôntica — Maio 2026',
    briefing:
      'Cliente: Dra. Maria Adélia. Foco: atrair pacientes para avaliação ortodôntica gratuita.',
    prompt: null,
    anexos: null,
    conteudo:
      '[HERO]\nHeadline: Sua jornada para um sorriso de cinema começa aqui.\nSubhead: Tratamentos ortodônticos com tecnologia 3D, planejamento digital e acompanhamento personalizado.\nCTA: Agendar avaliação gratuita\n\n[POR QUE NÓS]\n• 15 anos de especialização em ortodontia digital...',
    planejamento_estrutura: null,
    status: 'aprovado',
    responsavel_id: 'p2',
    enviado_para_producao_em: ontem,
    introducao_pdf: null,
    roteiro_estrutura: null,
    copy_criativos_estrutura: null,
    created_at: semanaPassada,
    updated_at: ontem,
    responsavel: responsavelLucas,
  },
  {
    id: 'c2',
    cliente_id: 'fake',
    tipo: 'copy_lp',
    titulo: 'LP Bariátrica humanizada',
    briefing: 'Lançamento do programa de bariátrica humanizada — foco em jornada antes/depois.',
    prompt: null,
    anexos: null,
    conteudo: null,
    planejamento_estrutura: null,
    status: 'rascunho',
    responsavel_id: null,
    enviado_para_producao_em: null,
    introducao_pdf: null,
    roteiro_estrutura: null,
    copy_criativos_estrutura: null,
    created_at: hoje,
    updated_at: hoje,
    responsavel: null,
  },

  // ============ PLANEJAMENTO (1 item) ============
  {
    id: 'c3',
    cliente_id: 'fake',
    tipo: 'planejamento',
    titulo: 'Planejamento Meta Ads · Maio 2026',
    briefing: 'Operação completa de tráfego pago — captação + conversão WhatsApp.',
    prompt: null,
    anexos: null,
    conteudo: null,
    planejamento_estrutura: {
      visao_geral: {
        mes: 'Maio 2026',
        objetivo: 'Gerar 80 leads qualificados',
        orcamento_total: 'R$ 4.500',
      },
      meta_ads: {
        objetivo: 'Geração de leads via Direct + remarketing',
        publico: 'Mulheres 25-40 anos, interesse em moda',
        criativos_previstos: ['Provador', '1 peça 3 looks'],
        budget: 'R$ 3.150',
      },
      organico: {
        pilares: ['conexão', 'autoridade', 'prova social'],
        frequencia: '3 posts/semana',
      },
      kpis: { cpl: 'R$ 35', ctr: '> 2,5%', cpc: 'R$ 1,20', conversoes: '80 leads' },
    },
    status: 'em_revisao',
    responsavel_id: 'p1',
    enviado_para_producao_em: null,
    introducao_pdf: null,
    roteiro_estrutura: null,
    copy_criativos_estrutura: null,
    created_at: semanaPassada,
    updated_at: hoje,
    responsavel: responsavelPaloma,
  },

  // ============ ROTEIRO (3 itens) ============
  {
    id: 'c4',
    cliente_id: 'fake',
    tipo: 'roteiro',
    titulo: 'Reel — Antes e Depois Camila',
    briefing: '60s, depoimento + autoridade da Dra.',
    prompt: null,
    anexos: null,
    conteudo:
      '[0-3s · GANCHO] Câmera fechada no rosto da Camila, ela cobre a boca rindo.\nTexto em tela: "Eu evitava sorrir há 8 ANOS."\n\n[3-10s · IDENTIFICAÇÃO]...',
    planejamento_estrutura: null,
    status: 'aprovado',
    responsavel_id: 'p1',
    enviado_para_producao_em: null,
    introducao_pdf: null,
    roteiro_estrutura: null,
    copy_criativos_estrutura: null,
    created_at: semanaPassada,
    updated_at: ontem,
    responsavel: responsavelPaloma,
  },
  {
    id: 'c5',
    cliente_id: 'fake',
    tipo: 'roteiro',
    titulo: 'Carrossel — Mitos sobre ortodontia',
    briefing: '8 slides desmistificando aparelho transparente vs. tradicional.',
    prompt: null,
    anexos: null,
    conteudo: null,
    planejamento_estrutura: null,
    status: 'rascunho',
    responsavel_id: null,
    enviado_para_producao_em: null,
    introducao_pdf: null,
    roteiro_estrutura: null,
    copy_criativos_estrutura: null,
    created_at: hoje,
    updated_at: hoje,
    responsavel: null,
  },
  {
    id: 'c6',
    cliente_id: 'fake',
    tipo: 'roteiro',
    titulo: 'Reel — Bastidores do consultório',
    briefing: null,
    prompt: null,
    anexos: null,
    conteudo: null,
    planejamento_estrutura: null,
    status: 'em_revisao',
    responsavel_id: 'p1',
    enviado_para_producao_em: null,
    introducao_pdf: null,
    roteiro_estrutura: null,
    copy_criativos_estrutura: null,
    created_at: ontem,
    updated_at: hoje,
    responsavel: responsavelPaloma,
  },

  // ============ COPY CRIATIVOS (1 item) ============
  {
    id: 'c7',
    cliente_id: 'fake',
    tipo: 'copy_criativos',
    titulo: 'Variações Reels — Camila Antes e Depois',
    briefing: 'Testar 4 ângulos: dor, prova social, urgência, benefício direto.',
    prompt: null,
    anexos: null,
    conteudo:
      'VARIAÇÃO 1 — Dor / Identificação\n"Cansada de esconder o sorriso nas fotos? Você não está sozinha..."',
    planejamento_estrutura: null,
    status: 'publicado',
    responsavel_id: 'p2',
    enviado_para_producao_em: ontem,
    introducao_pdf: null,
    roteiro_estrutura: null,
    copy_criativos_estrutura: null,
    created_at: semanaPassada,
    updated_at: hoje,
    responsavel: responsavelLucas,
  },
]

function StatusBadge({ status }: { status: StatusCriacao }) {
  const toneMap: Record<StatusCriacao, 'neutral' | 'warning' | 'success' | 'info'> = {
    rascunho: 'neutral',
    em_revisao: 'warning',
    aprovado: 'success',
    publicado: 'info',
  }
  return <Badge tone={toneMap[status]}>{statusCriacaoLabel[status]}</Badge>
}

// Cliente fictício pra passar pro modal
const clienteFake = {
  id: 'fake-cliente',
  nome: 'Dra. Maria Adélia Ortodontia',
  nicho: 'Saúde · Ortodontia',
  plataformas: ['meta_ads', 'google_ads'],
  status: 'ativo',
  squad: 'BlackOps',
  jornada_social: 'planejamento',
  observacoes: null,
  instagram_handle: '@dramaria.ortodontia',
  modulos: ['trafego'],
  gestor_id: null,
  account_manager_id: null,
  social_media_id: null,
  identidade_visual_urls: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as unknown as Cliente

export default function PreviewCriacoesPanel() {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTipo, setModalTipo] = useState<TipoCriacao>('copy_lp')
  const [modalCriacao, setModalCriacao] = useState<Criacao | null>(null)

  function abrirNovo(tipo: TipoCriacao) {
    setModalTipo(tipo)
    setModalCriacao(null)
    setModalOpen(true)
  }

  function abrirEdicao(c: Criacao) {
    setModalTipo(c.tipo)
    setModalCriacao(c)
    setModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <p className="text-xs text-amber-200">
            <strong>Preview</strong> · dados fictícios. Cliente: Dra. Maria Adélia Ortodontia ·
            Salvar/Excluir/Gerar com IA estão desabilitados (são só visuais).
          </p>
        </div>

        {TIPOS_CRIACAO.map((tipo) => {
          const itens = criacoesFake.filter((c) => c.tipo === tipo)
          const Icone = tipoIcone[tipo]
          return (
            <Card key={tipo}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icone size={14} className="text-brand-300" />
                  {tipoCriacaoLabel[tipo]} ({itens.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="hidden text-[10px] text-muted md:inline">
                    {tipoCriacaoDescricao[tipo]}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => abrirNovo(tipo)}>
                    <Plus size={12} /> Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardBody>
                {itens.length === 0 ? (
                  <p className="text-xs text-muted">
                    Nenhum{tipo === 'copy_lp' || tipo === 'copy_criativos' ? 'a' : ''}{' '}
                    {tipoCriacaoLabel[tipo].toLowerCase()} ainda. Crie um briefing e gere um
                    rascunho com IA.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {itens.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => abrirEdicao(c)}
                        className="flex w-full items-start gap-3 rounded-lg border border-border bg-bg-soft p-3 text-left transition-colors hover:bg-bg-elev hover:border-brand-500/40 cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{c.titulo}</p>
                            <StatusBadge status={c.status} />
                            {c.enviado_para_producao_em &&
                              (c.tipo === 'copy_lp' || c.tipo === 'copy_criativos') && (
                                <Badge tone="info" className="text-[10px]">
                                  enviado p/ webdesign
                                </Badge>
                              )}
                          </div>
                          {c.conteudo ? (
                            <p className="mt-1 line-clamp-2 text-xs text-muted whitespace-pre-wrap">
                              {c.conteudo}
                            </p>
                          ) : c.briefing ? (
                            <p className="mt-1 line-clamp-2 text-xs text-muted italic">
                              Briefing: {c.briefing}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-muted italic">Sem conteúdo ainda.</p>
                          )}
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                            <span>Atualizado em {formatDateTime(c.updated_at)}</span>
                          </div>
                        </div>
                        {c.responsavel && <Avatar name={c.responsavel.nome} size="sm" />}
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )
        })}
      </div>

      <CriacaoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        cliente={clienteFake}
        tipo={modalTipo}
        criacao={modalCriacao}
        onSaved={() => setModalOpen(false)}
        previewMode
      />
    </div>
  )
}

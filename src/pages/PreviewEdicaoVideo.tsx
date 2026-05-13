/**
 * Preview de /webdesign/edicao-video com dados fictícios.
 * Rota: /preview/edicao-video (pública, não chama Supabase).
 */
import { useMemo, useState } from 'react'
import { Plus, Search, ChevronRight, ChevronDown, Film } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import {
  EdicaoAccordion,
  EdicaoVideoModal,
} from '@/pages/webdesign/EdicaoVideo'
import {
  cn,
  statusEdicaoVideoLabel,
  ESTEIRA_EDICAO_VIDEO,
} from '@/lib/utils'
import type {
  Cliente,
  EdicaoVideo,
  StatusEdicaoVideo,
} from '@/types/database'

const statusDot: Record<StatusEdicaoVideo, string> = {
  pendente: 'bg-zinc-400 text-zinc-400',
  em_edicao: 'bg-sky-400 text-sky-400',
  em_aprovacao: 'bg-amber-400 text-amber-400',
  em_alteracao: 'bg-orange-400 text-orange-400',
  conclusao: 'bg-emerald-400 text-emerald-400',
}

// Mock clientes
const clientesFake: Cliente[] = [
  { id: 'c1', nome: 'Dra. Maria Adélia' },
  { id: 'c2', nome: 'GB Modas' },
  { id: 'c3', nome: 'Dr. Daniel Oliveira' },
].map(
  (c) =>
    ({
      ...c,
      status: 'ativo',
      squad: 'BlackOps',
      nicho: 'Saúde',
      plataformas: ['meta_ads'],
      jornada_social: 'planejamento',
      modulos: ['webdesign'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as Cliente),
)

// Mock responsável
const designerPaloma = {
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
  created_at: new Date().toISOString(),
}
const designerLucas = {
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
  created_at: new Date().toISOString(),
}

// Helper de data
function diasUteis(offset: number): string {
  const d = new Date()
  let added = 0
  while (added < offset) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return d.toISOString().slice(0, 10)
}

function diasAtras(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// Mock edições — uma em cada status, com variações
const edicoesFake: EdicaoVideo[] = [
  // ============ PENDENTE (2) ============
  {
    id: 'e1',
    cliente_id: 'c1',
    titulo: 'Reel — Antes e Depois Camila (60s)',
    status: 'pendente',
    responsavel_id: 'p1',
    ordem: 1,
    prazo: diasUteis(3),
    aprovado_em: new Date().toISOString(),
    briefing:
      'Reel de 60s contando a história da Camila — antes/depois do tratamento ortodôntico. Tom emocional, com depoimento + autoridade da Dra. Maria.',
    referencias: [
      {
        tipo: 'drive',
        url: 'https://drive.google.com/folder/xxx',
        descricao: 'Pasta com brutos da gravação',
      },
      {
        tipo: 'youtube',
        url: 'https://youtube.com/watch?v=abc',
        descricao: 'Referência de edição',
      },
    ],
    arquivos: [
      {
        nome: 'roteiro-camila.pdf',
        tamanho: 184_320,
        tipo: 'application/pdf',
        url: '#',
      },
    ],
    video_final_url: null,
    observacoes: null,
    created_at: diasAtras(1),
    updated_at: new Date().toISOString(),
    cliente: clientesFake[0],
    responsavel: designerPaloma,
  },
  {
    id: 'e2',
    cliente_id: 'c1',
    titulo: 'Reel — Dra apresenta clínica (45s)',
    status: 'pendente',
    responsavel_id: null,
    ordem: 2,
    prazo: diasUteis(3),
    aprovado_em: new Date().toISOString(),
    briefing: 'Tour rápido pela clínica + apresentação da Dra. Maria.',
    referencias: [],
    arquivos: [],
    video_final_url: null,
    observacoes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    cliente: clientesFake[0],
    responsavel: null,
  },

  // ============ EM EDIÇÃO (1) ============
  {
    id: 'e3',
    cliente_id: 'c2',
    titulo: 'Reel — Looks GB Modas Festa Junina',
    status: 'em_edicao',
    responsavel_id: 'p2',
    ordem: 3,
    prazo: diasUteis(2),
    aprovado_em: diasAtras(2),
    briefing: 'Combinações de looks pra festa junina, com vendedora apresentando peças.',
    referencias: [
      {
        tipo: 'vimeo',
        url: 'https://vimeo.com/123',
        descricao: 'Vídeo de referência (estilo de edição)',
      },
    ],
    arquivos: [],
    video_final_url: null,
    observacoes: null,
    created_at: diasAtras(2),
    updated_at: new Date().toISOString(),
    cliente: clientesFake[1],
    responsavel: designerLucas,
  },

  // ============ EM APROVAÇÃO (1) ============
  {
    id: 'e4',
    cliente_id: 'c3',
    titulo: 'Carrossel animado — Bariátrica humanizada',
    status: 'em_aprovacao',
    responsavel_id: 'p1',
    ordem: 4,
    prazo: diasUteis(1),
    aprovado_em: diasAtras(3),
    briefing: '8 slides explicando a abordagem humanizada da bariátrica do Dr. Daniel.',
    referencias: [
      {
        tipo: 'drive',
        url: 'https://drive.google.com/folder/yyy',
        descricao: 'Pasta com imagens da clínica',
      },
    ],
    arquivos: [],
    video_final_url:
      'https://drive.google.com/file/d/preview-link',
    observacoes: 'Aguardando feedback do cliente até quinta.',
    created_at: diasAtras(3),
    updated_at: new Date().toISOString(),
    cliente: clientesFake[2],
    responsavel: designerPaloma,
  },

  // ============ EM ALTERAÇÃO (1, atrasada) ============
  {
    id: 'e5',
    cliente_id: 'c2',
    titulo: 'Reel — Provador (1 peça, 3 looks)',
    status: 'em_alteracao',
    responsavel_id: 'p2',
    ordem: 5,
    prazo: diasAtras(1), // ATRASADA
    aprovado_em: diasAtras(6),
    briefing: 'Vendedora mostrando 1 peça com 3 combinações diferentes.',
    referencias: [],
    arquivos: [],
    video_final_url: 'https://drive.google.com/file/d/v1',
    observacoes: 'Cliente pediu pra cortar 5s do final e mudar trilha.',
    created_at: diasAtras(6),
    updated_at: diasAtras(1),
    cliente: clientesFake[1],
    responsavel: designerLucas,
  },

  // ============ CONCLUÍDO (2) ============
  {
    id: 'e6',
    cliente_id: 'c1',
    titulo: 'Reel — Tratamento Invisalign',
    status: 'conclusao',
    responsavel_id: 'p1',
    ordem: 6,
    prazo: diasAtras(2),
    aprovado_em: diasAtras(8),
    briefing: 'Reel educativo sobre o tratamento com alinhadores invisíveis.',
    referencias: [],
    arquivos: [],
    video_final_url: 'https://drive.google.com/file/d/v2',
    observacoes: null,
    created_at: diasAtras(8),
    updated_at: diasAtras(2),
    cliente: clientesFake[0],
    responsavel: designerPaloma,
  },
  {
    id: 'e7',
    cliente_id: 'c2',
    titulo: 'Stories — Liquidação black weekend',
    status: 'conclusao',
    responsavel_id: 'p2',
    ordem: 7,
    prazo: diasAtras(5),
    aprovado_em: diasAtras(11),
    briefing: 'Sequência de stories pra divulgar liquidação de 3 dias.',
    referencias: [],
    arquivos: [],
    video_final_url: 'https://drive.google.com/file/d/v3',
    observacoes: null,
    created_at: diasAtras(11),
    updated_at: diasAtras(5),
    cliente: clientesFake[1],
    responsavel: designerLucas,
  },
]

export default function PreviewEdicaoVideo() {
  const [q, setQ] = useState('')
  const [filtroCliente, setFiltroCliente] = useState<string>('')
  const [collapsed, setCollapsed] = useState<
    Partial<Record<StatusEdicaoVideo, boolean>>
  >({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EdicaoVideo | null>(null)

  const filtered = useMemo(() => {
    let arr = edicoesFake
    if (filtroCliente) arr = arr.filter((e) => e.cliente_id === filtroCliente)
    if (q.trim()) {
      const term = q.toLowerCase()
      arr = arr.filter(
        (e) =>
          (e.titulo ?? '').toLowerCase().includes(term) ||
          (e.cliente?.nome ?? '').toLowerCase().includes(term),
      )
    }
    return arr
  }, [q, filtroCliente])

  const porStatus = useMemo(() => {
    const map = new Map<StatusEdicaoVideo, EdicaoVideo[]>()
    for (const s of ESTEIRA_EDICAO_VIDEO) map.set(s, [])
    for (const e of filtered) {
      const arr = map.get(e.status) ?? []
      arr.push(e)
      map.set(e.status, arr)
    }
    return map
  }, [filtered])

  const sections = ESTEIRA_EDICAO_VIDEO.filter(
    (s) => (porStatus.get(s)?.length ?? 0) > 0,
  )

  function abrirNovo() {
    setEditing(null)
    setModalOpen(true)
  }
  function abrirEdicao(e: EdicaoVideo) {
    setEditing(e)
    setModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <p className="text-xs text-amber-200">
            <strong>Preview</strong> · dados fictícios · sem login. Botões e modal
            funcionam, mas salvar/excluir/upload estão desabilitados.
          </p>
        </div>

        <PageHeader
          title="Edição de Vídeo"
          description={`${edicoesFake.length} item(ns) · SLA: 2 vídeos a cada 3 dias úteis`}
          actions={
            <Button onClick={abrirNovo}>
              <Plus size={14} /> Nova edição
            </Button>
          }
        />

        <Card className="mb-4">
          <CardBody className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por título ou cliente..."
                className="pl-9"
              />
            </div>
            <Select
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="w-56"
            >
              <option value="">Todos os clientes</option>
              {clientesFake.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </CardBody>
        </Card>

        {sections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-bg-soft/40 p-12 text-center">
            <Film size={28} className="mx-auto mb-2 text-muted" />
            <p className="text-sm text-zinc-200">Nenhum item encontrado nos filtros</p>
          </div>
        ) : (
          <div className="space-y-5">
            {sections.map((status) => {
              const items = porStatus.get(status) ?? []
              const isCollapsed = collapsed[status] ?? false
              return (
                <div key={status}>
                  <button
                    onClick={() =>
                      setCollapsed((c) => ({ ...c, [status]: !(c[status] ?? false) }))
                    }
                    className="mb-2 flex w-full items-center gap-2.5 text-left"
                  >
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]',
                        statusDot[status],
                      )}
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-200">
                      {statusEdicaoVideoLabel[status]}
                    </span>
                    <span className="rounded-md bg-bg-elev px-1.5 py-0.5 text-[10px] text-muted">
                      {items.length}
                    </span>
                    {isCollapsed ? (
                      <ChevronRight size={12} className="ml-auto text-muted" />
                    ) : (
                      <ChevronDown size={12} className="ml-auto text-muted" />
                    )}
                  </button>
                  {!isCollapsed && (
                    <div className="flex flex-col gap-2">
                      {items.map((e) => (
                        <EdicaoAccordion
                          key={e.id}
                          edicao={e}
                          clientes={clientesFake}
                          expanded={expandedId === e.id}
                          onToggle={() =>
                            setExpandedId((id) => (id === e.id ? null : e.id))
                          }
                          onClick={() => abrirEdicao(e)}
                          onChanged={() => {}}
                          previewMode
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <EdicaoVideoModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          edicao={editing}
          clientes={clientesFake}
          onSaved={() => setModalOpen(false)}
          previewMode
        />
      </div>
    </div>
  )
}

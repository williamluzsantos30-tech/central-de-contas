/**
 * Central Operacional — Overview (Tela 1).
 * Grid de setores + tabs + modal "Novo Documento".
 */
import { useMemo, useState } from 'react'
import { Plus, Users, List, Briefcase } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useCentral } from './store'
import { SectorCard, DocumentListItem, NewDocumentModal, type NovoDocPayload } from './components'
import type { Categoria } from './mockDocuments'

type Aba = 'cargo' | 'todos' | 'jd'

export default function CentralOperacional() {
  const { setores, addDocumento } = useCentral()
  const [aba, setAba] = useState<Aba>('cargo')
  const [modalOpen, setModalOpen] = useState(false)

  const todosDocs = useMemo(
    () =>
      setores
        .flatMap((s) => s.documentos.map((d) => ({ ...d, setorId: s.id, setorNome: s.nome })))
        .sort((a, b) => b.data.localeCompare(a.data)),
    [setores],
  )
  const jds = todosDocs.filter((d) => d.categoria === ('Job Descriptions' as Categoria))

  function criar(p: NovoDocPayload) {
    addDocumento(p.setorId, {
      titulo: p.titulo,
      categoria: p.categoria,
      status: p.status,
      cargos: p.cargos,
      conteudo: p.conteudo,
      temPdf: p.temPdf,
      data: new Date().toISOString().slice(0, 10),
    })
  }

  return (
    <div>
      <nav className="mb-1 text-[11px] text-muted">Central-operacional</nav>
      <PageHeader
        title="Central Operacional"
        description="Documentos oficiais, playbooks, POPs e padrões da agência"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={14} /> Novo Documento
          </Button>
        }
      />

      {/* Tabs */}
      <div className="mb-5 inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
        {(
          [
            { key: 'cargo', label: 'Por Cargo', icon: Users },
            { key: 'todos', label: 'Todos os Documentos', icon: List },
            { key: 'jd', label: 'Job Descriptions', icon: Briefcase },
          ] as { key: Aba; label: string; icon: typeof Users }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setAba(t.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              aba === t.key ? 'bg-bg-card text-zinc-100 shadow-sm' : 'text-muted hover:text-zinc-200',
            )}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {aba === 'cargo' && (
        <>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Setores</p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {setores.map((s) => (
              <SectorCard key={s.id} setor={s} />
            ))}
          </div>
        </>
      )}

      {aba === 'todos' && (
        <div className="space-y-2">
          {todosDocs.map((d) => (
            <DocumentListItem key={d.id} doc={d} setorId={d.setorId} />
          ))}
        </div>
      )}

      {aba === 'jd' && (
        <div className="space-y-2">
          {jds.length > 0 ? (
            jds.map((d) => <DocumentListItem key={d.id} doc={d} setorId={d.setorId} />)
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-bg-soft/30 p-12 text-center">
              <Briefcase size={22} className="mx-auto mb-2 text-muted" />
              <p className="text-sm text-zinc-200">Nenhuma Job Description cadastrada</p>
              <p className="mt-1 text-[11px] text-muted">
                Crie um documento na categoria “Job Descriptions” pra ele aparecer aqui.
              </p>
            </div>
          )}
        </div>
      )}

      <NewDocumentModal open={modalOpen} onClose={() => setModalOpen(false)} setores={setores} onCreate={criar} />
    </div>
  )
}

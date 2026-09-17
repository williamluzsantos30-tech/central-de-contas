/**
 * Central Operacional — Detalhe do Setor (Tela 3).
 * Documentos do setor agrupados por categoria, com filtro por cargo.
 */
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCentral } from './store'
import { CategorySection } from './components'
import { CATEGORIAS } from './mockDocuments'

export default function SetorDetalhe() {
  const { setorId } = useParams()
  const { setores } = useCentral()
  const setor = setores.find((s) => s.id === setorId)
  const [cargoFiltro, setCargoFiltro] = useState<string | null>(null)

  const docsFiltrados = useMemo(() => {
    if (!setor) return []
    return cargoFiltro ? setor.documentos.filter((d) => d.cargos.includes(cargoFiltro)) : setor.documentos
  }, [setor, cargoFiltro])

  if (!setor) {
    return (
      <div className="rounded-xl border border-border bg-bg-card p-12 text-center">
        <p className="text-sm text-zinc-200">Setor não encontrado.</p>
        <Link to="/central-operacional" className="mt-2 inline-block text-xs text-brand-300 hover:text-brand-200">
          ← Voltar à Central Operacional
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header com voltar */}
      <div className="mb-5 flex items-start gap-3">
        <Link
          to="/central-operacional"
          className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted transition-colors hover:border-brand-500/40 hover:text-brand-300"
          title="Voltar"
        >
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{setor.nome}</h1>
          <p className="mt-1 text-sm text-muted">
            {setor.documentos.length} {setor.documentos.length === 1 ? 'documento disponível' : 'documentos disponíveis'} ·{' '}
            {setor.cargos.length} {setor.cargos.length === 1 ? 'cargo' : 'cargos'}
          </p>
        </div>
      </div>

      {/* Pills de cargo (filtro) */}
      <div className="mb-5 flex flex-wrap gap-2">
        {setor.cargos.map((c) => {
          const ativo = cargoFiltro === c
          return (
            <button
              key={c}
              onClick={() => setCargoFiltro(ativo ? null : c)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                ativo
                  ? 'border-brand-500/50 bg-brand-500/15 text-brand-200'
                  : 'border-border bg-bg-elev text-zinc-300 hover:border-brand-500/40 hover:text-zinc-100',
              )}
            >
              {c}
            </button>
          )
        })}
        {cargoFiltro && (
          <button
            onClick={() => setCargoFiltro(null)}
            className="rounded-md px-2.5 py-1 text-xs text-muted hover:text-zinc-200"
          >
            Limpar filtro
          </button>
        )}
      </div>

      {/* Seções por categoria */}
      <div className="space-y-4">
        {CATEGORIAS.map((cat) => (
          <CategorySection
            key={cat}
            categoria={cat}
            setorId={setor.id}
            docs={docsFiltrados.filter((d) => d.categoria === cat)}
          />
        ))}
        {docsFiltrados.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-bg-soft/30 p-12 text-center text-sm text-muted">
            Nenhum documento {cargoFiltro ? `para “${cargoFiltro}”` : 'neste setor'} ainda.
          </div>
        )}
      </div>
    </div>
  )
}

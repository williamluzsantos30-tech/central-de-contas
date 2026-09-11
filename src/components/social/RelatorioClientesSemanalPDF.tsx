/**
 * PDF Relatório Semanal — Clientes Social Media.
 *
 * Período: segunda-feira da semana corrente até o dia atual.
 * Conteúdo:
 *   - Capa com período + KPIs (clientes, publicadas, atrasadas, em produção)
 *   - Tabela "Resumo por cliente" com publicadas/atrasadas/em produção
 *   - Lista de "Publicações realizadas" + "Atrasadas (prazo passou sem publicar)"
 *
 * Foco: o que foi publicado e o que ficou pendente, sem ruído.
 * Paleta MovMed (mesma dos outros PDFs).
 */
import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'
import type { Cliente, ItemSocialMedia, PlanejamentoSocialMedia } from '@/types/database'

// =========================================================
// Paleta MovMed
// =========================================================

const COR = {
  laranja: '#f97316',
  preto: '#0a0a0a',
  branco: '#ffffff',
  texto: '#171717',
  cinza: '#525252',
  cinzaClaro: '#a3a3a3',
  borda: '#e5e5e5',
  bgSuave: '#fafafa',
  publicada: '#10b981',
  atrasada: '#ef4444',
  producao: '#f59e0b',
}

const LOGO_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/logo.png`

// =========================================================
// Helpers
// =========================================================

function inicioDaSemana(): Date {
  const d = new Date()
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (dow - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function fimDaSemana(): Date {
  const d = inicioDaSemana()
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

function parseLocal(iso: string): Date | null {
  if (!iso) return null
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  d.setHours(12, 0, 0, 0)
  return d
}

function formatDataPt(iso: string): string {
  const d = parseLocal(iso)
  return d ? d.toLocaleDateString('pt-BR') : iso
}

const diaSemanaLabel: Record<number, string> = {
  0: 'dom',
  1: 'seg',
  2: 'ter',
  3: 'qua',
  4: 'qui',
  5: 'sex',
  6: 'sab',
}

// =========================================================
// Styles
// =========================================================

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', backgroundColor: COR.branco },
  header: {
    backgroundColor: COR.preto,
    paddingHorizontal: 32,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogo: { width: 80, height: 24, objectFit: 'contain' },
  headerTitulo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: COR.branco,
    letterSpacing: 2,
  },
  faixaLaranja: { height: 3, backgroundColor: COR.laranja },
  capaBloco: { paddingHorizontal: 32, paddingTop: 40, paddingBottom: 24 },
  capaTipo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: COR.laranja,
    letterSpacing: 3,
    marginBottom: 8,
  },
  capaTitulo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 28,
    color: COR.texto,
    letterSpacing: -0.5,
    lineHeight: 1.1,
  },
  capaPeriodo: { fontSize: 12, color: COR.cinza, marginTop: 8 },
  bloco: { paddingHorizontal: 32, paddingVertical: 12 },
  kpiRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COR.borda,
    borderRadius: 6,
    padding: 10,
    backgroundColor: COR.bgSuave,
  },
  kpiLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1.5,
    color: COR.cinza,
  },
  kpiValor: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 22,
    color: COR.texto,
    marginTop: 4,
  },
  kpiSub: { fontSize: 8, color: COR.cinzaClaro, marginTop: 2 },
  sectionTitulo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: COR.texto,
    marginBottom: 4,
    paddingHorizontal: 32,
    marginTop: 18,
  },
  sectionSubtitulo: {
    fontSize: 9,
    color: COR.cinza,
    marginBottom: 8,
    paddingHorizontal: 32,
  },
  tabela: {
    marginHorizontal: 32,
    borderWidth: 1,
    borderColor: COR.borda,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tabelaHeader: {
    flexDirection: 'row',
    backgroundColor: COR.preto,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tabelaHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: COR.branco,
    letterSpacing: 0.8,
  },
  tabelaRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: COR.borda,
  },
  tabelaCell: { fontSize: 8, color: COR.texto },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
    color: COR.branco,
  },
  rodape: {
    position: 'absolute',
    bottom: 16,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: COR.cinzaClaro,
  },
})

function HeaderPagina() {
  return (
    <>
      <View style={s.header} fixed>
        <Image src={LOGO_URL} style={s.headerLogo} />
        <Text style={s.headerTitulo}>SOCIAL MEDIA · RELATÓRIO SEMANAL</Text>
      </View>
      <View style={s.faixaLaranja} fixed />
    </>
  )
}

function Rodape() {
  return (
    <View style={s.rodape} fixed>
      <Text>Relatório semanal</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function KpiCard({
  label,
  valor,
  sub,
  cor,
}: {
  label: string
  valor: number | string
  sub?: string
  cor?: string
}) {
  const labelStyles = cor ? [s.kpiLabel, { color: cor }] : s.kpiLabel
  return (
    <View style={s.kpiCard}>
      <Text style={labelStyles}>{label}</Text>
      <Text style={s.kpiValor}>{valor}</Text>
      {sub && <Text style={s.kpiSub}>{sub}</Text>}
    </View>
  )
}

// =========================================================
// Documento
// =========================================================

interface DocProps {
  clientes: Cliente[]
  items: ItemSocialMedia[]
  planejamentos: PlanejamentoSocialMedia[]
}

interface ResumoCliente {
  cliente: Cliente
  publicadasNaSemana: ItemDetalhe[]
  atrasadasNaSemana: ItemDetalhe[]
  emProducaoNaSemana: ItemDetalhe[]
}

interface ItemDetalhe {
  prazo: string
  titulo: string
  formato: string
}

function calcular({ clientes, items, planejamentos }: DocProps) {
  const seg = inicioDaSemana()
  const fim = fimDaSemana()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const planById = new Map(planejamentos.map((p) => [p.id, p]))

  const map = new Map<string, ResumoCliente>()
  for (const c of clientes) {
    map.set(c.id, {
      cliente: c,
      publicadasNaSemana: [],
      atrasadasNaSemana: [],
      emProducaoNaSemana: [],
    })
  }

  for (const it of items) {
    if (!it.prazo) continue
    const plan = planById.get(it.producao_id)
    if (!plan) continue
    const stat = map.get(plan.cliente_id)
    if (!stat) continue
    const d = parseLocal(it.prazo)
    if (!d) continue
    if (d < seg || d > fim) continue

    const detalhe: ItemDetalhe = {
      prazo: it.prazo,
      titulo: it.titulo,
      formato: it.formato,
    }
    // ⚠️ Fonte da verdade pra "publicada" é publicado_em (timestamp real),
    // NÃO status='conclusao' (que é só "arte pronta").
    const publicada = !!it.publicado_em
    if (publicada) {
      stat.publicadasNaSemana.push(detalhe)
    } else if (d < today) {
      stat.atrasadasNaSemana.push(detalhe)
    } else {
      stat.emProducaoNaSemana.push(detalhe)
    }
  }

  // Ordena por prazo (mais antigo primeiro)
  for (const stat of map.values()) {
    stat.publicadasNaSemana.sort((a, b) => a.prazo.localeCompare(b.prazo))
    stat.atrasadasNaSemana.sort((a, b) => a.prazo.localeCompare(b.prazo))
    stat.emProducaoNaSemana.sort((a, b) => a.prazo.localeCompare(b.prazo))
  }

  // Só inclui clientes com pelo menos uma atividade na semana
  return Array.from(map.values()).filter(
    (r) =>
      r.publicadasNaSemana.length +
        r.atrasadasNaSemana.length +
        r.emProducaoNaSemana.length >
      0,
  )
}

function RelatorioDoc({ clientes, items, planejamentos }: DocProps) {
  const seg = inicioDaSemana()
  const fim = fimDaSemana()
  const resumo = calcular({ clientes, items, planejamentos })

  // KPIs globais
  let totalPub = 0
  let totalAtr = 0
  let totalProd = 0
  for (const r of resumo) {
    totalPub += r.publicadasNaSemana.length
    totalAtr += r.atrasadasNaSemana.length
    totalProd += r.emProducaoNaSemana.length
  }
  const totalProgr = totalPub + totalAtr
  const taxa = totalProgr > 0 ? Math.round((totalPub / totalProgr) * 100) : 0

  // Lista flatten de todas as publicadas e atrasadas
  type Linha = { cliente: Cliente; det: ItemDetalhe }
  const publicadas: Linha[] = []
  const atrasadas: Linha[] = []
  for (const r of resumo) {
    for (const d of r.publicadasNaSemana) publicadas.push({ cliente: r.cliente, det: d })
    for (const d of r.atrasadasNaSemana) atrasadas.push({ cliente: r.cliente, det: d })
  }
  publicadas.sort((a, b) => a.det.prazo.localeCompare(b.det.prazo))
  atrasadas.sort((a, b) => a.det.prazo.localeCompare(b.det.prazo))

  return (
    <Document>
      {/* Página 1: Capa + KPIs + Resumo por cliente */}
      <Page size="A4" style={s.page}>
        <HeaderPagina />
        <View style={s.capaBloco}>
          <Text style={s.capaTipo}>OPERACIONAL SOCIAL MEDIA</Text>
          <Text style={s.capaTitulo}>Relatório Semanal</Text>
          <Text style={s.capaPeriodo}>
            {seg.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} —{' '}
            {fim.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </Text>
        </View>

        <View style={s.bloco}>
          <View style={s.kpiRow}>
            <KpiCard
              label="PUBLICADAS"
              valor={totalPub}
              sub="Posts publicados na semana"
              cor={COR.publicada}
            />
            <KpiCard
              label="ATRASADAS"
              valor={totalAtr}
              sub="Prazo passou sem publicar"
              cor={totalAtr > 0 ? COR.atrasada : undefined}
            />
            <KpiCard
              label="EM PRODUÇÃO"
              valor={totalProd}
              sub="Programadas pra semana"
              cor={totalProd > 0 ? COR.producao : undefined}
            />
            <KpiCard
              label="TAXA"
              valor={`${taxa}%`}
              sub="Publicadas / Programadas"
            />
          </View>
        </View>

        <Text style={s.sectionTitulo}>Resumo por cliente</Text>
        <Text style={s.sectionSubtitulo}>
          {resumo.length} cliente{resumo.length === 1 ? '' : 's'} com atividade na semana.
        </Text>

        <View style={s.tabela}>
          <View style={s.tabelaHeader}>
            <Text style={[s.tabelaHeaderCell, { flex: 3 }]}>CLIENTE</Text>
            <Text style={[s.tabelaHeaderCell, { flex: 1.5 }]}>SOCIAL MEDIA</Text>
            <Text style={[s.tabelaHeaderCell, { flex: 1, textAlign: 'center' }]}>PUB.</Text>
            <Text style={[s.tabelaHeaderCell, { flex: 1, textAlign: 'center' }]}>ATR.</Text>
            <Text style={[s.tabelaHeaderCell, { flex: 1, textAlign: 'center' }]}>PROD.</Text>
          </View>
          {resumo.length === 0 ? (
            <View style={s.tabelaRow}>
              <Text style={[s.tabelaCell, { flex: 1, fontStyle: 'italic', color: COR.cinza }]}>
                Nenhuma atividade registrada nesta semana.
              </Text>
            </View>
          ) : (
            resumo.map((r) => (
              <View key={r.cliente.id} style={s.tabelaRow}>
                <View style={{ flex: 3 }}>
                  <Text style={[s.tabelaCell, { fontFamily: 'Helvetica-Bold' }]}>
                    {r.cliente.nome}
                  </Text>
                  {r.cliente.nicho && (
                    <Text style={[s.tabelaCell, { fontSize: 7, color: COR.cinza }]}>
                      {r.cliente.nicho} · Squad {r.cliente.squad ?? '—'}
                    </Text>
                  )}
                </View>
                <Text style={[s.tabelaCell, { flex: 1.5 }]}>
                  {r.cliente.social_media?.nome ?? '—'}
                </Text>
                <Text
                  style={[
                    s.tabelaCell,
                    {
                      flex: 1,
                      textAlign: 'center',
                      fontFamily: 'Helvetica-Bold',
                      color: r.publicadasNaSemana.length > 0 ? COR.publicada : COR.cinzaClaro,
                    },
                  ]}
                >
                  {r.publicadasNaSemana.length}
                </Text>
                <Text
                  style={[
                    s.tabelaCell,
                    {
                      flex: 1,
                      textAlign: 'center',
                      fontFamily: 'Helvetica-Bold',
                      color: r.atrasadasNaSemana.length > 0 ? COR.atrasada : COR.cinzaClaro,
                    },
                  ]}
                >
                  {r.atrasadasNaSemana.length}
                </Text>
                <Text
                  style={[
                    s.tabelaCell,
                    {
                      flex: 1,
                      textAlign: 'center',
                      fontFamily: 'Helvetica-Bold',
                      color: r.emProducaoNaSemana.length > 0 ? COR.producao : COR.cinzaClaro,
                    },
                  ]}
                >
                  {r.emProducaoNaSemana.length}
                </Text>
              </View>
            ))
          )}
        </View>

        <Rodape />
      </Page>

      {/* Página 2+: Atrasadas (prioridade) e Publicadas detalhadas */}
      <Page size="A4" style={s.page}>
        <HeaderPagina />

        {atrasadas.length > 0 && (
          <>
            <Text style={s.sectionTitulo}>
              <Text style={{ color: COR.atrasada }}>Atrasadas</Text> — prazo passou sem publicação
            </Text>
            <Text style={s.sectionSubtitulo}>
              {atrasadas.length} post{atrasadas.length === 1 ? '' : 's'} ·{' '}
              {new Set(atrasadas.map((l) => l.cliente.id)).size} cliente
              {new Set(atrasadas.map((l) => l.cliente.id)).size === 1 ? '' : 's'}.
            </Text>
            <View style={s.tabela}>
              <View style={[s.tabelaHeader, { backgroundColor: COR.atrasada }]}>
                <Text style={[s.tabelaHeaderCell, { flex: 1 }]}>DATA</Text>
                <Text style={[s.tabelaHeaderCell, { flex: 2 }]}>CLIENTE</Text>
                <Text style={[s.tabelaHeaderCell, { flex: 3 }]}>POST</Text>
                <Text style={[s.tabelaHeaderCell, { flex: 1.2 }]}>FORMATO</Text>
              </View>
              {atrasadas.map(({ cliente, det }, i) => {
                const d = parseLocal(det.prazo)
                return (
                  <View key={`${cliente.id}-${i}`} style={s.tabelaRow}>
                    <Text style={[s.tabelaCell, { flex: 1 }]}>
                      {d ? diaSemanaLabel[d.getDay()] : ''} {formatDataPt(det.prazo)}
                    </Text>
                    <Text
                      style={[s.tabelaCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}
                    >
                      {cliente.nome}
                    </Text>
                    <Text style={[s.tabelaCell, { flex: 3 }]}>{det.titulo || '—'}</Text>
                    <Text style={[s.tabelaCell, { flex: 1.2 }]}>{det.formato}</Text>
                  </View>
                )
              })}
            </View>
          </>
        )}

        {publicadas.length > 0 && (
          <>
            <Text style={s.sectionTitulo}>
              <Text style={{ color: COR.publicada }}>Publicadas</Text> na semana
            </Text>
            <Text style={s.sectionSubtitulo}>
              {publicadas.length} post{publicadas.length === 1 ? '' : 's'} publicado
              {publicadas.length === 1 ? '' : 's'}.
            </Text>
            <View style={s.tabela}>
              <View style={s.tabelaHeader}>
                <Text style={[s.tabelaHeaderCell, { flex: 1 }]}>DATA</Text>
                <Text style={[s.tabelaHeaderCell, { flex: 2 }]}>CLIENTE</Text>
                <Text style={[s.tabelaHeaderCell, { flex: 3 }]}>POST</Text>
                <Text style={[s.tabelaHeaderCell, { flex: 1.2 }]}>FORMATO</Text>
              </View>
              {publicadas.map(({ cliente, det }, i) => {
                const d = parseLocal(det.prazo)
                return (
                  <View key={`${cliente.id}-${i}`} style={s.tabelaRow}>
                    <Text style={[s.tabelaCell, { flex: 1 }]}>
                      {d ? diaSemanaLabel[d.getDay()] : ''} {formatDataPt(det.prazo)}
                    </Text>
                    <Text
                      style={[s.tabelaCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}
                    >
                      {cliente.nome}
                    </Text>
                    <Text style={[s.tabelaCell, { flex: 3 }]}>{det.titulo || '—'}</Text>
                    <Text style={[s.tabelaCell, { flex: 1.2 }]}>{det.formato}</Text>
                  </View>
                )
              })}
            </View>
          </>
        )}

        {atrasadas.length === 0 && publicadas.length === 0 && (
          <View
            style={{
              marginHorizontal: 32,
              padding: 24,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: COR.borda,
              borderRadius: 6,
              alignItems: 'center',
              marginTop: 18,
            }}
          >
            <Text style={{ fontSize: 11, color: COR.cinza }}>
              Nenhuma publicação registrada nesta semana.
            </Text>
          </View>
        )}

        <Rodape />
      </Page>
    </Document>
  )
}

// =========================================================
// API pública
// =========================================================

export async function downloadRelatorioSemanalSocialPDF(props: DocProps): Promise<void> {
  const blob = await pdf(<RelatorioDoc {...props} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  a.download = `relatorio-social-semanal_${yyyy}-${mm}-${dd}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

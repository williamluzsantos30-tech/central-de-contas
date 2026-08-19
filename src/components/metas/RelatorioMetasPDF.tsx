/**
 * Relatorio de Metas em PDF — mensal + resumo final.
 *
 * Estrutura:
 *   1. Capa com nome do cliente, periodo coberto, data de geracao
 *   2. Uma pagina por mes (do mais antigo pro mais recente):
 *      - Header: Cliente · Competencia
 *      - Bloco Google Ads: Meta vs Resultado + calculos (faturamento, ROAS)
 *      - Bloco Meta Ads: idem
 *      - Consolidado do mes (soma das 2 plataformas)
 *   3. Pagina final "Resumo do periodo":
 *      - Totais acumulados (investimento, faturamento, leads, consultas, vendas)
 *      - Medias mensais
 *      - ROAS consolidado
 *
 * Paleta MovMed (laranja/preto/branco) igual outros PDFs.
 */
import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Font,
} from '@react-pdf/renderer'
import type { Cliente, Meta, MetasPorPlataforma, MetasValores } from '@/types/database'

const LOGO_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/logo-movmed.png`

Font.registerHyphenationCallback((word) => {
  if (word.length <= 25) return [word]
  return word.match(/.{1,25}/g) ?? [word]
})

const COR_LARANJA = '#f97316'
const COR_PRETO = '#0a0a0a'
const COR_BRANCO = '#ffffff'
const COR_TEXTO = '#0a0a0a'
const COR_TEXTO_CINZA = '#525252'
const COR_BORDA = '#e5e5e5'
const COR_BG_SUAVE = '#fafafa'
const COR_META = '#a78bfa' // roxo suave pra coluna "meta"
const COR_RESULT = '#10b981' // verde pra coluna "resultado"

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: COR_BRANCO,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
  },
  // Capa
  capaPage: {
    fontFamily: 'Helvetica',
    backgroundColor: COR_LARANJA,
  },
  capa: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  capaTitle: {
    color: COR_BRANCO,
    fontSize: 42,
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 16,
  },
  capaSub: {
    color: COR_BRANCO,
    fontSize: 20,
    textAlign: 'center',
    opacity: 0.95,
    marginBottom: 8,
  },
  capaPeriodo: {
    color: COR_BRANCO,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
    opacity: 0.85,
    letterSpacing: 1,
  },
  rodapeCapa: {
    height: 56,
    backgroundColor: COR_PRETO,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  rodapeCapaLogo: { width: 90, height: 24, objectFit: 'contain' },
  rodapeCapaTexto: { color: COR_BRANCO, fontSize: 9, opacity: 0.8 },

  // Header mensal
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: COR_LARANJA,
  },
  headerClienteBlock: { flexDirection: 'column' },
  headerCliente: { fontSize: 16, fontWeight: 'bold', color: COR_TEXTO },
  headerCompetencia: { fontSize: 11, color: COR_TEXTO_CINZA, marginTop: 3, letterSpacing: 1 },
  headerLogo: { width: 80, height: 24, objectFit: 'contain' },

  // Bloco de plataforma
  platBloco: { marginBottom: 20 },
  platTitulo: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COR_BRANCO,
    backgroundColor: COR_PRETO,
    paddingVertical: 6,
    paddingHorizontal: 10,
    letterSpacing: 1,
    marginBottom: 6,
  },

  // Tabela Meta × Resultado
  tabela: { borderWidth: 1, borderColor: COR_BORDA, borderRadius: 4 },
  tabelaHead: {
    flexDirection: 'row',
    backgroundColor: COR_BG_SUAVE,
    borderBottomWidth: 1,
    borderBottomColor: COR_BORDA,
  },
  thLabel: { flex: 2, padding: 6, fontSize: 9, color: COR_TEXTO_CINZA, fontWeight: 'bold' },
  thVal: {
    flex: 1,
    padding: 6,
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  linha: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COR_BORDA,
  },
  linhaLabel: { flex: 2, padding: 6, fontSize: 10, color: COR_TEXTO },
  linhaVal: {
    flex: 1,
    padding: 6,
    fontSize: 10,
    color: COR_TEXTO,
    textAlign: 'right',
  },
  linhaCalc: {
    flexDirection: 'row',
    backgroundColor: '#fef3e2',
    borderTopWidth: 1,
    borderTopColor: COR_BORDA,
  },
  linhaCalcLabel: { flex: 2, padding: 6, fontSize: 10, color: COR_TEXTO, fontWeight: 'bold' },
  linhaCalcVal: {
    flex: 1,
    padding: 6,
    fontSize: 10,
    color: COR_TEXTO,
    textAlign: 'right',
    fontWeight: 'bold',
  },

  // Consolidado do mes
  consolidado: {
    marginTop: 10,
    padding: 10,
    backgroundColor: COR_LARANJA,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  consolidadoItem: { alignItems: 'center' },
  consolidadoLabel: { color: COR_BRANCO, fontSize: 8, opacity: 0.85, letterSpacing: 1 },
  consolidadoValor: { color: COR_BRANCO, fontSize: 14, fontWeight: 'bold', marginTop: 3 },

  // Resumo
  resumoTitulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COR_TEXTO,
    marginBottom: 4,
  },
  resumoSubtitulo: { fontSize: 11, color: COR_TEXTO_CINZA, marginBottom: 20 },
  resumoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  resumoBox: {
    width: '48%',
    marginBottom: 12,
    marginRight: '2%',
    padding: 12,
    borderWidth: 1,
    borderColor: COR_BORDA,
    borderRadius: 4,
    backgroundColor: COR_BG_SUAVE,
  },
  resumoBoxLabel: { fontSize: 9, color: COR_TEXTO_CINZA, letterSpacing: 1, marginBottom: 4 },
  resumoBoxValor: { fontSize: 20, fontWeight: 'bold', color: COR_TEXTO },
  resumoBoxSub: { fontSize: 9, color: COR_TEXTO_CINZA, marginTop: 2 },

  // Tabela historica no resumo
  histTable: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: COR_BORDA,
    borderRadius: 4,
  },
  histHead: {
    flexDirection: 'row',
    backgroundColor: COR_PRETO,
    padding: 6,
  },
  histTh: { fontSize: 8, fontWeight: 'bold', color: COR_BRANCO, letterSpacing: 1 },
  histRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COR_BORDA,
    padding: 6,
  },
  histTd: { fontSize: 9, color: COR_TEXTO },

  // Numero de pagina
  numPag: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 9,
    color: COR_TEXTO_CINZA,
  },
})

interface Props {
  cliente: Cliente
  historico: Meta[]
}

// ==============================================================
// Helpers
// ==============================================================

function normalize(raw: unknown): MetasPorPlataforma {
  const r = (raw ?? {}) as Record<string, unknown>
  if ('google' in r || 'meta' in r) {
    return {
      google: { ...empty(), ...((r.google ?? {}) as MetasValores) },
      meta: { ...empty(), ...((r.meta ?? {}) as MetasValores) },
    }
  }
  return { google: { ...empty(), ...(r as MetasValores) }, meta: { ...empty() } }
}

function empty(): MetasValores {
  return {
    investimento: null,
    custo_mensagem: null,
    mensagens_qualificadas: null,
    numero_consultas: null,
    tm_consulta: null,
    numero_procedimentos: null,
    tm_procedimento: null,
  }
}

function faturamento(v: MetasValores): number {
  return (
    (v.numero_consultas ?? 0) * (v.tm_consulta ?? 0) +
    (v.numero_procedimentos ?? 0) * (v.tm_procedimento ?? 0)
  )
}

function roas(v: MetasValores): number | null {
  const f = faturamento(v)
  return v.investimento && f > 0 ? f / v.investimento : null
}

function fmtBRL(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return Math.round(n).toLocaleString('pt-BR')
}

function fmtRoas(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${n.toFixed(2)}x`
}

function fmtCompetencia(mesAno: string): string {
  // mes_ano formato: YYYY-MM-01
  const [ano, mes] = mesAno.split('-')
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]
  const i = Math.max(0, Math.min(11, parseInt(mes, 10) - 1))
  return `${meses[i]} de ${ano}`
}

function fmtCompetenciaCurta(mesAno: string): string {
  const [ano, mes] = mesAno.split('-')
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const i = Math.max(0, Math.min(11, parseInt(mes, 10) - 1))
  return `${meses[i]}/${ano.slice(2)}`
}

// ==============================================================
// Sub-componentes
// ==============================================================

function TabelaMetaVsResultado({
  meta,
  resultado,
}: {
  meta: MetasValores
  resultado: MetasValores
}) {
  const rows: Array<[string, string, string, boolean]> = [
    ['Investimento', fmtBRL(meta.investimento), fmtBRL(resultado.investimento), false],
    ['Custo por mensagem', fmtBRL(meta.custo_mensagem), fmtBRL(resultado.custo_mensagem), false],
    [
      'Mensagens qualificadas',
      fmtInt(meta.mensagens_qualificadas),
      fmtInt(resultado.mensagens_qualificadas),
      false,
    ],
    ['Nº consultas', fmtInt(meta.numero_consultas), fmtInt(resultado.numero_consultas), false],
    ['TM consulta', fmtBRL(meta.tm_consulta), fmtBRL(resultado.tm_consulta), false],
    [
      'Nº procedimentos',
      fmtInt(meta.numero_procedimentos),
      fmtInt(resultado.numero_procedimentos),
      false,
    ],
    ['TM procedimento', fmtBRL(meta.tm_procedimento), fmtBRL(resultado.tm_procedimento), false],
    ['Faturamento estimado', fmtBRL(faturamento(meta)), fmtBRL(faturamento(resultado)), true],
    ['ROAS', fmtRoas(roas(meta)), fmtRoas(roas(resultado)), true],
  ]
  return (
    <View style={styles.tabela}>
      <View style={styles.tabelaHead}>
        <Text style={styles.thLabel}>MÉTRICA</Text>
        <Text style={[styles.thVal, { color: COR_META }]}>META</Text>
        <Text style={[styles.thVal, { color: COR_RESULT }]}>RESULTADO</Text>
      </View>
      {rows.map(([label, metaVal, resVal, isCalc], i) => (
        <View key={i} style={isCalc ? styles.linhaCalc : styles.linha}>
          <Text style={isCalc ? styles.linhaCalcLabel : styles.linhaLabel}>{label}</Text>
          <Text style={isCalc ? styles.linhaCalcVal : styles.linhaVal}>{metaVal}</Text>
          <Text style={isCalc ? styles.linhaCalcVal : styles.linhaVal}>{resVal}</Text>
        </View>
      ))}
    </View>
  )
}

function PaginaMensal({ cliente, meta }: { cliente: Cliente; meta: Meta }) {
  const metaP = normalize(meta.meta_data)
  const resP = normalize(meta.resultado_data)

  // Consolidado do mes (Google + Meta)
  const invTotal =
    (resP.google.investimento ?? 0) + (resP.meta.investimento ?? 0)
  const fatTotal = faturamento(resP.google) + faturamento(resP.meta)
  const roasTotal = invTotal > 0 && fatTotal > 0 ? fatTotal / invTotal : null
  const leadsTotal =
    (resP.google.mensagens_qualificadas ?? 0) + (resP.meta.mensagens_qualificadas ?? 0)
  const consTotal =
    (resP.google.numero_consultas ?? 0) + (resP.meta.numero_consultas ?? 0)

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerClienteBlock}>
          <Text style={styles.headerCliente}>{cliente.nome}</Text>
          <Text style={styles.headerCompetencia}>{fmtCompetencia(meta.mes_ano).toUpperCase()}</Text>
        </View>
        <Image src={LOGO_URL} style={styles.headerLogo} />
      </View>

      <View style={styles.platBloco}>
        <Text style={styles.platTitulo}>GOOGLE ADS</Text>
        <TabelaMetaVsResultado meta={metaP.google} resultado={resP.google} />
      </View>

      <View style={styles.platBloco}>
        <Text style={styles.platTitulo}>META ADS</Text>
        <TabelaMetaVsResultado meta={metaP.meta} resultado={resP.meta} />
      </View>

      {/* Consolidado do mes */}
      <View style={styles.consolidado}>
        <View style={styles.consolidadoItem}>
          <Text style={styles.consolidadoLabel}>INVESTIMENTO</Text>
          <Text style={styles.consolidadoValor}>{fmtBRL(invTotal || null)}</Text>
        </View>
        <View style={styles.consolidadoItem}>
          <Text style={styles.consolidadoLabel}>FATURAMENTO</Text>
          <Text style={styles.consolidadoValor}>{fmtBRL(fatTotal || null)}</Text>
        </View>
        <View style={styles.consolidadoItem}>
          <Text style={styles.consolidadoLabel}>ROAS</Text>
          <Text style={styles.consolidadoValor}>{fmtRoas(roasTotal)}</Text>
        </View>
        <View style={styles.consolidadoItem}>
          <Text style={styles.consolidadoLabel}>LEADS</Text>
          <Text style={styles.consolidadoValor}>{fmtInt(leadsTotal || null)}</Text>
        </View>
        <View style={styles.consolidadoItem}>
          <Text style={styles.consolidadoLabel}>CONSULTAS</Text>
          <Text style={styles.consolidadoValor}>{fmtInt(consTotal || null)}</Text>
        </View>
      </View>

      <Text
        style={styles.numPag}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        fixed
      />
    </Page>
  )
}

function PaginaResumo({ cliente, historico }: { cliente: Cliente; historico: Meta[] }) {
  // Totais acumulados sobre RESULTADO
  const totais = historico.reduce(
    (acc, m) => {
      const r = normalize(m.resultado_data)
      const invG = r.google.investimento ?? 0
      const invM = r.meta.investimento ?? 0
      const fatG = faturamento(r.google)
      const fatM = faturamento(r.meta)
      acc.investimento += invG + invM
      acc.faturamento += fatG + fatM
      acc.leads += (r.google.mensagens_qualificadas ?? 0) + (r.meta.mensagens_qualificadas ?? 0)
      acc.consultas += (r.google.numero_consultas ?? 0) + (r.meta.numero_consultas ?? 0)
      acc.vendas +=
        (r.google.numero_procedimentos ?? 0) + (r.meta.numero_procedimentos ?? 0)
      return acc
    },
    { investimento: 0, faturamento: 0, leads: 0, consultas: 0, vendas: 0 },
  )

  const roasAcumulado =
    totais.investimento > 0 && totais.faturamento > 0
      ? totais.faturamento / totais.investimento
      : null
  const nMeses = historico.length
  const cac =
    totais.investimento > 0 && totais.consultas > 0
      ? totais.investimento / totais.consultas
      : null

  // Historico ordenado do mais antigo pro mais recente pra tabela
  const histAsc = [...historico].sort((a, b) => a.mes_ano.localeCompare(b.mes_ano))

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerClienteBlock}>
          <Text style={styles.headerCliente}>{cliente.nome}</Text>
          <Text style={styles.headerCompetencia}>RESUMO DO PERÍODO</Text>
        </View>
        <Image src={LOGO_URL} style={styles.headerLogo} />
      </View>

      <Text style={styles.resumoTitulo}>Resumo consolidado</Text>
      <Text style={styles.resumoSubtitulo}>
        {nMeses} {nMeses === 1 ? 'mês' : 'meses'} · {fmtCompetenciaCurta(histAsc[0]?.mes_ano ?? '')}{' '}
        até {fmtCompetenciaCurta(histAsc[histAsc.length - 1]?.mes_ano ?? '')}
      </Text>

      <View style={styles.resumoGrid}>
        <View style={styles.resumoBox}>
          <Text style={styles.resumoBoxLabel}>INVESTIMENTO TOTAL</Text>
          <Text style={styles.resumoBoxValor}>{fmtBRL(totais.investimento || null)}</Text>
          <Text style={styles.resumoBoxSub}>
            média {fmtBRL(nMeses > 0 ? totais.investimento / nMeses : null)} / mês
          </Text>
        </View>
        <View style={styles.resumoBox}>
          <Text style={styles.resumoBoxLabel}>FATURAMENTO TOTAL</Text>
          <Text style={styles.resumoBoxValor}>{fmtBRL(totais.faturamento || null)}</Text>
          <Text style={styles.resumoBoxSub}>
            média {fmtBRL(nMeses > 0 ? totais.faturamento / nMeses : null)} / mês
          </Text>
        </View>
        <View style={styles.resumoBox}>
          <Text style={styles.resumoBoxLabel}>ROAS ACUMULADO</Text>
          <Text style={styles.resumoBoxValor}>{fmtRoas(roasAcumulado)}</Text>
          <Text style={styles.resumoBoxSub}>faturamento ÷ investimento</Text>
        </View>
        <View style={styles.resumoBox}>
          <Text style={styles.resumoBoxLabel}>CAC MÉDIO</Text>
          <Text style={styles.resumoBoxValor}>{fmtBRL(cac)}</Text>
          <Text style={styles.resumoBoxSub}>custo por consulta</Text>
        </View>
        <View style={styles.resumoBox}>
          <Text style={styles.resumoBoxLabel}>LEADS TOTAIS</Text>
          <Text style={styles.resumoBoxValor}>{fmtInt(totais.leads || null)}</Text>
          <Text style={styles.resumoBoxSub}>mensagens qualificadas</Text>
        </View>
        <View style={styles.resumoBox}>
          <Text style={styles.resumoBoxLabel}>CONSULTAS TOTAIS</Text>
          <Text style={styles.resumoBoxValor}>{fmtInt(totais.consultas || null)}</Text>
          <Text style={styles.resumoBoxSub}>
            {totais.vendas > 0 && `${fmtInt(totais.vendas)} procedimentos`}
          </Text>
        </View>
      </View>

      {/* Tabela historica (todos os meses de uma vez) */}
      <View style={styles.histTable}>
        <View style={styles.histHead}>
          <Text style={[styles.histTh, { flex: 1.2 }]}>COMPETÊNCIA</Text>
          <Text style={[styles.histTh, { flex: 1.5, textAlign: 'right' }]}>INVESTIMENTO</Text>
          <Text style={[styles.histTh, { flex: 1.5, textAlign: 'right' }]}>FATURAMENTO</Text>
          <Text style={[styles.histTh, { flex: 0.8, textAlign: 'center' }]}>ROAS</Text>
          <Text style={[styles.histTh, { flex: 0.8, textAlign: 'right' }]}>LEADS</Text>
          <Text style={[styles.histTh, { flex: 0.8, textAlign: 'right' }]}>CONSULTAS</Text>
        </View>
        {histAsc.map((m) => {
          const r = normalize(m.resultado_data)
          const inv = (r.google.investimento ?? 0) + (r.meta.investimento ?? 0)
          const fat = faturamento(r.google) + faturamento(r.meta)
          const roasMes = inv > 0 && fat > 0 ? fat / inv : null
          const leads =
            (r.google.mensagens_qualificadas ?? 0) + (r.meta.mensagens_qualificadas ?? 0)
          const cons = (r.google.numero_consultas ?? 0) + (r.meta.numero_consultas ?? 0)
          return (
            <View key={m.id} style={styles.histRow}>
              <Text style={[styles.histTd, { flex: 1.2 }]}>{fmtCompetenciaCurta(m.mes_ano)}</Text>
              <Text style={[styles.histTd, { flex: 1.5, textAlign: 'right' }]}>
                {fmtBRL(inv || null)}
              </Text>
              <Text style={[styles.histTd, { flex: 1.5, textAlign: 'right' }]}>
                {fmtBRL(fat || null)}
              </Text>
              <Text style={[styles.histTd, { flex: 0.8, textAlign: 'center' }]}>
                {fmtRoas(roasMes)}
              </Text>
              <Text style={[styles.histTd, { flex: 0.8, textAlign: 'right' }]}>
                {fmtInt(leads || null)}
              </Text>
              <Text style={[styles.histTd, { flex: 0.8, textAlign: 'right' }]}>
                {fmtInt(cons || null)}
              </Text>
            </View>
          )
        })}
      </View>

      <Text
        style={styles.numPag}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        fixed
      />
    </Page>
  )
}

// ==============================================================
// Documento
// ==============================================================

function RelatorioMetasDoc({ cliente, historico }: Props) {
  // Ordena do mais antigo pro mais recente pra ficar cronologico
  const asc = [...historico].sort((a, b) => a.mes_ano.localeCompare(b.mes_ano))
  const primeiro = asc[0]
  const ultimo = asc[asc.length - 1]
  const dataGeracao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Document>
      {/* Capa */}
      <Page size="A4" style={styles.capaPage}>
        <View style={styles.capa}>
          <Image src={LOGO_URL} style={{ width: 180, height: 60, objectFit: 'contain', marginBottom: 40 }} />
          <Text style={styles.capaTitle}>RELATÓRIO{'\n'}DE METAS</Text>
          <Text style={styles.capaSub}>{cliente.nome}</Text>
          {primeiro && ultimo && (
            <Text style={styles.capaPeriodo}>
              {fmtCompetencia(primeiro.mes_ano)}
              {primeiro !== ultimo && ` a ${fmtCompetencia(ultimo.mes_ano)}`}
            </Text>
          )}
        </View>
        <View style={styles.rodapeCapa}>
          <Image src={LOGO_URL} style={styles.rodapeCapaLogo} />
          <Text style={styles.rodapeCapaTexto}>Gerado em {dataGeracao}</Text>
        </View>
      </Page>

      {/* Uma pagina por mes */}
      {asc.map((m) => (
        <PaginaMensal key={m.id} cliente={cliente} meta={m} />
      ))}

      {/* Resumo final — so faz sentido se tem 2+ meses */}
      {asc.length >= 2 && <PaginaResumo cliente={cliente} historico={asc} />}
    </Document>
  )
}

// ==============================================================
// Trigger de download
// ==============================================================

export async function downloadRelatorioMetasPDF({ cliente, historico }: Props): Promise<void> {
  if (historico.length === 0) {
    alert('Não há metas registradas pra esse cliente ainda.')
    return
  }
  const blob = await pdf(
    <RelatorioMetasDoc cliente={cliente} historico={historico} />,
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Relatorio de Metas - ${cliente.nome}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

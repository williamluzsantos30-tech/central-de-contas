/**
 * PDF estruturado do Planejamento de Tráfego.
 * Inspirado no deck do AlcanSee — cards, ícones em círculos coloridos,
 * seções por campanha — mas com paleta MovMed (laranja + preto + branco).
 *
 * Páginas:
 *   1. Capa
 *   2. Diagnóstico Estratégico (Pontos Fortes / Oportunidades / Desafios)
 *   3..N. Uma página por Campanha
 *   N+1. Estratégias adicionais (se houver)
 *   Final. Assinatura MovMed
 */
import { Document, Image, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer'
import type { Cliente, Criacao, PlanejamentoEstrutura } from '@/types/database'

const LOGO_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/logo-movmed.png`

Font.registerHyphenationCallback((word) => {
  if (word.length <= 30) return [word]
  return word.match(/.{1,30}/g) ?? [word]
})

// Paleta MovMed
const COR_LARANJA = '#f97316'
const COR_LARANJA_CLARO = '#fed7aa'
const COR_LARANJA_BG = '#fff7ed'
const COR_LARANJA_ESCURO = '#c2410c'
const COR_PRETO = '#0a0a0a'
const COR_BRANCO = '#ffffff'
const COR_TEXTO = '#0a0a0a'
const COR_TEXTO_CINZA = '#525252'
const COR_TEXTO_CINZA_CLARO = '#737373'
const COR_BORDA = '#e5e5e5'
const COR_VERDE = '#16a34a'
const COR_AMBAR = '#d97706'
const COR_VERMELHO = '#dc2626'
const COR_AZUL = '#2563eb'

// Tamanhos reservados pra header/footer fixos (Page usa como padding)
const HEADER_H = 96
const FOOTER_H = 32

const s = StyleSheet.create({
  // ============ CAPA ============
  capaPage: { backgroundColor: COR_LARANJA, fontFamily: 'Helvetica' },
  capa: {
    flex: 1,
    backgroundColor: COR_LARANJA,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  capaTipo: {
    fontSize: 12,
    color: COR_BRANCO,
    letterSpacing: 6,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 18,
    opacity: 0.9,
  },
  capaTitulo: {
    fontSize: 44,
    fontFamily: 'Helvetica-Bold',
    color: COR_BRANCO,
    letterSpacing: 1,
    lineHeight: 1.05,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  capaDivisor: { width: 60, height: 2, backgroundColor: COR_BRANCO, marginTop: 28 },
  capaCliente: {
    marginTop: 24,
    fontSize: 22,
    color: COR_BRANCO,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  capaNicho: {
    marginTop: 8,
    fontSize: 14,
    color: COR_BRANCO,
    textAlign: 'center',
    opacity: 0.9,
  },
  capaAgencia: {
    marginTop: 40,
    fontSize: 10,
    color: COR_BRANCO,
    textAlign: 'center',
    opacity: 0.85,
    letterSpacing: 2,
  },
  rodapeCapa: {
    height: 56,
    backgroundColor: COR_PRETO,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  rodapeLogo: { width: 90, height: 30, objectFit: 'contain' },
  rodapeTexto: {
    fontSize: 9,
    color: COR_BRANCO,
    letterSpacing: 2.5,
    fontFamily: 'Helvetica-Bold',
    opacity: 0.9,
  },

  // ============ PÁGINAS INTERNAS ============
  // Page já reserva espaço com paddingTop/paddingBottom — fixed header/footer
  // são posicionados absoluto em cima desse padding.
  page: {
    backgroundColor: COR_BRANCO,
    fontFamily: 'Helvetica',
    paddingTop: HEADER_H,
    paddingBottom: FOOTER_H,
  },
  pageHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_H,
    backgroundColor: COR_PRETO,
    paddingHorizontal: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  pageHeaderBolha: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COR_LARANJA,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageHeaderBolhaTexto: {
    fontSize: 22,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
  },
  pageHeaderTextos: { flex: 1, justifyContent: 'center' },
  pageHeaderTitulo: {
    fontSize: 22,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  pageHeaderSubtitulo: {
    marginTop: 3,
    fontSize: 11,
    color: COR_LARANJA_CLARO,
    fontFamily: 'Helvetica',
  },
  pageBody: { paddingHorizontal: 40, paddingTop: 30, paddingBottom: 16 },

  // ============ CARDS ============
  card: {
    backgroundColor: COR_BRANCO,
    borderWidth: 1,
    borderColor: COR_BORDA,
    borderRadius: 10,
    padding: 18,
    marginBottom: 12,
  },
  cardTitulo: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: COR_PRETO,
    marginBottom: 10,
  },
  // gap não é confiável no react-pdf — usamos marginBottom + marginRight explícitos
  cardItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardBolhinha: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COR_LARANJA,
    marginTop: 5,
    marginRight: 8,
  },
  cardItemTexto: { fontSize: 10.5, color: COR_TEXTO, lineHeight: 1.5, flexShrink: 1 },
  // Sem flex: 1 — em react-pdf, Text com flex:1 dentro de column flex pode
  // ser clipado em alguns cenários. Texto bloco simples flui melhor sem flex.
  cardItemTextoNeutro: { fontSize: 10.5, color: COR_TEXTO, lineHeight: 1.5 },

  // Grid de 2 colunas
  grid2: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },

  // Card destacado (com cor de fundo suave)
  cardDestaque: {
    backgroundColor: COR_LARANJA_BG,
    borderWidth: 1,
    borderColor: COR_LARANJA_CLARO,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  cardDestaqueTitulo: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: COR_LARANJA_ESCURO,
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  // Headings de seção dentro do body
  secaoTitulo: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: COR_TEXTO_CINZA,
    letterSpacing: 2,
    marginBottom: 10,
  },

  // Footer
  pageFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FOOTER_H,
    backgroundColor: COR_PRETO,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  pageFooterTexto: {
    fontSize: 8,
    color: COR_BRANCO,
    letterSpacing: 1.5,
    opacity: 0.7,
  },

  // Diagnóstico — cards com acento colorido na borda esquerda.
  // Sem flex: 1 aqui (causa cramming quando o card é standalone fora de row).
  // Pra usar lado-a-lado, aplicar flex: 1 inline na hora de renderizar.
  diagCard: {
    borderWidth: 1,
    borderColor: COR_BORDA,
    borderLeftWidth: 4,
    borderRadius: 3,
    backgroundColor: COR_BRANCO,
    padding: 14,
  },
  diagTitulo: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    letterSpacing: 0.3,
  },

  // Estratégia — numero grande na lateral
  estrategiaWrap: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COR_BORDA,
    borderRadius: 10,
    padding: 16,
  },
  estrategiaNumero: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COR_LARANJA,
    justifyContent: 'center',
    alignItems: 'center',
  },
  estrategiaNumeroTexto: {
    fontSize: 16,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
  },
  estrategiaConteudo: { flex: 1 },
  estrategiaTitulo: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: COR_PRETO,
    marginBottom: 4,
  },
  estrategiaDescricao: {
    fontSize: 10.5,
    color: COR_TEXTO_CINZA,
    lineHeight: 1.45,
    marginBottom: 6,
  },
})

interface Props {
  cliente: Cliente
  criacao: Criacao
}

// =========================================================
// Helpers de render
// =========================================================

function Bullet({ children, color }: { children: React.ReactNode; color?: string }) {
  // Wrapper externo com paddingBottom — margin em filhos de flex/wrap=false
  // às vezes não é respeitado no react-pdf, padding é mais confiável.
  return (
    <View style={{ paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color ?? COR_LARANJA,
            marginTop: 5,
            marginRight: 8,
          }}
        />
        <Text style={{ fontSize: 10.5, color: COR_TEXTO, lineHeight: 1.5, flexShrink: 1 }}>
          {children}
        </Text>
      </View>
    </View>
  )
}

// =========================================================
// Capa
// =========================================================

function CapaPDF({ cliente, criacao }: Props) {
  return (
    <Page size="A4" orientation="portrait" style={s.capaPage}>
      <View style={s.capa}>
        <Text style={s.capaTipo}>PLANEJAMENTO DE TRÁFEGO</Text>
        <Text style={s.capaTitulo}>{criacao.titulo}</Text>
        <View style={s.capaDivisor} />
        <Text style={s.capaCliente}>{cliente.nome}</Text>
        {cliente.nicho && <Text style={s.capaNicho}>{cliente.nicho}</Text>}
        <Text style={s.capaAgencia}>PREPARADO POR MOVMED</Text>
      </View>
      <View style={s.rodapeCapa}>
        <Image src={LOGO_URL} style={s.rodapeLogo} />
        <Text style={s.rodapeTexto}>MOVMED · CENTRAL DE CONTAS</Text>
      </View>
    </Page>
  )
}

// =========================================================
// Página: Introdução do planejamento (texto livre + pilares)
// =========================================================

function PaginaIntroducao({
  cliente,
  estrutura,
}: {
  cliente: Cliente
  estrutura: PlanejamentoEstrutura
}) {
  const temIntroducao = estrutura.introducao && estrutura.introducao.trim().length > 0
  const temPilares = (estrutura.pilares ?? []).length > 0
  if (!temIntroducao && !temPilares) return null

  return (
    <Page size="A4" orientation="portrait" style={s.page}>
      <View style={s.pageHeader} fixed>
        <View style={s.pageHeaderBolha}>
          <Text style={s.pageHeaderBolhaTexto}>00</Text>
        </View>
        <View style={s.pageHeaderTextos}>
          <Text style={s.pageHeaderTitulo}>Introdução</Text>
          <Text style={s.pageHeaderSubtitulo}>
            Como vamos atuar · {cliente.nome}
          </Text>
        </View>
      </View>

      <View style={s.pageBody}>
        {temIntroducao && (
          <View style={s.cardDestaque}>
            <Text style={s.cardDestaqueTitulo}>VISÃO DO PLANEJAMENTO</Text>
            <Text style={s.cardItemTextoNeutro}>{estrutura.introducao}</Text>
          </View>
        )}

        {temPilares && (
          <View style={[s.card, { marginTop: 14 }]}>
            <Text style={s.cardTitulo}>Pilares estratégicos</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
              {(estrutura.pilares ?? []).map((p, i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: COR_LARANJA_BG,
                    borderWidth: 1,
                    borderColor: COR_LARANJA_CLARO,
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    marginRight: 6,
                    marginBottom: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      color: COR_LARANJA_ESCURO,
                      fontFamily: 'Helvetica-Bold',
                    }}
                  >
                    {p}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={s.pageFooter} fixed>
        <Text style={s.pageFooterTexto}>MOVMED · PLANEJAMENTO DE TRÁFEGO</Text>
        <Text
          style={s.pageFooterTexto}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </View>
    </Page>
  )
}

// =========================================================
// Página: Diagnóstico Estratégico
// =========================================================

function PaginaDiagnostico({
  cliente,
  diagnostico,
}: {
  cliente: Cliente
  diagnostico: PlanejamentoEstrutura['diagnostico']
}) {
  const temAlgo =
    diagnostico.pontos_fortes.length > 0 ||
    diagnostico.oportunidades.length > 0 ||
    diagnostico.desafios.length > 0
  if (!temAlgo) return null

  return (
    <Page size="A4" orientation="portrait" style={s.page}>
      <View style={s.pageHeader} fixed>
        <View style={s.pageHeaderBolha}>
          <Text style={s.pageHeaderBolhaTexto}>01</Text>
        </View>
        <View style={s.pageHeaderTextos}>
          <Text style={s.pageHeaderTitulo}>Diagnóstico Estratégico</Text>
          <Text style={s.pageHeaderSubtitulo}>Análise completa do negócio · {cliente.nome}</Text>
        </View>
      </View>

      <View style={s.pageBody}>
        <View style={[s.grid2, { marginBottom: 12 }]}>
          {diagnostico.pontos_fortes.length > 0 && (
            <View style={[s.diagCard, { borderLeftColor: COR_VERDE, flex: 1 }]}>
              <Text style={[s.diagTitulo, { color: COR_VERDE }]}>Pontos Fortes</Text>
              {diagnostico.pontos_fortes.map((p, i) => (
                <Bullet key={i} color={COR_VERDE}>{p}</Bullet>
              ))}
            </View>
          )}
          {diagnostico.oportunidades.length > 0 && (
            <View style={[s.diagCard, { borderLeftColor: COR_LARANJA, flex: 1 }]}>
              <Text style={[s.diagTitulo, { color: COR_LARANJA_ESCURO }]}>Oportunidades</Text>
              {diagnostico.oportunidades.map((o, i) => (
                <Bullet key={i} color={COR_LARANJA}>{o}</Bullet>
              ))}
            </View>
          )}
        </View>

        {diagnostico.desafios.length > 0 && (
          <View style={[s.diagCard, { borderLeftColor: COR_VERMELHO }]}>
            <Text style={[s.diagTitulo, { color: COR_VERMELHO }]}>Desafios</Text>
            {diagnostico.desafios.map((d, i) => (
              <Bullet key={i} color={COR_VERMELHO}>{d}</Bullet>
            ))}
          </View>
        )}
      </View>

      <View style={s.pageFooter} fixed>
        <Text style={s.pageFooterTexto}>MOVMED · PLANEJAMENTO DE TRÁFEGO</Text>
        <Text
          style={s.pageFooterTexto}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </View>
    </Page>
  )
}

// =========================================================
// Página: Campanha (uma por campanha)
// =========================================================

function PaginaCampanha({
  cliente,
  campanha,
  index,
}: {
  cliente: Cliente
  campanha: PlanejamentoEstrutura['campanhas'][number]
  index: number
}) {
  return (
    <Page size="A4" orientation="portrait" style={s.page}>
      <View style={s.pageHeader} fixed>
        <View style={s.pageHeaderBolha}>
          <Text style={s.pageHeaderBolhaTexto}>{index + 1}</Text>
        </View>
        <View style={s.pageHeaderTextos}>
          <Text style={s.pageHeaderTitulo}>{campanha.titulo}</Text>
          {campanha.subtitulo && (
            <Text style={s.pageHeaderSubtitulo}>{campanha.subtitulo}</Text>
          )}
        </View>
      </View>

      <View style={s.pageBody}>
        <View style={s.grid2}>
          {/* Coluna 1: Objetivo + Público */}
          <View style={s.col}>
            {campanha.objetivo && (
              <View style={s.card}>
                <Text style={s.cardTitulo}>Objetivo</Text>
                <Text style={s.cardItemTextoNeutro}>{campanha.objetivo}</Text>
              </View>
            )}
            {campanha.publico && (
              <View style={s.cardDestaque}>
                <Text style={s.cardDestaqueTitulo}>PÚBLICO ESTRATÉGICO</Text>
                <Text style={s.cardItemTextoNeutro}>{campanha.publico}</Text>
              </View>
            )}
          </View>

          {/* Coluna 2: Criativos + Formatos */}
          <View style={s.col}>
            {campanha.criativos.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitulo}>Criativos Indicados</Text>
                {campanha.criativos.map((c, i) => (
                  <Bullet key={i}>{c}</Bullet>
                ))}
              </View>
            )}
            {campanha.formatos.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitulo}>Formatos Ideais</Text>
                {campanha.formatos.map((f, i) => (
                  <Bullet key={i}>{f}</Bullet>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={s.pageFooter} fixed>
        <Text style={s.pageFooterTexto}>
          {cliente.nome.toUpperCase()} · CAMPANHA {index + 1}
        </Text>
        <Text
          style={s.pageFooterTexto}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </View>
    </Page>
  )
}

// =========================================================
// Página: Estratégias adicionais
// =========================================================

function PaginaEstrategias({
  cliente,
  estrategias,
}: {
  cliente: Cliente
  estrategias: PlanejamentoEstrutura['estrategias']
}) {
  if (estrategias.length === 0) return null
  return (
    <Page size="A4" orientation="portrait" style={s.page}>
      <View style={s.pageHeader} fixed>
        <View style={s.pageHeaderBolha}>
          <Text style={s.pageHeaderBolhaTexto}>+</Text>
        </View>
        <View style={s.pageHeaderTextos}>
          <Text style={s.pageHeaderTitulo}>Estratégias Fortes</Text>
          <Text style={s.pageHeaderSubtitulo}>Diferenciais competitivos · {cliente.nome}</Text>
        </View>
      </View>

      <View style={s.pageBody}>
        {estrategias.map((e, i) => (
          <View key={i} style={s.estrategiaWrap} wrap={false}>
            <View style={s.estrategiaNumero}>
              <Text style={s.estrategiaNumeroTexto}>{i + 1}</Text>
            </View>
            <View style={s.estrategiaConteudo}>
              <Text style={s.estrategiaTitulo}>{e.titulo}</Text>
              {e.descricao && <Text style={s.estrategiaDescricao}>{e.descricao}</Text>}
              {e.bullets.length > 0 && (
                <View style={{ marginTop: 4 }}>
                  {e.bullets.map((b, idx) => (
                    <Bullet key={idx}>{b}</Bullet>
                  ))}
                </View>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={s.pageFooter} fixed>
        <Text style={s.pageFooterTexto}>{cliente.nome.toUpperCase()} · ESTRATÉGIAS</Text>
        <Text
          style={s.pageFooterTexto}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </View>
    </Page>
  )
}

// =========================================================
// Documento principal
// =========================================================

export function PlanejamentoTrafegoPDFDoc({ cliente, criacao }: Props) {
  const estrutura: PlanejamentoEstrutura = criacao.planejamento_estrutura ?? {
    introducao: '',
    pilares: [],
    diagnostico: { pontos_fortes: [], oportunidades: [], desafios: [] },
    campanhas: [],
    estrategias: [],
  }

  return (
    <Document title={`Planejamento de Tráfego — ${criacao.titulo}`}>
      <CapaPDF cliente={cliente} criacao={criacao} />
      <PaginaIntroducao cliente={cliente} estrutura={estrutura} />
      <PaginaDiagnostico cliente={cliente} diagnostico={estrutura.diagnostico} />
      {estrutura.campanhas.map((c, i) => (
        <PaginaCampanha key={i} cliente={cliente} campanha={c} index={i} />
      ))}
      <PaginaEstrategias cliente={cliente} estrategias={estrutura.estrategias} />
    </Document>
  )
}

/** Dispara o download do PDF no browser. */
export async function downloadPlanejamentoTrafegoPDF({ cliente, criacao }: Props): Promise<void> {
  const blob = await pdf(
    <PlanejamentoTrafegoPDFDoc cliente={cliente} criacao={criacao} />,
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const tituloSlug = criacao.titulo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  a.download = `planejamento-${cliente.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${tituloSlug || 'sem-titulo'}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

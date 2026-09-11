/**
 * PDF do Planejamento de Tráfego — Modelo A (por canal/plataforma).
 * Design editorial / magazine: capa impactante, headers grandes com
 * número da seção, cards com personalidade visual, KPIs em destaque.
 * Paleta MovMed (laranja + preto + branco).
 */
import { Document, Image, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer'
import type { Cliente, Criacao, PlanejamentoEstrutura } from '@/types/database'

const LOGO_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/logo.png`

Font.registerHyphenationCallback((word) => {
  if (word.length <= 30) return [word]
  return word.match(/.{1,30}/g) ?? [word]
})

// Paleta MovMed expandida
const COR_LARANJA = '#f97316'
const COR_LARANJA_VIVO = '#ea580c'
const COR_LARANJA_CLARO = '#fed7aa'
const COR_LARANJA_BG = '#fff7ed'
const COR_LARANJA_ESCURO = '#c2410c'
const COR_LARANJA_PROFUNDO = '#9a3412'
const COR_PRETO = '#0a0a0a'
const COR_PRETO_SUAVE = '#1a1a1a'
const COR_BRANCO = '#ffffff'
const COR_TEXTO = '#0a0a0a'
const COR_TEXTO_CINZA = '#4b5563'
const COR_TEXTO_CINZA_CLARO = '#6b7280'
const COR_BORDA = '#e5e7eb'
const COR_BORDA_SUAVE = '#f3f4f6'

// Reservas verticais pra header/footer absolute
const HEADER_H = 130
const FOOTER_H = 36

const s = StyleSheet.create({
  // ==================================================
  // CAPA — magazine cover style
  // ==================================================
  capaPage: {
    backgroundColor: COR_LARANJA,
    fontFamily: 'Helvetica',
  },
  // Faixa preta no topo
  capaTopo: {
    height: 70,
    backgroundColor: COR_PRETO,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  capaTopoLogo: { width: 96, height: 32, objectFit: 'contain' },
  capaTopoBadge: {
    fontSize: 9,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 3,
  },
  // Corpo da capa
  capaCorpo: {
    flex: 1,
    padding: 56,
    justifyContent: 'space-between',
  },
  capaCorpoTop: {},
  capaEyebrow: {
    fontSize: 10,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 6,
    marginBottom: 24,
    opacity: 0.85,
  },
  capaTituloPrimario: {
    fontSize: 58,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.0,
    letterSpacing: -1,
  },
  capaTituloSecundario: {
    fontSize: 58,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.0,
    letterSpacing: -1,
    opacity: 0.55,
  },
  // Linha vertical decorativa
  capaLinhaVertical: {
    position: 'absolute',
    left: 56,
    top: 200,
    bottom: 200,
    width: 2,
    backgroundColor: COR_BRANCO,
    opacity: 0.4,
  },
  capaCorpoMid: {
    paddingLeft: 24,
    borderLeftWidth: 3,
    borderLeftColor: COR_BRANCO,
    marginVertical: 50,
  },
  capaCorpoMidLabel: {
    fontSize: 9,
    color: COR_BRANCO,
    letterSpacing: 4,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    opacity: 0.7,
  },
  capaCliente: {
    fontSize: 28,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -0.5,
  },
  capaNicho: {
    marginTop: 6,
    fontSize: 14,
    color: COR_BRANCO,
    fontFamily: 'Helvetica',
    opacity: 0.85,
  },
  capaMes: {
    marginTop: 14,
    fontSize: 13,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
  },
  capaCorpoBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  capaAssinatura: {
    fontSize: 9,
    color: COR_BRANCO,
    letterSpacing: 3,
    fontFamily: 'Helvetica-Bold',
    opacity: 0.85,
  },
  capaAnoBig: {
    fontSize: 80,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1,
    letterSpacing: -3,
    opacity: 0.25,
  },
  // Rodapé da capa
  rodapeCapa: {
    height: 50,
    backgroundColor: COR_PRETO,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  rodapeCapaTexto: {
    fontSize: 8,
    color: COR_BRANCO,
    letterSpacing: 2.5,
    fontFamily: 'Helvetica-Bold',
    opacity: 0.85,
  },

  // ==================================================
  // SECTION DIVIDER (mini-página entre seções)
  // ==================================================
  dividerPage: {
    backgroundColor: COR_PRETO,
    fontFamily: 'Helvetica',
  },
  dividerCorpo: {
    flex: 1,
    padding: 56,
    justifyContent: 'center',
  },
  dividerNumero: {
    fontSize: 180,
    color: COR_LARANJA,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1,
    letterSpacing: -8,
    opacity: 0.95,
  },
  dividerLabel: {
    marginTop: -10,
    fontSize: 10,
    color: COR_BRANCO,
    letterSpacing: 5,
    fontFamily: 'Helvetica-Bold',
    opacity: 0.6,
  },
  dividerTitulo: {
    marginTop: 16,
    fontSize: 44,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.05,
    letterSpacing: -1,
  },
  dividerSubtitulo: {
    marginTop: 12,
    fontSize: 14,
    color: COR_LARANJA_CLARO,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
    maxWidth: 380,
  },
  // Marca lateral direita: indicador de progresso
  dividerProgress: {
    position: 'absolute',
    right: 56,
    top: 56,
    fontSize: 10,
    color: COR_BRANCO,
    letterSpacing: 3,
    fontFamily: 'Helvetica-Bold',
    opacity: 0.5,
  },

  // ==================================================
  // PÁGINAS DE CONTEÚDO
  // ==================================================
  page: {
    backgroundColor: COR_BRANCO,
    fontFamily: 'Helvetica',
    paddingTop: HEADER_H,
    paddingBottom: FOOTER_H,
  },
  // Header colorido com banner + número grande
  pageHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_H,
    backgroundColor: COR_LARANJA,
    paddingHorizontal: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageHeaderEsq: { flex: 1 },
  pageHeaderEyebrow: {
    fontSize: 9,
    color: COR_BRANCO,
    letterSpacing: 4,
    fontFamily: 'Helvetica-Bold',
    opacity: 0.85,
    marginBottom: 6,
  },
  pageHeaderTitulo: {
    fontSize: 32,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -0.5,
    lineHeight: 1.05,
  },
  pageHeaderNumero: {
    fontSize: 64,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1,
    letterSpacing: -3,
    opacity: 0.35,
  },
  pageBody: { paddingHorizontal: 44, paddingTop: 36, paddingBottom: 24 },

  // Subseção dentro da página
  subHeader: {
    fontSize: 10,
    color: COR_LARANJA_ESCURO,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2.5,
    marginBottom: 14,
    marginTop: 8,
  },

  // Cards básicos
  card: {
    borderWidth: 1,
    borderColor: COR_BORDA,
    borderRadius: 10,
    padding: 18,
    marginBottom: 14,
    backgroundColor: COR_BRANCO,
  },
  cardDestaque: {
    backgroundColor: COR_LARANJA_BG,
    borderLeftWidth: 4,
    borderLeftColor: COR_LARANJA,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: COR_LARANJA_CLARO,
    borderRadius: 6,
    padding: 18,
    marginBottom: 14,
  },
  cardPreto: {
    backgroundColor: COR_PRETO,
    borderRadius: 10,
    padding: 20,
    marginBottom: 14,
  },
  cardLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: COR_LARANJA_ESCURO,
    letterSpacing: 2.5,
    marginBottom: 8,
  },
  cardLabelEscuro: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: COR_LARANJA_CLARO,
    letterSpacing: 2.5,
    marginBottom: 8,
  },
  cardTitulo: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: COR_PRETO,
    lineHeight: 1.2,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  cardTituloBranco: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: COR_BRANCO,
    lineHeight: 1.2,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  cardTexto: {
    fontSize: 11,
    color: COR_TEXTO,
    lineHeight: 1.6,
  },
  cardTextoBranco: {
    fontSize: 11,
    color: COR_BRANCO,
    lineHeight: 1.6,
    opacity: 0.92,
  },
  cardValor: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: COR_LARANJA_ESCURO,
    letterSpacing: -1,
    lineHeight: 1,
  },
  cardValorBranco: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    color: COR_LARANJA,
    letterSpacing: -1,
    lineHeight: 1,
  },

  // Grid 2 colunas
  grid2: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  col: { flex: 1 },

  // KPI grid impactante (números bem grandes)
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  kpiCard: {
    flexBasis: '47%',
    minHeight: 130,
    borderRadius: 12,
    padding: 22,
    backgroundColor: COR_BRANCO,
    borderWidth: 1,
    borderColor: COR_BORDA,
    borderLeftWidth: 5,
    borderLeftColor: COR_LARANJA,
  },
  kpiLabel: {
    fontSize: 9,
    color: COR_TEXTO_CINZA,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2.5,
    marginBottom: 16,
  },
  kpiValor: {
    fontSize: 42,
    fontFamily: 'Helvetica-Bold',
    color: COR_LARANJA_ESCURO,
    letterSpacing: -2,
    lineHeight: 1,
  },
  kpiValorSub: {
    fontSize: 10,
    color: COR_TEXTO_CINZA,
    marginTop: 8,
    fontFamily: 'Helvetica',
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
    paddingHorizontal: 44,
  },
  pageFooterEsq: {
    fontSize: 8,
    color: COR_BRANCO,
    letterSpacing: 2.5,
    fontFamily: 'Helvetica-Bold',
    opacity: 0.75,
  },
  pageFooterDir: {
    fontSize: 8,
    color: COR_LARANJA_CLARO,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
  },
})

interface Props {
  cliente: Cliente
  criacao: Criacao
}

// =========================================================
// Helpers
// =========================================================

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ paddingBottom: 7 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: COR_LARANJA,
            marginTop: 6,
            marginRight: 10,
          }}
        />
        <Text
          style={{ flex: 1, fontSize: 11, color: COR_TEXTO, lineHeight: 1.55, fontFamily: 'Helvetica' }}
        >
          {children}
        </Text>
      </View>
    </View>
  )
}

function PageHeader({
  numero,
  eyebrow,
  titulo,
}: {
  numero: string
  eyebrow: string
  titulo: string
}) {
  return (
    <View style={s.pageHeader} fixed>
      <View style={s.pageHeaderEsq}>
        <Text style={s.pageHeaderEyebrow}>{eyebrow}</Text>
        <Text style={s.pageHeaderTitulo}>{titulo}</Text>
      </View>
      <Text style={s.pageHeaderNumero}>{numero}</Text>
    </View>
  )
}

function PageFooter({ contexto, secao }: { contexto: string; secao: string }) {
  return (
    <View style={s.pageFooter} fixed>
      <Text style={s.pageFooterEsq}>{contexto}</Text>
      <Text style={s.pageFooterDir}>{secao}</Text>
      <Text
        style={s.pageFooterEsq}
        render={({ pageNumber, totalPages }) => `${String(pageNumber).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`}
      />
    </View>
  )
}

// =========================================================
// Capa
// =========================================================

function CapaPDF({ cliente, criacao, mes }: Props & { mes?: string }) {
  const ano = mes?.match(/\d{4}/)?.[0] ?? new Date().getFullYear().toString()
  return (
    <Page size="A4" orientation="portrait" style={s.capaPage}>
      <View style={s.capaTopo}>
        <Image src={LOGO_URL} style={s.capaTopoLogo} />
        <Text style={s.capaTopoBadge}>MOVMED · CENTRAL DE CONTAS</Text>
      </View>

      <View style={s.capaCorpo}>
        <View style={s.capaCorpoTop}>
          <Text style={s.capaEyebrow}>PLANEJAMENTO DE TRÁFEGO</Text>
          <Text style={s.capaTituloPrimario}>{criacao.titulo}</Text>
        </View>

        <View style={s.capaCorpoMid}>
          <Text style={s.capaCorpoMidLabel}>CLIENTE</Text>
          <Text style={s.capaCliente}>{cliente.nome}</Text>
          {cliente.nicho && <Text style={s.capaNicho}>{cliente.nicho}</Text>}
          {mes && <Text style={s.capaMes}>{mes.toUpperCase()}</Text>}
        </View>

        <View style={s.capaCorpoBottom}>
          <Text style={s.capaAssinatura}>PREPARADO POR MOVMED</Text>
          <Text style={s.capaAnoBig}>{ano}</Text>
        </View>
      </View>

      <View style={s.rodapeCapa}>
        <Text style={s.rodapeCapaTexto}>ESTRATÉGIA · OPERAÇÃO · RESULTADO</Text>
        <Text style={s.rodapeCapaTexto}>WWW · MOVMED</Text>
      </View>
    </Page>
  )
}

// =========================================================
// Section Divider — mini-página dramática entre seções
// =========================================================

function SectionDivider({
  numero,
  label,
  titulo,
  subtitulo,
  progresso,
}: {
  numero: string
  label: string
  titulo: string
  subtitulo: string
  progresso: string
}) {
  return (
    <Page size="A4" orientation="portrait" style={s.dividerPage}>
      <View style={s.dividerCorpo}>
        <Text style={s.dividerProgress}>{progresso}</Text>
        <Text style={s.dividerNumero}>{numero}</Text>
        <Text style={s.dividerLabel}>{label}</Text>
        <Text style={s.dividerTitulo}>{titulo}</Text>
        <Text style={s.dividerSubtitulo}>{subtitulo}</Text>
      </View>
    </Page>
  )
}

// =========================================================
// Página 01 — Visão Geral
// =========================================================

function PaginaVisaoGeral({
  cliente,
  visao,
}: {
  cliente: Cliente
  visao: NonNullable<PlanejamentoEstrutura['visao_geral']>
}) {
  return (
    <Page size="A4" orientation="portrait" style={s.page}>
      <PageHeader numero="01" eyebrow="O MÊS EM UMA PÁGINA" titulo="Visão Geral" />
      <View style={s.pageBody}>
        {visao.mes && (
          <View style={s.cardDestaque}>
            <Text style={s.cardLabel}>MÊS DE REFERÊNCIA</Text>
            <Text style={[s.cardTitulo, { color: COR_LARANJA_ESCURO, fontSize: 22 }]}>
              {visao.mes}
            </Text>
          </View>
        )}
        {visao.objetivo && (
          <View style={s.card}>
            <Text style={s.cardLabel}>OBJETIVO DO MÊS</Text>
            <Text style={s.cardTexto}>{visao.objetivo}</Text>
          </View>
        )}
        {visao.orcamento_total && (
          <View style={s.cardPreto}>
            <Text style={s.cardLabelEscuro}>ORÇAMENTO TOTAL</Text>
            <Text style={s.cardValorBranco}>{visao.orcamento_total}</Text>
            <Text style={[s.cardTextoBranco, { marginTop: 6, fontSize: 10 }]}>
              Investimento previsto para todo o mês
            </Text>
          </View>
        )}
      </View>
      <PageFooter contexto={cliente.nome.toUpperCase()} secao="VISÃO GERAL" />
    </Page>
  )
}

// =========================================================
// Página 02 — Meta Ads
// =========================================================

function PaginaMetaAds({
  cliente,
  meta,
}: {
  cliente: Cliente
  meta: NonNullable<PlanejamentoEstrutura['meta_ads']>
}) {
  const temConteudo =
    meta.objetivo || meta.publico || (meta.criativos_previstos?.length ?? 0) > 0 || meta.budget
  if (!temConteudo) return null
  return (
    <Page size="A4" orientation="portrait" style={s.page}>
      <PageHeader numero="02" eyebrow="INSTAGRAM + FACEBOOK" titulo="Meta Ads" />
      <View style={s.pageBody}>
        <View style={s.grid2}>
          <View style={s.col}>
            {meta.objetivo && (
              <View style={s.card}>
                <Text style={s.cardLabel}>OBJETIVO</Text>
                <Text style={s.cardTexto}>{meta.objetivo}</Text>
              </View>
            )}
          </View>
          <View style={s.col}>
            {meta.budget && (
              <View style={s.cardPreto}>
                <Text style={s.cardLabelEscuro}>BUDGET</Text>
                <Text style={s.cardValorBranco}>{meta.budget}</Text>
              </View>
            )}
          </View>
        </View>
        {meta.publico && (
          <View style={s.cardDestaque}>
            <Text style={s.cardLabel}>PÚBLICO ESTRATÉGICO</Text>
            <Text style={s.cardTexto}>{meta.publico}</Text>
          </View>
        )}
        {(meta.criativos_previstos?.length ?? 0) > 0 && (
          <View style={s.card}>
            <Text style={s.cardLabel}>CRIATIVOS PREVISTOS</Text>
            {(meta.criativos_previstos ?? []).map((c, i) => (
              <Bullet key={i}>{c}</Bullet>
            ))}
          </View>
        )}
      </View>
      <PageFooter contexto={cliente.nome.toUpperCase()} secao="META ADS" />
    </Page>
  )
}

// =========================================================
// Página 03 — Google Ads
// =========================================================

function PaginaGoogleAds({
  cliente,
  google,
}: {
  cliente: Cliente
  google: NonNullable<PlanejamentoEstrutura['google_ads']>
}) {
  const temConteudo = google.objetivo || google.segmentacao || google.budget
  if (!temConteudo) return null
  return (
    <Page size="A4" orientation="portrait" style={s.page}>
      <PageHeader numero="03" eyebrow="SEARCH ADS" titulo="Google Ads" />
      <View style={s.pageBody}>
        <View style={s.grid2}>
          <View style={s.col}>
            {google.objetivo && (
              <View style={s.card}>
                <Text style={s.cardLabel}>OBJETIVO</Text>
                <Text style={s.cardTexto}>{google.objetivo}</Text>
              </View>
            )}
          </View>
          <View style={s.col}>
            {google.budget && (
              <View style={s.cardPreto}>
                <Text style={s.cardLabelEscuro}>BUDGET</Text>
                <Text style={s.cardValorBranco}>{google.budget}</Text>
              </View>
            )}
          </View>
        </View>
        {google.segmentacao && (
          <View style={s.cardDestaque}>
            <Text style={s.cardLabel}>PALAVRAS-CHAVE / SEGMENTAÇÃO</Text>
            <Text style={s.cardTexto}>{google.segmentacao}</Text>
          </View>
        )}
      </View>
      <PageFooter contexto={cliente.nome.toUpperCase()} secao="GOOGLE ADS" />
    </Page>
  )
}

// =========================================================
// Página 04 — KPIs
// (Orgânico/Conteúdo foi removido — fica no Planejamento Mensal de SM.)
// =========================================================

function PaginaKPIs({
  cliente,
  kpis,
}: {
  cliente: Cliente
  kpis: NonNullable<PlanejamentoEstrutura['kpis']>
}) {
  const temConteudo = kpis.cpl || kpis.ctr || kpis.cpc || kpis.conversoes
  if (!temConteudo) return null

  const items: Array<{ label: string; valor: string; sub: string }> = []
  if (kpis.cpl) items.push({ label: 'CPL ALVO', valor: kpis.cpl, sub: 'Custo por lead' })
  if (kpis.ctr)
    items.push({ label: 'CTR ALVO', valor: kpis.ctr, sub: 'Taxa de cliques nos anúncios' })
  if (kpis.cpc) items.push({ label: 'CPC ALVO', valor: kpis.cpc, sub: 'Custo médio por clique' })
  if (kpis.conversoes)
    items.push({ label: 'CONVERSÕES ESPERADAS', valor: kpis.conversoes, sub: 'Total no mês' })

  return (
    <Page size="A4" orientation="portrait" style={s.page}>
      <PageHeader numero="04" eyebrow="METAS MENSURÁVEIS" titulo="KPIs Alvo" />
      <View style={s.pageBody}>
        <Text style={s.subHeader}>NÚMEROS QUE GUIAM A OPERAÇÃO</Text>
        <View style={s.kpiGrid}>
          {items.map((it, i) => (
            <View key={i} style={s.kpiCard}>
              <Text style={s.kpiLabel}>{it.label}</Text>
              <Text style={s.kpiValor}>{it.valor}</Text>
              <Text style={s.kpiValorSub}>{it.sub}</Text>
            </View>
          ))}
        </View>
      </View>
      <PageFooter contexto={cliente.nome.toUpperCase()} secao="KPIs" />
    </Page>
  )
}

// =========================================================
// Página final — Closing / assinatura
// =========================================================

function PaginaFinal({ cliente }: { cliente: Cliente }) {
  return (
    <Page size="A4" orientation="portrait" style={s.capaPage}>
      <View style={s.capaTopo}>
        <Image src={LOGO_URL} style={s.capaTopoLogo} />
        <Text style={s.capaTopoBadge}>FIM DO PLANEJAMENTO</Text>
      </View>
      <View style={[s.capaCorpo, { justifyContent: 'center' }]}>
        <Text style={[s.capaEyebrow, { textAlign: 'center' }]}>OBRIGADO</Text>
        <Text
          style={[
            s.capaTituloPrimario,
            { textAlign: 'center', fontSize: 48, marginBottom: 24 },
          ]}
        >
          Vamos executar.
        </Text>
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 60,
              height: 2,
              backgroundColor: COR_BRANCO,
              opacity: 0.5,
              marginVertical: 20,
            }}
          />
          <Text
            style={{
              fontSize: 14,
              color: COR_BRANCO,
              opacity: 0.9,
              textAlign: 'center',
              lineHeight: 1.6,
              maxWidth: 380,
            }}
          >
            Planejamento alinhado com a operação de tráfego da{' '}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{cliente.nome}</Text>.
          </Text>
        </View>
      </View>
      <View style={s.rodapeCapa}>
        <Text style={s.rodapeCapaTexto}>MOVMED · CENTRAL DE CONTAS</Text>
        <Text style={s.rodapeCapaTexto}>VAMOS JUNTOS</Text>
      </View>
    </Page>
  )
}

// =========================================================
// Documento principal
// =========================================================

export function PlanejamentoTrafegoPDFDoc({ cliente, criacao }: Props) {
  const estrutura: PlanejamentoEstrutura = criacao.planejamento_estrutura ?? {}

  // Conta seções com conteúdo pra montar o "X de N" nos dividers
  const secoes: Array<{
    numero: string
    label: string
    titulo: string
    subtitulo: string
    render: () => JSX.Element | null
  }> = []

  if (estrutura.visao_geral && hasAnyValue(estrutura.visao_geral)) {
    secoes.push({
      numero: '01',
      label: 'SEÇÃO',
      titulo: 'Visão Geral',
      subtitulo: 'O mês inteiro condensado em uma só página — mês, objetivo e orçamento.',
      render: () => <PaginaVisaoGeral cliente={cliente} visao={estrutura.visao_geral!} />,
    })
  }
  if (estrutura.meta_ads && hasAnyValue(estrutura.meta_ads)) {
    secoes.push({
      numero: '02',
      label: 'SEÇÃO',
      titulo: 'Meta Ads',
      subtitulo: 'Estratégia pro Instagram e Facebook — público, criativos e budget alocado.',
      render: () => <PaginaMetaAds cliente={cliente} meta={estrutura.meta_ads!} />,
    })
  }
  if (estrutura.google_ads && hasAnyValue(estrutura.google_ads)) {
    secoes.push({
      numero: '03',
      label: 'SEÇÃO',
      titulo: 'Google Ads',
      subtitulo: 'Search ads — palavras-chave, intenção de busca e budget alocado.',
      render: () => <PaginaGoogleAds cliente={cliente} google={estrutura.google_ads!} />,
    })
  }
  if (estrutura.kpis && hasAnyValue(estrutura.kpis)) {
    secoes.push({
      numero: '04',
      label: 'SEÇÃO',
      titulo: 'KPIs Alvo',
      subtitulo: 'Métricas que vamos perseguir mês a mês. O que faz dar certo.',
      render: () => <PaginaKPIs cliente={cliente} kpis={estrutura.kpis!} />,
    })
  }

  const total = secoes.length

  return (
    <Document title={`Planejamento de Tráfego — ${criacao.titulo}`}>
      <CapaPDF cliente={cliente} criacao={criacao} mes={estrutura.visao_geral?.mes} />
      {secoes.map((sec, i) => (
        <React.Fragment key={sec.numero}>
          <SectionDivider
            numero={sec.numero}
            label={sec.label}
            titulo={sec.titulo}
            subtitulo={sec.subtitulo}
            progresso={`${String(i + 1).padStart(2, '0')} DE ${String(total).padStart(2, '0')}`}
          />
          {sec.render()}
        </React.Fragment>
      ))}
      <PaginaFinal cliente={cliente} />
    </Document>
  )
}

// React.Fragment requer React em escopo no @react-pdf — importa explicitamente
import React from 'react'

/** True se algum campo do objeto tem valor preenchido (string não vazia ou array não vazio). */
function hasAnyValue(obj: Record<string, unknown>): boolean {
  return Object.values(obj).some((v) => {
    if (typeof v === 'string') return v.trim().length > 0
    if (Array.isArray(v)) return v.length > 0
    return v != null
  })
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

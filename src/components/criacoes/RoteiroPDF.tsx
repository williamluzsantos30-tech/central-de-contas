/**
 * PDF estruturado do Roteiro — Modelo A (3 atos).
 * Capa + 1 página com cards: Setup, Gancho, Desenvolvimento, Fechamento, Trilha.
 * Paleta MovMed.
 */
import { Document, Image, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer'
import type { Cliente, Criacao, RoteiroEstrutura } from '@/types/database'

const LOGO_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/logo.png`

Font.registerHyphenationCallback((word) => {
  if (word.length <= 30) return [word]
  return word.match(/.{1,30}/g) ?? [word]
})

const COR_LARANJA = '#f97316'
const COR_LARANJA_CLARO = '#fed7aa'
const COR_LARANJA_BG = '#fff7ed'
const COR_LARANJA_ESCURO = '#c2410c'
const COR_PRETO = '#0a0a0a'
const COR_BRANCO = '#ffffff'
const COR_TEXTO = '#0a0a0a'
const COR_TEXTO_CINZA = '#525252'
const COR_BORDA = '#e5e5e5'

const HEADER_H = 96
const FOOTER_H = 32

const formatoLabel: Record<NonNullable<RoteiroEstrutura['formato']>, string> = {
  reel: 'Reel (Instagram)',
  carrossel: 'Carrossel',
  tiktok: 'TikTok',
  story: 'Story',
  outro: 'Outro',
}

const s = StyleSheet.create({
  // Capa
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
    fontSize: 40,
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
  capaSub: {
    marginTop: 12,
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

  // Páginas internas
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
    fontSize: 16,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
  },
  pageHeaderTextos: { flex: 1, justifyContent: 'center' },
  pageHeaderTitulo: {
    fontSize: 20,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
  },
  pageHeaderSubtitulo: {
    marginTop: 3,
    fontSize: 11,
    color: COR_LARANJA_CLARO,
  },
  pageBody: { paddingHorizontal: 40, paddingTop: 28, paddingBottom: 16 },

  card: {
    borderWidth: 1,
    borderColor: COR_BORDA,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    backgroundColor: COR_BRANCO,
  },
  cardDestaque: {
    backgroundColor: COR_LARANJA_BG,
    borderWidth: 1,
    borderColor: COR_LARANJA_CLARO,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  cardTitulo: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: COR_LARANJA_ESCURO,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  cardSubtitulo: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: COR_TEXTO_CINZA,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cardTexto: {
    fontSize: 11,
    color: COR_TEXTO,
    lineHeight: 1.6,
  },
  // Card de ato com numeração lateral
  atoWrap: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COR_BORDA,
    borderRadius: 8,
    backgroundColor: COR_BRANCO,
    padding: 16,
  },
  atoNumero: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COR_LARANJA,
    justifyContent: 'center',
    alignItems: 'center',
  },
  atoNumeroTexto: {
    fontSize: 16,
    color: COR_BRANCO,
    fontFamily: 'Helvetica-Bold',
  },
  atoConteudo: { flex: 1 },
  atoTitulo: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: COR_PRETO,
    marginBottom: 2,
  },
  atoSubtitulo: {
    fontSize: 9,
    color: COR_LARANJA_ESCURO,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  miniLabel: {
    fontSize: 8,
    color: COR_TEXTO_CINZA,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.2,
    marginTop: 8,
    marginBottom: 4,
  },

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
})

interface Props {
  cliente: Cliente
  criacao: Criacao
}

function PageFooter({ contexto }: { contexto: string }) {
  return (
    <View style={s.pageFooter} fixed>
      <Text style={s.pageFooterTexto}>{contexto}</Text>
      <Text
        style={s.pageFooterTexto}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  )
}

// Capa
function CapaPDF({ cliente, criacao, formato, duracao }: Props & { formato?: string; duracao?: string }) {
  const sub = [formato, duracao].filter(Boolean).join(' · ')
  return (
    <Page size="A4" orientation="portrait" style={s.capaPage}>
      <View style={s.capa}>
        <Text style={s.capaTipo}>ROTEIRO</Text>
        <Text style={s.capaTitulo}>{criacao.titulo}</Text>
        <View style={s.capaDivisor} />
        <Text style={s.capaCliente}>{cliente.nome}</Text>
        {sub && <Text style={s.capaSub}>{sub}</Text>}
        <Text style={s.capaAgencia}>PREPARADO POR MOVMED</Text>
      </View>
      <View style={s.rodapeCapa}>
        <Image src={LOGO_URL} style={s.rodapeLogo} />
        <Text style={s.rodapeTexto}>MOVMED · CENTRAL DE CONTAS</Text>
      </View>
    </Page>
  )
}

// Página de conteúdo
function PaginaRoteiro({
  cliente,
  estrutura,
}: {
  cliente: Cliente
  estrutura: RoteiroEstrutura
}) {
  return (
    <Page size="A4" orientation="portrait" style={s.page}>
      <View style={s.pageHeader} fixed>
        <View style={s.pageHeaderBolha}>
          <Text style={s.pageHeaderBolhaTexto}>R</Text>
        </View>
        <View style={s.pageHeaderTextos}>
          <Text style={s.pageHeaderTitulo}>Roteiro</Text>
          <Text style={s.pageHeaderSubtitulo}>{cliente.nome}</Text>
        </View>
      </View>

      <View style={s.pageBody}>
        {/* Setup */}
        {(estrutura.formato || estrutura.duracao) && (
          <View style={s.cardDestaque}>
            <Text style={s.cardTitulo}>SETUP</Text>
            <Text style={s.cardSubtitulo}>
              {estrutura.formato ? formatoLabel[estrutura.formato] : ''}
              {estrutura.formato && estrutura.duracao ? ' · ' : ''}
              {estrutura.duracao ?? ''}
            </Text>
          </View>
        )}

        {/* Ato 1 - Gancho */}
        {(estrutura.gancho?.texto || estrutura.gancho?.direcao) && (
          <View style={s.atoWrap} wrap={false}>
            <View style={s.atoNumero}>
              <Text style={s.atoNumeroTexto}>1</Text>
            </View>
            <View style={s.atoConteudo}>
              <Text style={s.atoTitulo}>Gancho</Text>
              <Text style={s.atoSubtitulo}>0–3 SEGUNDOS</Text>
              {estrutura.gancho?.texto && (
                <>
                  <Text style={s.miniLabel}>TEXTO / FALA</Text>
                  <Text style={s.cardTexto}>{estrutura.gancho.texto}</Text>
                </>
              )}
              {estrutura.gancho?.direcao && (
                <>
                  <Text style={s.miniLabel}>DIREÇÃO / VISUAL</Text>
                  <Text style={s.cardTexto}>{estrutura.gancho.direcao}</Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* Ato 2 - Desenvolvimento */}
        {(estrutura.desenvolvimento?.texto || estrutura.desenvolvimento?.acoes) && (
          <View style={s.atoWrap} wrap={false}>
            <View style={s.atoNumero}>
              <Text style={s.atoNumeroTexto}>2</Text>
            </View>
            <View style={s.atoConteudo}>
              <Text style={s.atoTitulo}>Desenvolvimento</Text>
              <Text style={s.atoSubtitulo}>O CORPO DO VÍDEO</Text>
              {estrutura.desenvolvimento?.texto && (
                <>
                  <Text style={s.miniLabel}>TEXTO / FALA</Text>
                  <Text style={s.cardTexto}>{estrutura.desenvolvimento.texto}</Text>
                </>
              )}
              {estrutura.desenvolvimento?.acoes && (
                <>
                  <Text style={s.miniLabel}>AÇÕES / VISUAL</Text>
                  <Text style={s.cardTexto}>{estrutura.desenvolvimento.acoes}</Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* Ato 3 - Fechamento */}
        {(estrutura.fechamento?.texto || estrutura.fechamento?.cta) && (
          <View style={s.atoWrap} wrap={false}>
            <View style={s.atoNumero}>
              <Text style={s.atoNumeroTexto}>3</Text>
            </View>
            <View style={s.atoConteudo}>
              <Text style={s.atoTitulo}>Fechamento</Text>
              <Text style={s.atoSubtitulo}>CHAMADA PRA AÇÃO</Text>
              {estrutura.fechamento?.texto && (
                <>
                  <Text style={s.miniLabel}>TEXTO / FALA</Text>
                  <Text style={s.cardTexto}>{estrutura.fechamento.texto}</Text>
                </>
              )}
              {estrutura.fechamento?.cta && (
                <>
                  <Text style={s.miniLabel}>CTA</Text>
                  <Text style={s.cardTexto}>{estrutura.fechamento.cta}</Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* Trilha */}
        {estrutura.trilha && estrutura.trilha.trim() && (
          <View style={s.card}>
            <Text style={s.cardTitulo}>TRILHA SUGERIDA</Text>
            <Text style={s.cardTexto}>{estrutura.trilha}</Text>
          </View>
        )}
      </View>

      <PageFooter contexto={`${cliente.nome.toUpperCase()} · ROTEIRO`} />
    </Page>
  )
}

// =========================================================
// Documento principal
// =========================================================

export function RoteiroPDFDoc({ cliente, criacao }: Props) {
  const estrutura: RoteiroEstrutura = criacao.roteiro_estrutura ?? {}
  const formato = estrutura.formato ? formatoLabel[estrutura.formato] : undefined
  return (
    <Document title={`Roteiro — ${criacao.titulo}`}>
      <CapaPDF cliente={cliente} criacao={criacao} formato={formato} duracao={estrutura.duracao} />
      <PaginaRoteiro cliente={cliente} estrutura={estrutura} />
    </Document>
  )
}

/** Dispara o download do PDF no browser. */
export async function downloadRoteiroPDF({ cliente, criacao }: Props): Promise<void> {
  const blob = await pdf(<RoteiroPDFDoc cliente={cliente} criacao={criacao} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const tituloSlug = criacao.titulo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  a.download = `roteiro-${cliente.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${tituloSlug || 'sem-titulo'}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

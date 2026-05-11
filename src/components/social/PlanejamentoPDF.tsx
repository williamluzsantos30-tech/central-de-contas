/**
 * Geração do PDF do Planejamento Mensal — paleta MovMed
 * (laranja brand, preto, branco). Capa centralizada.
 * Cada formato (CARROSSÉIS, ESTÁTICOS, REELS) tem divisor próprio
 * e tabela em 2 colunas (HEADLINE / IDEIA DO CONTEÚDO) com 2 ideias
 * por página.
 */
import { Document, Image, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer'
import type { Cliente, ItemSocialMedia, PlanejamentoSocialMedia } from '@/types/database'

// URL absoluta da logo (precisa ser absoluta porque o react-pdf gera o
// PDF num contexto à parte e não resolve paths relativos sozinho).
const LOGO_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/logo-movmed.png`

// Hifenização inteligente:
//   • Palavras "normais" (<=25 chars) ficam inteiras — não corta "PLANEJAMENTO".
//   • Strings absurdamente longas sem espaço (digitação errada, hashes, etc.)
//     são quebradas em pedaços de 25 chars pra não estourar a margem.
Font.registerHyphenationCallback((word) => {
  if (word.length <= 25) return [word]
  return word.match(/.{1,25}/g) ?? [word]
})

// Paleta MovMed
const COR_LARANJA = '#f97316'
const COR_LARANJA_ESCURO = '#c2410c'
const COR_PRETO = '#0a0a0a'
const COR_BRANCO = '#ffffff'
const COR_TEXTO = '#0a0a0a'
const COR_TEXTO_CINZA = '#525252'
const COR_BORDA = '#e5e5e5'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: COR_BRANCO,
  },

  // ============ CAPA ============
  capaPage: {
    fontFamily: 'Helvetica',
    backgroundColor: COR_LARANJA,
  },
  capa: {
    flex: 1,
    backgroundColor: COR_LARANJA,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  // Rodapé preto fino com logo + info do documento
  rodapeAssinatura: {
    height: 56,
    backgroundColor: COR_PRETO,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  rodapeLogo: {
    width: 90,
    height: 30,
    objectFit: 'contain',
  },
  rodapeTexto: {
    fontSize: 9,
    color: COR_BRANCO,
    letterSpacing: 2.5,
    fontFamily: 'Helvetica-Bold',
    opacity: 0.9,
  },
  capaConteudo: {
    alignItems: 'center',
  },
  capaLinhaSuperior: {
    width: 60,
    height: 2,
    backgroundColor: COR_BRANCO,
    marginBottom: 24,
  },
  capaTitulo: {
    fontSize: 44,
    fontFamily: 'Helvetica-Bold',
    color: COR_BRANCO,
    letterSpacing: 1,
    lineHeight: 1.05,
    textAlign: 'center',
  },
  capaSub: {
    marginTop: 24,
    fontSize: 16,
    color: COR_BRANCO,
    textAlign: 'center',
    letterSpacing: 1,
  },
  capaLinhaInferior: {
    width: 240,
    height: 1,
    backgroundColor: COR_BRANCO,
    marginTop: 22,
    opacity: 0.6,
  },
  capaBlocoRodape: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  capaRodapeTexto: {
    fontSize: 10,
    color: COR_BRANCO,
    letterSpacing: 2,
    opacity: 0.85,
  },

  // ============ PÁGINA INTRODUÇÃO ============
  introBlock: {
    paddingHorizontal: 70,
    paddingTop: 80,
  },
  introHeaderBar: {
    width: 60,
    height: 4,
    backgroundColor: COR_LARANJA,
    marginBottom: 18,
  },
  introTitulo: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    color: COR_PRETO,
    marginBottom: 28,
    letterSpacing: 1,
  },
  introTexto: {
    fontSize: 13,
    color: COR_TEXTO_CINZA,
    lineHeight: 1.6,
    marginBottom: 14,
  },
  introCadencia: {
    marginTop: 18,
    fontSize: 13,
    color: COR_PRETO,
    fontFamily: 'Helvetica-Bold',
  },

  // ============ DIVISOR (CARROSSÉIS / ESTÁTICOS / REELS) ============
  divisor: {
    flex: 1,
    backgroundColor: COR_LARANJA,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divisorTexto: {
    fontSize: 56,
    fontFamily: 'Helvetica-Bold',
    color: COR_BRANCO,
    letterSpacing: 6,
    textAlign: 'center',
  },
  divisorLinha: {
    width: 80,
    height: 2,
    backgroundColor: COR_BRANCO,
    marginTop: 24,
    opacity: 0.7,
  },

  // ============ PÁGINAS DE TABELA (ideias) ============
  tabelaHeader: {
    height: 90,
    backgroundColor: COR_LARANJA,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabelaTitulo: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: COR_BRANCO,
    letterSpacing: 4,
  },
  tabelaBody: {
    flex: 1,
    paddingHorizontal: 60,
    paddingTop: 30,
  },
  tabelaColunaTitulos: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: COR_LARANJA,
  },
  colHeadline: {
    flex: 1,
    paddingRight: 14,
  },
  colIdeia: {
    flex: 1,
    paddingLeft: 14,
    borderLeftWidth: 1,
    borderLeftColor: COR_BORDA,
  },
  colTitulo: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: COR_PRETO,
    letterSpacing: 1,
  },

  ideiaRow: {
    flexDirection: 'row',
    minHeight: 130,
    paddingTop: 22,
    paddingBottom: 22,
  },
  ideiaSeparadorRow: {
    height: 1,
    backgroundColor: COR_BORDA,
  },
  ideiaHeadline: {
    flex: 1,
    paddingRight: 14,
  },
  ideiaIdeia: {
    flex: 1,
    paddingLeft: 14,
    borderLeftWidth: 1,
    borderLeftColor: COR_BORDA,
  },
  ideiaTextoHeadline: {
    fontSize: 13,
    color: COR_PRETO,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.5,
  },
  ideiaTextoIdeia: {
    fontSize: 12,
    color: COR_TEXTO_CINZA,
    lineHeight: 1.5,
  },
  ideiaDataPostagem: {
    marginTop: 8,
    fontSize: 9,
    color: COR_LARANJA_ESCURO,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },

  // ============ PÁGINA FINAL ============
  finalPage: {
    fontFamily: 'Helvetica',
    backgroundColor: COR_LARANJA,
  },
  finalContainer: {
    flex: 1,
    backgroundColor: COR_LARANJA,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  finalBloco: {
    alignItems: 'center',
  },
  finalLinhaTopo: {
    width: 80,
    height: 3,
    backgroundColor: COR_BRANCO,
    marginBottom: 28,
  },
  finalTitulo: {
    fontSize: 48,
    fontFamily: 'Helvetica-Bold',
    color: COR_BRANCO,
    lineHeight: 1.05,
    textAlign: 'center',
    letterSpacing: 1,
  },
  finalSub: {
    marginTop: 26,
    fontSize: 12,
    color: COR_BRANCO,
    letterSpacing: 3,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
  },
  finalRodape: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  finalRodapeTexto: {
    fontSize: 10,
    color: COR_BRANCO,
    letterSpacing: 2,
    opacity: 0.85,
  },
})

interface Props {
  cliente: Cliente
  plano: PlanejamentoSocialMedia
  items: ItemSocialMedia[]
}

function CapaPDF({ cliente, plano }: { cliente: Cliente; plano: PlanejamentoSocialMedia }) {
  const mes = plano.mes_referencia
    ? new Date(plano.mes_referencia).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      })
    : ''
  return (
    <Page size="A4" orientation="portrait" style={styles.capaPage}>
      <View style={styles.capa}>
        <View style={styles.capaConteudo}>
          <View style={styles.capaLinhaSuperior} />
          <Text style={styles.capaTitulo}>PLANEJAMENTO</Text>
          <Text style={styles.capaTitulo}>MENSAL</Text>
          <View style={styles.capaLinhaInferior} />
          <Text style={styles.capaSub}>
            {cliente.nome} · {capitalize(mes)}
          </Text>
        </View>
      </View>

      {/* Rodapé preto: logo à esquerda + info à direita */}
      <View style={styles.rodapeAssinatura}>
        <Image src={LOGO_URL} style={styles.rodapeLogo} />
        <Text style={styles.rodapeTexto}>CENTRAL DE CONTAS · PLANEJAMENTO</Text>
      </View>
    </Page>
  )
}

function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function PaginaIntroducao({ plano }: { plano: PlanejamentoSocialMedia }) {
  const intro =
    plano.texto_introducao ||
    'Trabalharemos com um funil de conteúdo. Posicionaremos a marca através de conteúdos que conectem, quebrem objeções e construam autoridade.'
  return (
    <Page size="A4" style={styles.page}>
      <View style={{ flex: 1 }}>
        <View style={styles.introBlock}>
          <View style={styles.introHeaderBar} />
          <Text style={styles.introTitulo}>PLANEJAMENTO</Text>
          {intro.split('\n\n').map((paragrafo, i) => (
            <Text key={i} style={styles.introTexto}>
              {paragrafo}
            </Text>
          ))}
          {plano.cadencia && <Text style={styles.introCadencia}>{plano.cadencia}.</Text>}
          <Text style={[styles.introTexto, { marginTop: 22 }]}>Vamos para o desenvolvimento.</Text>
        </View>
      </View>
    </Page>
  )
}

function DivisorPDF({ titulo }: { titulo: string }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.divisor}>
        <Text style={styles.divisorTexto}>{titulo}</Text>
        <View style={styles.divisorLinha} />
      </View>
    </Page>
  )
}

function PaginaTabela({
  formatoTitulo,
  ideias,
}: {
  formatoTitulo: string
  ideias: ItemSocialMedia[]
}) {
  return (
    <Page size="A4" style={styles.page}>
      {/* Header laranja com texto centralizado */}
      <View style={styles.tabelaHeader}>
        <Text style={styles.tabelaTitulo}>{formatoTitulo}</Text>
      </View>

      {/* Corpo da tabela */}
      <View style={styles.tabelaBody}>
        <View style={styles.tabelaColunaTitulos}>
          <View style={styles.colHeadline}>
            <Text style={styles.colTitulo}>HEADLINE</Text>
          </View>
          <View style={styles.colIdeia}>
            <Text style={styles.colTitulo}>IDEIA DO CONTEÚDO</Text>
          </View>
        </View>

        {ideias.map((it, idx) => (
          <View key={it.id}>
            <View style={styles.ideiaRow}>
              <View style={styles.ideiaHeadline}>
                <Text style={styles.ideiaTextoHeadline}>{it.titulo}</Text>
                {it.prazo && (
                  <Text style={styles.ideiaDataPostagem}>
                    {new Date(it.prazo).toLocaleDateString('pt-BR', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                    }).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.ideiaIdeia}>
                <Text style={styles.ideiaTextoIdeia}>{it.ideia_conteudo || '—'}</Text>
              </View>
            </View>
            {idx < ideias.length - 1 && <View style={styles.ideiaSeparadorRow} />}
          </View>
        ))}
      </View>
    </Page>
  )
}

function PaginaFinal() {
  return (
    <Page size="A4" style={styles.finalPage}>
      <View style={styles.finalContainer}>
        <View style={styles.finalBloco}>
          <View style={styles.finalLinhaTopo} />
          <Text style={styles.finalTitulo}>DÚVIDAS?</Text>
          <Text style={styles.finalTitulo}>SÓ CHAMAR!</Text>
          <Text style={styles.finalSub}>
            AGUARDAMOS CONFIRMAÇÃO PARA INICIARMOS A PRODUÇÃO
          </Text>
        </View>
      </View>

      {/* Rodapé preto: logo à esquerda + info à direita */}
      <View style={styles.rodapeAssinatura}>
        <Image src={LOGO_URL} style={styles.rodapeLogo} />
        <Text style={styles.rodapeTexto}>OBRIGADO · GRUPO MOVMED</Text>
      </View>
    </Page>
  )
}

export function PlanejamentoPDFDoc({ cliente, plano, items }: Props) {
  const carrosseis = items.filter((i) => i.formato === 'carrossel')
  const estaticos = items.filter((i) => i.formato === 'estatico')
  const reels = items.filter((i) => i.formato === 'reel')

  const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
  }

  return (
    <Document
      title={`Planejamento ${cliente.nome} - ${plano.mes_referencia ?? ''}`}
      author="MovMed"
    >
      <CapaPDF cliente={cliente} plano={plano} />
      <PaginaIntroducao plano={plano} />

      {carrosseis.length > 0 && (
        <>
          <DivisorPDF titulo="CARROSSÉIS" />
          {chunk(carrosseis, 2).map((bloco, i) => (
            <PaginaTabela key={`car-${i}`} formatoTitulo="CARROSSÉIS" ideias={bloco} />
          ))}
        </>
      )}

      {estaticos.length > 0 && (
        <>
          <DivisorPDF titulo="ESTÁTICOS" />
          {chunk(estaticos, 2).map((bloco, i) => (
            <PaginaTabela key={`est-${i}`} formatoTitulo="ESTÁTICOS" ideias={bloco} />
          ))}
        </>
      )}

      {reels.length > 0 && (
        <>
          <DivisorPDF titulo="REELS" />
          {chunk(reels, 2).map((bloco, i) => (
            <PaginaTabela key={`reel-${i}`} formatoTitulo="REELS" ideias={bloco} />
          ))}
        </>
      )}

      <PaginaFinal />
    </Document>
  )
}

/** Gera o PDF e dispara download direto do navegador */
export async function downloadPlanejamentoPDF({
  cliente,
  plano,
  items,
}: Props): Promise<void> {
  const blob = await pdf(<PlanejamentoPDFDoc cliente={cliente} plano={plano} items={items} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const mes = plano.mes_referencia
    ? new Date(plano.mes_referencia)
        .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        .replace('.', '')
    : 'mes'
  a.download = `Planejamento - ${cliente.nome} - ${mes}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

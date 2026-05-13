/**
 * PDF de uma Criação (copy_lp, planejamento, roteiro, copy_criativos).
 * Paleta MovMed (laranja). Capa com logo + título do tipo.
 * Cada tipo tem um bloco de introdução próprio explicando o objetivo
 * da entrega, antes do conteúdo gerado.
 */
import { Document, Image, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer'
import type { Cliente, Criacao, TipoCriacao } from '@/types/database'

const LOGO_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/logo-movmed.png`

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

// Conteúdo do "Sobre essa entrega" — varia por tipo
const tipoTitulo: Record<TipoCriacao, string> = {
  copy_lp: 'COPY · LANDING PAGE',
  copy_criativos: 'COPY · CRIATIVOS',
  planejamento: 'PLANEJAMENTO DE TRÁFEGO',
  roteiro: 'ROTEIRO',
}

const tipoIntro: Record<TipoCriacao, { titulo: string; paragrafos: string[] }> = {
  copy_lp: {
    titulo: 'Sobre essa copy',
    paragrafos: [
      'O objetivo dessa copy é conectar com o público-alvo do cliente, atacar suas principais dores e gerar autoridade, levando o visitante a tomar a ação desejada na landing page.',
      'A copy foi estruturada em blocos (headline, subhead, prova social, oferta, CTA) pensada pra ser conversiva — ou seja, transformar visita em lead/contato.',
      'Após aprovação, a copy segue automaticamente pra produção da landing page com a equipe de design.',
    ],
  },
  copy_criativos: {
    titulo: 'Sobre essas copies de criativo',
    paragrafos: [
      'São variações de copy para os anúncios (Meta Ads / Google Ads). Cada variação testa um ângulo diferente: dor, desejo, prova social, urgência.',
      'O objetivo é abrir leque de testes pra identificar qual mensagem gera mais CTR e CPL no público do cliente.',
      'Após aprovação, as copies seguem automaticamente pra produção do criativo com a equipe de design.',
    ],
  },
  planejamento: {
    titulo: 'Sobre esse planejamento',
    paragrafos: [
      'Documento estratégico que organiza as campanhas do cliente: objetivos, público, plataformas, orçamento, criativos previstos e KPIs alvo.',
      'Serve como guia pra equipe de tráfego executar a operação com foco e pra alinhar expectativas com o cliente sobre o que está sendo entregue no mês.',
    ],
  },
  roteiro: {
    titulo: 'Sobre esse roteiro',
    paragrafos: [
      'Roteiro estruturado para vídeo (reel/anúncio) ou carrossel. Define gancho inicial, desenvolvimento, prova/argumento e CTA.',
      'Pensado pra prender atenção nos primeiros segundos, manter retenção e conduzir até a ação desejada.',
    ],
  },
}

const styles = StyleSheet.create({
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
  capaLinhaSuperior: {
    width: 60,
    height: 2,
    backgroundColor: COR_BRANCO,
    marginBottom: 24,
  },
  capaTipo: {
    fontSize: 14,
    color: COR_BRANCO,
    letterSpacing: 4,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 18,
    textAlign: 'center',
  },
  capaTitulo: {
    fontSize: 36,
    fontFamily: 'Helvetica-Bold',
    color: COR_BRANCO,
    letterSpacing: 1,
    lineHeight: 1.1,
    textAlign: 'center',
  },
  capaLinhaInferior: {
    width: 240,
    height: 1,
    backgroundColor: COR_BRANCO,
    marginTop: 32,
  },
  capaSub: {
    marginTop: 24,
    fontSize: 14,
    color: COR_BRANCO,
    textAlign: 'center',
    letterSpacing: 1,
  },
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

  // ============ PÁGINA DE CONTEÚDO ============
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: COR_BRANCO,
  },
  // Header laranja superior com logo + nome do cliente
  pageHeader: {
    height: 48,
    backgroundColor: COR_PRETO,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  pageHeaderLogo: {
    width: 80,
    height: 26,
    objectFit: 'contain',
  },
  pageHeaderTexto: {
    fontSize: 9,
    color: COR_BRANCO,
    letterSpacing: 2,
    fontFamily: 'Helvetica-Bold',
  },
  pageBody: {
    flex: 1,
    paddingHorizontal: 60,
    paddingTop: 40,
    paddingBottom: 40,
  },
  // Intro/explicação do tipo
  introBox: {
    backgroundColor: '#fff7ed',
    borderLeftWidth: 4,
    borderLeftColor: COR_LARANJA,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 32,
  },
  introTitulo: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: COR_LARANJA_ESCURO,
    letterSpacing: 1,
    marginBottom: 8,
  },
  introParagrafo: {
    fontSize: 10,
    color: COR_TEXTO,
    lineHeight: 1.55,
    marginBottom: 6,
  },
  // Bloco do conteúdo gerado
  conteudoTitulo: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: COR_PRETO,
    letterSpacing: 1,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: COR_LARANJA,
    marginBottom: 16,
  },
  conteudoTexto: {
    fontSize: 11,
    color: COR_TEXTO,
    lineHeight: 1.65,
  },
  // Briefing (se houver)
  briefingBox: {
    marginBottom: 24,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COR_BORDA,
    backgroundColor: '#fafafa',
  },
  briefingTitulo: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: COR_TEXTO_CINZA,
    letterSpacing: 1,
    marginBottom: 5,
  },
  briefingTexto: {
    fontSize: 10,
    color: COR_TEXTO,
    lineHeight: 1.5,
  },
  // Footer da página de conteúdo
  pageFooter: {
    height: 36,
    backgroundColor: COR_PRETO,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
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

function CapaPDF({ cliente, criacao }: Props) {
  return (
    <Page size="A4" orientation="portrait" style={styles.capaPage}>
      <View style={styles.capa}>
        <View style={styles.capaLinhaSuperior} />
        <Text style={styles.capaTipo}>{tipoTitulo[criacao.tipo]}</Text>
        <Text style={styles.capaTitulo}>{criacao.titulo.toUpperCase()}</Text>
        <View style={styles.capaLinhaInferior} />
        <Text style={styles.capaSub}>{cliente.nome}</Text>
      </View>
      <View style={styles.rodapeAssinatura}>
        <Image src={LOGO_URL} style={styles.rodapeLogo} />
        <Text style={styles.rodapeTexto}>MOVMED · CENTRAL DE CONTAS</Text>
      </View>
    </Page>
  )
}

function PaginaConteudo({ cliente, criacao }: Props) {
  const intro = tipoIntro[criacao.tipo]
  return (
    <Page size="A4" orientation="portrait" style={styles.page}>
      <View style={styles.pageHeader} fixed>
        <Image src={LOGO_URL} style={styles.pageHeaderLogo} />
        <Text style={styles.pageHeaderTexto}>
          {tipoTitulo[criacao.tipo]} · {cliente.nome.toUpperCase()}
        </Text>
      </View>

      <View style={styles.pageBody}>
        {/* Caixa de explicação por tipo */}
        <View style={styles.introBox}>
          <Text style={styles.introTitulo}>{intro.titulo.toUpperCase()}</Text>
          {intro.paragrafos.map((p, i) => (
            <Text key={i} style={styles.introParagrafo}>
              {p}
            </Text>
          ))}
        </View>

        {/* Briefing original (se houver) */}
        {criacao.briefing && criacao.briefing.trim() && (
          <View style={styles.briefingBox}>
            <Text style={styles.briefingTitulo}>BRIEFING</Text>
            <Text style={styles.briefingTexto}>{criacao.briefing}</Text>
          </View>
        )}

        {/* Conteúdo gerado */}
        <Text style={styles.conteudoTitulo}>ENTREGA</Text>
        <Text style={styles.conteudoTexto}>
          {criacao.conteudo && criacao.conteudo.trim()
            ? criacao.conteudo
            : '— Conteúdo ainda não foi preenchido —'}
        </Text>
      </View>

      <View style={styles.pageFooter} fixed>
        <Text style={styles.pageFooterTexto}>MOVMED</Text>
        <Text
          style={styles.pageFooterTexto}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </View>
    </Page>
  )
}

export function CriacaoPDFDoc({ cliente, criacao }: Props) {
  return (
    <Document title={`${tipoTitulo[criacao.tipo]} — ${criacao.titulo}`}>
      <CapaPDF cliente={cliente} criacao={criacao} />
      <PaginaConteudo cliente={cliente} criacao={criacao} />
    </Document>
  )
}

/** Gera o PDF e dispara download no browser. */
export async function downloadCriacaoPDF({ cliente, criacao }: Props): Promise<void> {
  const blob = await pdf(<CriacaoPDFDoc cliente={cliente} criacao={criacao} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const tipoSlug = criacao.tipo.replace('_', '-')
  const tituloSlug = criacao.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  a.download = `${tipoSlug}-${cliente.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${tituloSlug || 'sem-titulo'}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

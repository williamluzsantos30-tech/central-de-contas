/**
 * PDFs do Controle do Head de Tráfego — Relatório Diário e Semanal.
 *
 * Paleta MovMed (laranja). Layout objetivo:
 *   - Capa enxuta com período + KPIs principais
 *   - Conteúdo focado nas informações que o head precisa olhar
 *
 * Os tipos ContaMock / Verificacao / etc são re-exportados do ControleHead.
 * Quando migrarmos pra dados reais, basta trocar o shape sem mexer aqui.
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

// =========================================================
// Tipos (espelham os do ControleHead.tsx — fonte única de verdade
// quando virar dados reais será o tipo do banco)
// =========================================================

export type StatusConta = 'estavel' | 'instavel' | 'critico'
export type StatusPlano = 'aberto' | 'em_andamento' | 'concluido'
export type Plataforma = 'meta_ads' | 'google_ads' | 'tiktok_ads' | 'youtube_ads'

export interface PlataformaSaude {
  plataforma: Plataforma
  status: StatusConta
  leads_30d: number
  cpl: number
  verba_gasta: number
  verba_orcamento: number
  tendencia_pct: number
}

export interface Verificacao {
  id: string
  data: string
  plataforma: Plataforma
  problema: string
  plano_acao: string
  status_plano: StatusPlano
  autor: string
}

export interface ContaPDF {
  id: string
  nome: string
  nicho: string
  squad: string
  gestor: { nome: string }
  plataformas: PlataformaSaude[]
  verificacoes: Verificacao[]
  status_geral_desde: string
}

// SLA — mesmas constantes do ControleHead.tsx (cópia local pra não acoplar)
const SLA: Record<
  StatusConta,
  { cadenciaSemana: number; intervaloMaxDias: number; prazoPlanoDiasUteis: number }
> = {
  estavel: { cadenciaSemana: 1, intervaloMaxDias: 10, prazoPlanoDiasUteis: 14 },
  instavel: { cadenciaSemana: 2, intervaloMaxDias: 5, prazoPlanoDiasUteis: 7 },
  critico: { cadenciaSemana: 3, intervaloMaxDias: 3, prazoPlanoDiasUteis: 3 },
}

const ESCALONAMENTO = {
  semanasInstavelParaCritica: 3,
  semanasCriticaParaDiretoria: 2,
}

function diasUteisEntre(start: Date, end: Date): number {
  const a = new Date(start)
  a.setHours(0, 0, 0, 0)
  const b = new Date(end)
  b.setHours(0, 0, 0, 0)
  if (b <= a) return 0
  let count = 0
  const cur = new Date(a)
  while (cur < b) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

function diasDesde(iso: string): number {
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

interface QuebraSLA {
  conta: ContaPDF
  motivo: string
}

function detectarQuebrasSLA(contas: ContaPDF[]): QuebraSLA[] {
  const out: QuebraSLA[] = []
  const hoje = new Date()
  for (const c of contas) {
    const sg = statusGeral(c)
    const sla = SLA[sg]
    const naSemana = verificacoesDaSemana(c).length
    const ult = c.verificacoes[0]
    const motivos: string[] = []

    // 1. Cadência
    if (naSemana < sla.cadenciaSemana && estaAtrasada(c)) {
      motivos.push(
        `Cadência abaixo do mínimo (${naSemana}/${sla.cadenciaSemana} esta semana)`,
      )
    }
    // 2. Intervalo
    if (!ult) {
      motivos.push('Nunca verificada')
    } else {
      const dias = diasDesde(ult.data)
      if (dias > sla.intervaloMaxDias) {
        motivos.push(
          `${dias} dias desde última verificação (limite ${sla.intervaloMaxDias})`,
        )
      }
    }
    // 3. Planos vencidos
    const vencidos = c.verificacoes.filter((v) => {
      if (v.status_plano === 'concluido') return false
      const corridos = diasUteisEntre(new Date(v.data), hoje)
      return corridos > sla.prazoPlanoDiasUteis
    })
    if (vencidos.length > 0) {
      motivos.push(
        `${vencidos.length} plano(s) de ação vencido(s) (limite ${sla.prazoPlanoDiasUteis} dias úteis)`,
      )
    }
    if (motivos.length > 0) {
      out.push({ conta: c, motivo: motivos.join(' · ') })
    }
  }
  return out
}

function detectarEscalonamentos(contas: ContaPDF[]): {
  para_diretoria: ContaPDF[]
  sugere_critica: ContaPDF[]
} {
  const para_diretoria: ContaPDF[] = []
  const sugere_critica: ContaPDF[] = []
  for (const c of contas) {
    const sg = statusGeral(c)
    const dias = diasDesde(c.status_geral_desde)
    const semanas = Math.floor(dias / 7)
    if (sg === 'instavel' && semanas >= ESCALONAMENTO.semanasInstavelParaCritica) {
      sugere_critica.push(c)
    } else if (sg === 'critico' && semanas >= ESCALONAMENTO.semanasCriticaParaDiretoria) {
      para_diretoria.push(c)
    }
  }
  return { para_diretoria, sugere_critica }
}

// =========================================================
// Helpers
// =========================================================

const ordemStatus: Record<StatusConta, number> = { critico: 3, instavel: 2, estavel: 1 }
const META_SEMANAL: Record<StatusConta, number> = { estavel: 1, instavel: 2, critico: 3 }

function statusGeral(c: ContaPDF): StatusConta {
  let pior: StatusConta = 'estavel'
  for (const p of c.plataformas) {
    if (ordemStatus[p.status] > ordemStatus[pior]) pior = p.status
  }
  return pior
}

function inicioDaSemana(): Date {
  const d = new Date()
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (dow - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function verificacoesDaSemana(c: ContaPDF): Verificacao[] {
  const seg = inicioDaSemana().getTime()
  return c.verificacoes.filter((v) => new Date(v.data).getTime() >= seg)
}

function estaAtrasada(c: ContaPDF): boolean {
  const meta = META_SEMANAL[statusGeral(c)]
  const feitas = verificacoesDaSemana(c).length
  if (feitas >= meta) return false
  const today = new Date()
  const diaSemana = today.getDay() === 0 ? 7 : today.getDay()
  const esperado = Math.floor((meta * diaSemana) / 7)
  return feitas < esperado
}

const plataformaLabel: Record<Plataforma, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  tiktok_ads: 'TikTok Ads',
  youtube_ads: 'YouTube Ads',
}

const statusLabel: Record<StatusConta, string> = {
  estavel: 'Estável',
  instavel: 'Instável',
  critico: 'Crítica',
}

const statusPlanoLabel: Record<StatusPlano, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
}

function formatDataPt(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatHoraPt(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// =========================================================
// Paleta MovMed
// =========================================================

const COR = {
  laranja: '#f97316',
  laranjaEscuro: '#c2410c',
  preto: '#0a0a0a',
  branco: '#ffffff',
  texto: '#171717',
  cinza: '#525252',
  cinzaClaro: '#a3a3a3',
  borda: '#e5e5e5',
  bgSuave: '#fafafa',
  // status
  critico: '#ef4444',
  instavel: '#f59e0b',
  estavel: '#10b981',
  // plataformas
  meta: '#2563eb',
  google: '#d97706',
  tiktok: '#ec4899',
  youtube: '#dc2626',
}

function corStatus(s: StatusConta): string {
  return s === 'critico' ? COR.critico : s === 'instavel' ? COR.instavel : COR.estavel
}

function corPlataforma(p: Plataforma): string {
  return p === 'meta_ads'
    ? COR.meta
    : p === 'google_ads'
      ? COR.google
      : p === 'tiktok_ads'
        ? COR.tiktok
        : COR.youtube
}

function corStatusPlano(s: StatusPlano): string {
  return s === 'aberto' ? COR.critico : s === 'em_andamento' ? COR.instavel : COR.estavel
}

const LOGO_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/logo-movmed.png`

// =========================================================
// Styles compartilhados
// =========================================================

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: COR.branco,
    padding: 0,
  },
  // Header da página
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
  // Faixa laranja embaixo do header
  faixaLaranja: {
    height: 3,
    backgroundColor: COR.laranja,
  },
  // Capa
  capaBlocoTitulo: {
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 24,
  },
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
  capaPeriodo: {
    fontSize: 12,
    color: COR.cinza,
    marginTop: 8,
  },
  // Bloco geral
  bloco: {
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  // KPIs grid
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
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
  kpiSub: {
    fontSize: 8,
    color: COR.cinzaClaro,
    marginTop: 2,
  },
  // Section title
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
  // Linha divisora
  divider: {
    height: 1,
    backgroundColor: COR.borda,
    marginVertical: 6,
  },
  // Conta card (verificações no Diário, etc)
  verifCard: {
    marginHorizontal: 32,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COR.borda,
    borderRadius: 6,
    padding: 10,
    backgroundColor: COR.branco,
  },
  verifBarraLateral: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  verifTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  verifNomeCliente: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: COR.texto,
  },
  verifMeta: {
    fontSize: 8,
    color: COR.cinza,
    marginTop: 1,
  },
  verifBadgesRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
    color: COR.branco,
  },
  labelMini: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    letterSpacing: 1,
    color: COR.cinza,
    marginBottom: 2,
    marginTop: 4,
  },
  textoBody: {
    fontSize: 9,
    color: COR.texto,
    lineHeight: 1.4,
  },
  rodapeAutor: {
    fontSize: 8,
    color: COR.cinzaClaro,
    marginTop: 6,
    fontStyle: 'italic',
  },
  // Tabela
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
  tabelaCell: {
    fontSize: 8,
    color: COR.texto,
  },
  // Rodapé página
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

// =========================================================
// Subcomponentes
// =========================================================

function HeaderPagina({ titulo }: { titulo: string }) {
  return (
    <>
      <View style={s.header} fixed>
        <Image src={LOGO_URL} style={s.headerLogo} />
        <Text style={s.headerTitulo}>{titulo}</Text>
      </View>
      <View style={s.faixaLaranja} fixed />
    </>
  )
}

function Rodape() {
  return (
    <View style={s.rodape} fixed>
      <Text>MovMed · Central de Contas</Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  )
}

function Badge({ texto, cor }: { texto: string; cor: string }) {
  return <Text style={[s.badge, { backgroundColor: cor }]}>{texto.toUpperCase()}</Text>
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
// RELATÓRIO DIÁRIO
// =========================================================

function RelatorioDiarioDoc({ contas }: { contas: ContaPDF[] }) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const amanha = new Date(hoje.getTime() + 24 * 60 * 60 * 1000)

  // Verificações de hoje
  type Linha = { conta: ContaPDF; verif: Verificacao }
  const linhas: Linha[] = []
  for (const c of contas) {
    for (const v of c.verificacoes) {
      const d = new Date(v.data)
      if (d >= hoje && d < amanha) linhas.push({ conta: c, verif: v })
    }
  }
  linhas.sort((a, b) => new Date(a.verif.data).getTime() - new Date(b.verif.data).getTime())

  // KPIs do dia
  const total = linhas.length
  const porPlat = linhas.reduce<Record<string, number>>((acc, l) => {
    acc[l.verif.plataforma] = (acc[l.verif.plataforma] ?? 0) + 1
    return acc
  }, {})
  const planoAberto = linhas.filter((l) => l.verif.status_plano === 'aberto').length
  const contasCriticas = new Set(
    linhas.filter((l) => statusGeral(l.conta) === 'critico').map((l) => l.conta.id),
  ).size

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <HeaderPagina titulo="RELATÓRIO DIÁRIO" />

        {/* Capa */}
        <View style={s.capaBlocoTitulo}>
          <Text style={s.capaTipo}>CONTROLE DO HEAD · TRÁFEGO</Text>
          <Text style={s.capaTitulo}>Relatório Diário</Text>
          <Text style={s.capaPeriodo}>
            {hoje.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              weekday: 'long',
            })}
          </Text>
        </View>

        {/* KPIs */}
        <View style={s.bloco}>
          <View style={s.kpiRow}>
            <KpiCard label="VERIFICAÇÕES" valor={total} sub="Registradas hoje" />
            <KpiCard
              label="EM CONTAS CRÍTICAS"
              valor={contasCriticas}
              sub="Contas únicas verificadas"
              cor={total > 0 ? COR.critico : undefined}
            />
            <KpiCard
              label="PLANOS NOVOS"
              valor={planoAberto}
              sub="Ações pendentes criadas"
              cor={planoAberto > 0 ? COR.instavel : undefined}
            />
          </View>
        </View>

        {/* Distribuição por plataforma — só mostra se tem dado */}
        {total > 0 && (
          <View style={s.bloco}>
            <Text style={[s.labelMini, { paddingHorizontal: 0 }]}>POR PLATAFORMA</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(porPlat).map(([plat, n]) => (
                <View
                  key={plat}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderWidth: 1,
                    borderColor: COR.borda,
                    borderRadius: 4,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: corPlataforma(plat as Plataforma),
                    }}
                  />
                  <Text style={{ fontSize: 9, color: COR.texto }}>
                    {plataformaLabel[plat as Plataforma]}
                  </Text>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COR.cinza }}>
                    {n}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Lista de verificações */}
        <Text style={s.sectionTitulo}>Verificações registradas hoje</Text>
        <Text style={s.sectionSubtitulo}>
          Em ordem cronológica · problema encontrado e plano de ação por verificação.
        </Text>

        {linhas.length === 0 ? (
          <View
            style={{
              marginHorizontal: 32,
              padding: 24,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: COR.borda,
              borderRadius: 6,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 11, color: COR.cinza }}>
              Nenhuma verificação registrada hoje.
            </Text>
            <Text style={{ fontSize: 9, color: COR.cinzaClaro, marginTop: 4 }}>
              Acesse a Central pra registrar suas verificações da rotina.
            </Text>
          </View>
        ) : (
          linhas.map(({ conta, verif }, i) => (
            <View key={`${conta.id}-${verif.id}-${i}`} style={s.verifCard} wrap={false}>
              <View
                style={[s.verifBarraLateral, { backgroundColor: corStatus(statusGeral(conta)) }]}
              />
              <View style={{ paddingLeft: 6 }}>
                <View style={s.verifTopRow}>
                  <View>
                    <Text style={s.verifNomeCliente}>{conta.nome}</Text>
                    <Text style={s.verifMeta}>
                      {conta.nicho} · Squad {conta.squad} · Gestor {conta.gestor.nome}
                    </Text>
                  </View>
                  <View style={s.verifBadgesRow}>
                    <Badge
                      texto={plataformaLabel[verif.plataforma]}
                      cor={corPlataforma(verif.plataforma)}
                    />
                    <Badge
                      texto={statusPlanoLabel[verif.status_plano]}
                      cor={corStatusPlano(verif.status_plano)}
                    />
                  </View>
                </View>

                <Text style={s.labelMini}>PROBLEMA ENCONTRADO</Text>
                <Text style={s.textoBody}>{verif.problema}</Text>

                <Text style={s.labelMini}>PLANO DE AÇÃO</Text>
                <Text style={s.textoBody}>{verif.plano_acao}</Text>

                <Text style={s.rodapeAutor}>
                  Registrado às {formatHoraPt(verif.data)} por {verif.autor}
                </Text>
              </View>
            </View>
          ))
        )}

        <Rodape />
      </Page>
    </Document>
  )
}

// =========================================================
// RELATÓRIO SEMANAL
// =========================================================

function RelatorioSemanalDoc({ contas }: { contas: ContaPDF[] }) {
  const seg = inicioDaSemana()
  const hoje = new Date()

  // Contadores
  let totEstavel = 0, totInstavel = 0, totCritico = 0, totAtrasadas = 0
  let verifsSemana = 0, planosAbertos = 0
  for (const c of contas) {
    const sg = statusGeral(c)
    if (sg === 'estavel') totEstavel++
    if (sg === 'instavel') totInstavel++
    if (sg === 'critico') totCritico++
    if (estaAtrasada(c)) totAtrasadas++
    verifsSemana += verificacoesDaSemana(c).length
    for (const v of c.verificacoes) if (v.status_plano !== 'concluido') planosAbertos++
  }

  // Contas críticas/instáveis ordenadas
  const criticas = contas.filter((c) => statusGeral(c) === 'critico')
  const instaveis = contas.filter((c) => statusGeral(c) === 'instavel')

  // SLA + escalonamentos
  const quebrasSLA = detectarQuebrasSLA(contas)
  const escalonamentos = detectarEscalonamentos(contas)

  // Verificações da semana ordenadas (mais recente primeiro)
  type Linha = { conta: ContaPDF; verif: Verificacao }
  const linhas: Linha[] = []
  for (const c of contas) {
    for (const v of c.verificacoes) {
      if (new Date(v.data).getTime() >= seg.getTime()) linhas.push({ conta: c, verif: v })
    }
  }
  linhas.sort((a, b) => new Date(b.verif.data).getTime() - new Date(a.verif.data).getTime())

  // Resumo por gestor
  const porGestor = new Map<string, number>()
  for (const l of linhas) {
    porGestor.set(l.conta.gestor.nome, (porGestor.get(l.conta.gestor.nome) ?? 0) + 1)
  }
  const gestoresOrdenados = Array.from(porGestor.entries()).sort((a, b) => b[1] - a[1])

  return (
    <Document>
      {/* Página 1: Capa + KPIs + Contas críticas */}
      <Page size="A4" style={s.page}>
        <HeaderPagina titulo="RELATÓRIO SEMANAL" />

        {/* Capa */}
        <View style={s.capaBlocoTitulo}>
          <Text style={s.capaTipo}>CONTROLE DO HEAD · TRÁFEGO</Text>
          <Text style={s.capaTitulo}>Relatório Semanal</Text>
          <Text style={s.capaPeriodo}>
            {seg.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} —{' '}
            {hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </Text>
        </View>

        {/* KPIs grid: 5 cards */}
        <View style={s.bloco}>
          <View style={s.kpiRow}>
            <KpiCard label="CRÍTICAS" valor={totCritico} sub="3x semana" cor={COR.critico} />
            <KpiCard label="INSTÁVEIS" valor={totInstavel} sub="2x semana" cor={COR.instavel} />
            <KpiCard label="ESTÁVEIS" valor={totEstavel} sub="1x semana" cor={COR.estavel} />
          </View>
          <View style={[s.kpiRow, { marginTop: 8 }]}>
            <KpiCard
              label="VERIFICAÇÕES NA SEMANA"
              valor={verifsSemana}
              sub="Total registradas"
            />
            <KpiCard
              label="CONTAS ATRASADAS"
              valor={totAtrasadas}
              sub="Abaixo da cadência"
              cor={totAtrasadas > 0 ? COR.critico : undefined}
            />
            <KpiCard
              label="QUEBRAS DE SLA"
              valor={quebrasSLA.length}
              sub="Contas com SLA quebrado"
              cor={quebrasSLA.length > 0 ? COR.critico : undefined}
            />
          </View>
          <View style={[s.kpiRow, { marginTop: 8 }]}>
            <KpiCard
              label="PLANOS ABERTOS"
              valor={planosAbertos}
              sub="Pendentes / em andamento"
              cor={planosAbertos > 0 ? COR.instavel : undefined}
            />
            <KpiCard
              label="ESCALAR DIRETORIA"
              valor={escalonamentos.para_diretoria.length}
              sub="Crítica há 2+ semanas"
              cor={escalonamentos.para_diretoria.length > 0 ? COR.critico : undefined}
            />
            <KpiCard
              label="RECLASSIFICAR"
              valor={escalonamentos.sugere_critica.length}
              sub="Instável há 3+ semanas"
              cor={escalonamentos.sugere_critica.length > 0 ? COR.instavel : undefined}
            />
          </View>
        </View>

        {/* Quebras de SLA — primeira seção, prioridade máxima */}
        {quebrasSLA.length > 0 && (
          <>
            <Text style={s.sectionTitulo}>Quebras de SLA</Text>
            <Text style={s.sectionSubtitulo}>
              Contas que violaram a cadência, intervalo máximo ou prazo de plano de ação.
            </Text>
            <View
              style={{
                marginHorizontal: 32,
                borderWidth: 1,
                borderColor: COR.critico,
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <View
                style={[
                  s.tabelaHeader,
                  { backgroundColor: COR.critico },
                ]}
              >
                <Text style={[s.tabelaHeaderCell, { flex: 2 }]}>CLIENTE</Text>
                <Text style={[s.tabelaHeaderCell, { flex: 1 }]}>STATUS</Text>
                <Text style={[s.tabelaHeaderCell, { flex: 4 }]}>MOTIVO</Text>
              </View>
              {quebrasSLA.map(({ conta, motivo }) => (
                <View key={conta.id} style={s.tabelaRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={[s.tabelaCell, { fontFamily: 'Helvetica-Bold' }]}>
                      {conta.nome}
                    </Text>
                    <Text style={[s.tabelaCell, { fontSize: 7, color: COR.cinza }]}>
                      {conta.gestor.nome}
                    </Text>
                  </View>
                  <Text
                    style={[
                      s.tabelaCell,
                      {
                        flex: 1,
                        color: corStatus(statusGeral(conta)),
                        fontFamily: 'Helvetica-Bold',
                      },
                    ]}
                  >
                    {statusLabel[statusGeral(conta)]}
                  </Text>
                  <Text style={[s.tabelaCell, { flex: 4 }]}>{motivo}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Contas críticas — destaque */}
        {criticas.length > 0 && (
          <>
            <Text style={s.sectionTitulo}>Contas em estado crítico</Text>
            <Text style={s.sectionSubtitulo}>
              Exigem 3 verificações por semana. Última verificação e plano em curso.
            </Text>
            {criticas.map((c) => (
              <ContaResumoCard key={c.id} conta={c} />
            ))}
          </>
        )}

        <Rodape />
      </Page>

      {/* Página 2: Contas instáveis + resumo por gestor */}
      <Page size="A4" style={s.page}>
        <HeaderPagina titulo="RELATÓRIO SEMANAL" />

        {instaveis.length > 0 && (
          <>
            <Text style={s.sectionTitulo}>Contas instáveis</Text>
            <Text style={s.sectionSubtitulo}>
              Exigem 2 verificações por semana. Acompanhar pra não regredir.
            </Text>
            {instaveis.map((c) => (
              <ContaResumoCard key={c.id} conta={c} />
            ))}
          </>
        )}

        {gestoresOrdenados.length > 0 && (
          <>
            <Text style={s.sectionTitulo}>Verificações por gestor (semana)</Text>
            <Text style={s.sectionSubtitulo}>
              Quantidade de verificações que cada gestor recebeu nesta semana.
            </Text>
            <View style={s.tabela}>
              <View style={s.tabelaHeader}>
                <Text style={[s.tabelaHeaderCell, { flex: 3 }]}>GESTOR</Text>
                <Text style={[s.tabelaHeaderCell, { flex: 1, textAlign: 'right' }]}>
                  VERIFICAÇÕES
                </Text>
              </View>
              {gestoresOrdenados.map(([g, n]) => (
                <View key={g} style={s.tabelaRow}>
                  <Text style={[s.tabelaCell, { flex: 3 }]}>{g}</Text>
                  <Text
                    style={[
                      s.tabelaCell,
                      { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
                    ]}
                  >
                    {n}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Rodape />
      </Page>

      {/* Página 3+: Todas as verificações da semana */}
      <Page size="A4" style={s.page}>
        <HeaderPagina titulo="RELATÓRIO SEMANAL" />

        <Text style={s.sectionTitulo}>Verificações da semana</Text>
        <Text style={s.sectionSubtitulo}>
          {linhas.length} registro{linhas.length === 1 ? '' : 's'} · mais recente primeiro.
        </Text>

        {linhas.length === 0 ? (
          <View
            style={{
              marginHorizontal: 32,
              padding: 24,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: COR.borda,
              borderRadius: 6,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 11, color: COR.cinza }}>
              Nenhuma verificação registrada nesta semana.
            </Text>
          </View>
        ) : (
          linhas.map(({ conta, verif }, i) => (
            <View key={`${conta.id}-${verif.id}-${i}`} style={s.verifCard} wrap={false}>
              <View
                style={[s.verifBarraLateral, { backgroundColor: corStatus(statusGeral(conta)) }]}
              />
              <View style={{ paddingLeft: 6 }}>
                <View style={s.verifTopRow}>
                  <View>
                    <Text style={s.verifNomeCliente}>{conta.nome}</Text>
                    <Text style={s.verifMeta}>
                      {formatDataPt(verif.data)} {formatHoraPt(verif.data)} · {conta.gestor.nome}
                    </Text>
                  </View>
                  <View style={s.verifBadgesRow}>
                    <Badge
                      texto={plataformaLabel[verif.plataforma]}
                      cor={corPlataforma(verif.plataforma)}
                    />
                    <Badge
                      texto={statusPlanoLabel[verif.status_plano]}
                      cor={corStatusPlano(verif.status_plano)}
                    />
                  </View>
                </View>

                <Text style={s.labelMini}>PROBLEMA</Text>
                <Text style={s.textoBody}>{verif.problema}</Text>

                <Text style={s.labelMini}>PLANO DE AÇÃO</Text>
                <Text style={s.textoBody}>{verif.plano_acao}</Text>
              </View>
            </View>
          ))
        )}

        <Rodape />
      </Page>
    </Document>
  )
}

/** Card compacto de uma conta crítica/instável no relatório semanal */
function ContaResumoCard({ conta }: { conta: ContaPDF }) {
  const sg = statusGeral(conta)
  const naSemana = verificacoesDaSemana(conta).length
  const meta = META_SEMANAL[sg]
  const atrasada = estaAtrasada(conta)
  const ult = conta.verificacoes[0]

  return (
    <View style={s.verifCard} wrap={false}>
      <View style={[s.verifBarraLateral, { backgroundColor: corStatus(sg) }]} />
      <View style={{ paddingLeft: 6 }}>
        <View style={s.verifTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.verifNomeCliente}>{conta.nome}</Text>
            <Text style={s.verifMeta}>
              {conta.nicho} · Squad {conta.squad} · {conta.gestor.nome}
            </Text>
          </View>
          <View style={s.verifBadgesRow}>
            <Text
              style={{
                fontSize: 8,
                color: COR.cinza,
                marginRight: 6,
              }}
            >
              {naSemana}/{meta} verif.
            </Text>
            {atrasada && <Badge texto="Atrasada" cor={COR.critico} />}
          </View>
        </View>

        {/* Linha de plataformas com saúde */}
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4, marginBottom: 6 }}>
          {conta.plataformas.map((p) => (
            <View
              key={p.plataforma}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
                paddingHorizontal: 5,
                paddingVertical: 2,
                borderWidth: 1,
                borderColor: COR.borda,
                borderRadius: 3,
              }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: corPlataforma(p.plataforma),
                }}
              />
              <Text style={{ fontSize: 7, color: COR.texto, fontFamily: 'Helvetica-Bold' }}>
                {plataformaLabel[p.plataforma]}
              </Text>
              <Text style={{ fontSize: 7, color: corStatus(p.status), fontFamily: 'Helvetica-Bold' }}>
                {statusLabel[p.status]}
              </Text>
              <Text style={{ fontSize: 7, color: COR.cinzaClaro }}>
                {p.leads_30d}L · {formatBRL(p.cpl)}
              </Text>
            </View>
          ))}
        </View>

        {ult ? (
          <>
            <Text style={s.labelMini}>ÚLTIMA VERIFICAÇÃO · {formatDataPt(ult.data)}</Text>
            <Text style={[s.textoBody, { color: COR.cinza }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: COR.texto }}>Problema: </Text>
              {ult.problema}
            </Text>
            <Text style={[s.textoBody, { color: COR.cinza, marginTop: 2 }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: COR.texto }}>Plano: </Text>
              {ult.plano_acao}
            </Text>
          </>
        ) : (
          <Text style={[s.textoBody, { color: COR.critico, fontStyle: 'italic' }]}>
            Sem verificações registradas ainda.
          </Text>
        )}
      </View>
    </View>
  )
}

// =========================================================
// API pública
// =========================================================

export async function downloadRelatorioDiarioPDF(contas: ContaPDF[]): Promise<void> {
  const blob = await pdf(<RelatorioDiarioDoc contas={contas} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  a.download = `relatorio-diario_${yyyy}-${mm}-${dd}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function downloadRelatorioSemanalPDF(contas: ContaPDF[]): Promise<void> {
  const blob = await pdf(<RelatorioSemanalDoc contas={contas} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  a.download = `relatorio-semanal_${yyyy}-${mm}-${dd}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Adapter Meta Ads (Meta Marketing API) — estrutura + simulação.
 *
 * Conexão real exige um App Meta aprovado (Marketing API, permissão ads_read)
 * + Login do Facebook do cliente OU acesso de parceiro ao Business Manager da
 * agência (System User). Cada tenant do SaaS terá o próprio App/credenciais.
 * `getMetrics` é o ÚNICO ponto a trocar pela API real (insights da conta act_…).
 */
import {
  Infinity as InfinityIcon,
  Wallet,
  Users,
  Eye,
  Percent,
  Coins,
  Gauge,
  Target,
  Receipt,
} from 'lucide-react'
import {
  createAdsConnectionStore,
  gerarCampanhasMock,
  hash,
  ranged,
  type AdsMetricas,
  type AdsPlatformAdapter,
} from './adsPlatform'

const store = createAdsConnectionStore({ connKey: 'meta-ads-conn', agencyKey: 'meta-ads-agency' })

// Objetivos de campanha do Gerenciador de Anúncios (ODAX).
const TIPO_LABEL: Record<string, string> = {
  leads: 'Cadastros (Leads)',
  vendas: 'Vendas',
  trafego: 'Tráfego',
  engajamento: 'Engajamento',
  reconhecimento: 'Reconhecimento',
}
// Nome sempre coerente com o objetivo.
const TEMPLATES = [
  { nome: 'Leads · Formulário Instantâneo', tipo: 'leads' },
  { nome: 'Mensagens · WhatsApp', tipo: 'engajamento' },
  { nome: 'Vendas · Conversões no site', tipo: 'vendas' },
  { nome: 'Remarketing · Visitantes 30d', tipo: 'vendas' },
  { nome: 'Tráfego · Landing Page', tipo: 'trafego' },
  { nome: 'Reconhecimento · Alcance local', tipo: 'reconhecimento' },
] as const

const CPA_ALTO: Record<string, string> = {
  leads: 'Troque o formulário pra "maior intenção", revise as perguntas de qualificação e exclua quem já virou lead.',
  vendas: 'Exclua compradores recentes, revise o público e teste criativos com prova social e oferta clara.',
  trafego: 'Otimize pra conversões em vez de cliques no link — tráfego barato raramente vira resultado.',
  engajamento: 'Qualifique a conversa no primeiro contato (mensagem de boas-vindas com perguntas) e revise o público.',
  reconhecimento: 'Use essa campanha pra alimentar públicos de remarketing, não pra resultado direto.',
}

function getMetrics(clienteId: string, periodo: string): AdsMetricas | null {
  const state = store.getState(clienteId)
  if (state.modo === 'nao_conectado') return null
  const p = periodo.slice(0, 7)
  const base = hash(`meta|${clienteId}|${p}`)

  const investimento = ranged(hash(`${base}inv`), 1500, 20000)
  const impressoes = ranged(hash(`${base}imp`), 60000, 1200000)
  // Frequência típica 1,3–2,8 → alcance = impressões ÷ frequência
  const frequencia = 1.3 + (hash(`${base}freq`) % 150) / 100
  const alcance = Math.round(impressoes / frequencia)
  // CTR (link) típico do Meta: 0,6%–2,5%
  const ctrBase = 0.6 + (hash(`${base}ctr`) % 190) / 100
  const cliques = Math.round((impressoes * ctrBase) / 100)
  const conversoes = ranged(hash(`${base}cv`), 10, Math.max(20, Math.round(cliques * 0.1)))

  return {
    clienteId,
    periodo: p,
    investimento,
    impressoes,
    alcance,
    frequencia: Math.round((impressoes / Math.max(1, alcance)) * 100) / 100,
    cliques,
    ctr: impressoes > 0 ? Math.round((cliques / impressoes) * 10000) / 100 : 0,
    cpcMedio: cliques > 0 ? Math.round((investimento / cliques) * 100) / 100 : 0,
    cpm: impressoes > 0 ? Math.round((investimento / impressoes) * 1000 * 100) / 100 : 0,
    conversoes,
    cpa: conversoes > 0 ? Math.round((investimento / conversoes) * 100) / 100 : 0,
    campanhas: store.comOverrides(
      gerarCampanhasMock({
        clienteId,
        periodo: p,
        base,
        totais: { investimento, impressoes, cliques, conversoes },
        templates: TEMPLATES,
      }),
    ),
    sincronizadoEm: state.ultimaSincronizacao,
  }
}

export const metaAdsAdapter: AdsPlatformAdapter = {
  ...store,
  key: 'meta_ads',
  nome: 'Meta Ads',
  icon: InfinityIcon,
  cores: {
    texto: 'text-indigo-300',
    fundoIcone: 'bg-indigo-500/15',
    badge: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
  },
  textos: {
    modoDiretaLabel: 'Conexão Direta',
    modoAgenciaLabel: 'Via Business Manager da agência',
    botaoDireta: '🔗 Conectar Meta Ads',
    botaoAgencia: '🏢 Vincular via Business Manager (BM)',
    agenciaNome: 'Business Manager (BM)',
    agenciaSigla: 'BM',
    agenciaDefaultId: 'MovMed BM',
    contaPlaceholder: 'act_1234567890',
    descricaoIntegracao:
      'Conecte a conta de anúncios do Meta (Facebook/Instagram Ads) para puxar métricas e campanhas automaticamente (investimento, alcance, resultados, custo por resultado). Há dois caminhos, conforme o acesso disponível.',
    descricaoDireta: 'Simula o Login do Facebook: o cliente autoriza a própria conta de anúncios (act_…) no Meta.',
    descricaoAgencia: (nome) =>
      `Vincula ${nome} ao Business Manager da agência (acesso de parceiro) — sem autorização individual do cliente.`,
    tituloConfig: 'Meta Ads (Business Manager)',
    descricaoConfig:
      'Conexão a nível de agência via Business Manager. Clientes que concederam acesso de parceiro ao BM da agência ficam elegíveis a ter métricas e campanhas puxadas automaticamente (modo BM).',
    notaApiReal:
      'A conexão real depende de um App Meta aprovado (Marketing API, permissão ads_read) + System User do BM (credenciais próprias de cada conta). Esta tela já está pronta — basta trocar a fonte de dados mockada pela chamada real.',
    tipoColuna: 'Objetivo',
    conversoesColuna: 'Resultados',
    cpaLabel: 'Custo por resultado',
  },
  kpis: [
    { key: 'investimento', label: 'Investimento', icon: Wallet, formato: 'moeda', direcao: 'maior', valor: (m) => m.investimento },
    { key: 'alcance', label: 'Alcance', icon: Users, formato: 'numero', direcao: 'maior', valor: (m) => m.alcance },
    { key: 'impressoes', label: 'Impressões', icon: Eye, formato: 'numero', direcao: 'maior', valor: (m) => m.impressoes },
    { key: 'ctr', label: 'CTR (link)', icon: Percent, formato: 'pct', direcao: 'maior', valor: (m) => m.ctr },
    { key: 'cpc', label: 'CPC (link)', icon: Coins, formato: 'moeda', direcao: 'menor', valor: (m) => m.cpcMedio },
    { key: 'cpm', label: 'CPM', icon: Gauge, formato: 'moeda', direcao: 'menor', valor: (m) => m.cpm },
    { key: 'resultados', label: 'Resultados', icon: Target, formato: 'numero', direcao: 'maior', destaque: true, valor: (m) => m.conversoes },
    { key: 'cpr', label: 'Custo por resultado', icon: Receipt, formato: 'moeda', direcao: 'menor', valor: (m) => m.cpa },
  ],
  dicas: {
    semConversao:
      'Confira o Pixel/API de Conversões e se o evento otimizado está disparando. Se estiver ok, pause e reestruture público e criativo.',
    cpaAlto: (tipo) => CPA_ALTO[tipo] ?? 'Revise público e criativos da campanha.',
    tipoOtimCpaAlto: 'ajuste_publico',
    ctrBaixo: () =>
      'Renove os criativos: gancho forte nos 3 primeiros segundos, formato vertical (Reels/Stories) e chamada mais clara.',
    conversaoBaixa:
      'Revise a página/formulário de destino e a coerência entre a promessa do anúncio e a oferta.',
    subentrega: () =>
      'Amplie o público (Advantage+) ou revise o limite de custo/lance — a campanha não está conseguindo entregar.',
    tipoOtimSubentrega: 'ajuste_publico',
    escalar:
      'Aumente o orçamento diário em 20% (no máximo 20–30% por vez, pra não reiniciar a fase de aprendizado).',
    fadiga:
      'O público está vendo os mesmos anúncios repetidamente. Renove os criativos e amplie o público pra evitar fadiga.',
    saudavel: 'Mantenha e teste um criativo novo (teste A/B) pra evitar fadiga futura.',
  },
  tipoCampanhaLabel: (t) => TIPO_LABEL[t] ?? t,
  getMetrics,
}

/**
 * Adapter Google Ads (Google Ads API) — estrutura + simulação.
 *
 * Conexão real exige OAuth + developer token + conta Manager (MCC) OU acesso
 * direto à conta de anúncios do cliente. Cada tenant do SaaS terá as próprias
 * credenciais. `getMetrics` é o ÚNICO ponto a trocar pela API real.
 */
import { Megaphone, Wallet, Eye, MousePointerClick, Percent, Coins, Target, Receipt } from 'lucide-react'
import {
  createAdsConnectionStore,
  gerarCampanhasMock,
  hash,
  ranged,
  type AdsMetricas,
  type AdsPlatformAdapter,
} from './adsPlatform'

// Mesmas chaves do mock original — conexões já feitas continuam valendo.
const store = createAdsConnectionStore({ connKey: 'gads-conn', agencyKey: 'gads-agency' })

const TIPO_LABEL: Record<string, string> = {
  pesquisa: 'Pesquisa',
  display: 'Display',
  pmax: 'Performance Max',
  shopping: 'Shopping',
  video: 'Vídeo',
}
// Nome sempre coerente com o tipo.
const TEMPLATES = [
  { nome: 'Pesquisa · Marca', tipo: 'pesquisa' },
  { nome: 'Pesquisa · Serviços', tipo: 'pesquisa' },
  { nome: 'Pesquisa · Concorrentes', tipo: 'pesquisa' },
  { nome: 'PMax · Conversões', tipo: 'pmax' },
  { nome: 'Display · Remarketing', tipo: 'display' },
  { nome: 'Shopping · Catálogo', tipo: 'shopping' },
  { nome: 'Vídeo · Awareness', tipo: 'video' },
] as const

const CPA_ALTO: Record<string, string> = {
  pesquisa:
    'Negative os termos de pesquisa irrelevantes (relatório de termos) e reduza o lance das palavras-chave com CPA alto.',
  pmax: 'Revise os grupos de recursos e os sinais de público; exclua os termos de marca se a PMax estiver canibalizando a Pesquisa.',
  display: 'Exclua os posicionamentos com baixo desempenho e restrinja a segmentação (públicos de intenção).',
  shopping: 'Segmente os produtos por margem e reduza o lance dos que não convertem.',
  video: 'Mude a estratégia para conversões ou realoque a verba para campanhas de fundo de funil.',
}

function getMetrics(clienteId: string, periodo: string): AdsMetricas | null {
  const state = store.getState(clienteId)
  if (state.modo === 'nao_conectado') return null
  const p = periodo.slice(0, 7)
  const base = hash(`${clienteId}|${p}`)

  const investimento = ranged(hash(`${base}inv`), 1800, 24000)
  const impressoes = ranged(hash(`${base}imp`), 40000, 900000)
  const cliques = ranged(hash(`${base}cli`), 400, 22000)
  const conversoes = ranged(hash(`${base}cv`), 8, Math.max(16, Math.round(cliques * 0.06)))

  return {
    clienteId,
    periodo: p,
    investimento,
    impressoes,
    cliques,
    ctr: impressoes > 0 ? Math.round((cliques / impressoes) * 10000) / 100 : 0,
    cpcMedio: cliques > 0 ? Math.round((investimento / cliques) * 100) / 100 : 0,
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

export const googleAdsAdapter: AdsPlatformAdapter = {
  ...store,
  key: 'google_ads',
  nome: 'Google Ads',
  icon: Megaphone,
  cores: {
    texto: 'text-sky-300',
    fundoIcone: 'bg-sky-500/15',
    badge: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  },
  textos: {
    modoDiretaLabel: 'Conexão Direta',
    modoAgenciaLabel: 'Via Conta Gerenciadora (MCC)',
    botaoDireta: '🔗 Conectar Google Ads',
    botaoAgencia: '🏢 Vincular via Conta Gerenciadora (MCC)',
    agenciaNome: 'Conta Gerenciadora (MCC)',
    agenciaSigla: 'MCC',
    agenciaDefaultId: 'MovMed MCC',
    contaPlaceholder: '123-456-7890',
    descricaoIntegracao:
      'Conecte a conta de anúncios para puxar as métricas e campanhas automaticamente (investimento, cliques, conversões, CPA). Há dois caminhos, conforme o acesso disponível.',
    descricaoDireta: 'Simula o fluxo OAuth: o cliente autoriza a própria conta de anúncios do Google Ads.',
    descricaoAgencia: (nome) =>
      `Vincula ${nome} à Conta Gerenciadora da agência — sem autorização individual do cliente.`,
    tituloConfig: 'Google Ads (Conta Gerenciadora / MCC)',
    descricaoConfig:
      'Conexão a nível de agência. Torna os clientes sob a Conta Gerenciadora elegíveis a ter as métricas e campanhas puxadas automaticamente, sem autorização individual (modo MCC).',
    notaApiReal:
      'A conexão real depende de OAuth + developer token do Google Ads (credenciais próprias de cada conta). Esta tela já está pronta — basta trocar a fonte de dados mockada pela chamada real.',
    tipoColuna: 'Tipo',
    conversoesColuna: 'Conversões',
    cpaLabel: 'CPA',
  },
  kpis: [
    { key: 'investimento', label: 'Investimento', icon: Wallet, formato: 'moeda', direcao: 'maior', valor: (m) => m.investimento },
    { key: 'impressoes', label: 'Impressões', icon: Eye, formato: 'numero', direcao: 'maior', valor: (m) => m.impressoes },
    { key: 'cliques', label: 'Cliques', icon: MousePointerClick, formato: 'numero', direcao: 'maior', valor: (m) => m.cliques },
    { key: 'ctr', label: 'CTR', icon: Percent, formato: 'pct', direcao: 'maior', valor: (m) => m.ctr },
    { key: 'cpc', label: 'CPC Médio', icon: Coins, formato: 'moeda', direcao: 'menor', valor: (m) => m.cpcMedio },
    { key: 'conversoes', label: 'Conversões', icon: Target, formato: 'numero', direcao: 'maior', destaque: true, valor: (m) => m.conversoes },
    { key: 'cpa', label: 'CPA', icon: Receipt, formato: 'moeda', direcao: 'menor', valor: (m) => m.cpa },
  ],
  dicas: {
    semConversao:
      'Confira a ação de conversão (tag do Google Ads/GA4) e os termos de pesquisa que estão gastando. Se o rastreamento estiver ok, pause e reestruture a campanha.',
    cpaAlto: (tipo) => CPA_ALTO[tipo] ?? 'Revise lances e segmentação da campanha.',
    tipoOtimCpaAlto: 'ajuste_lance',
    ctrBaixo: (tipo) =>
      tipo === 'pesquisa'
        ? 'Teste novos títulos e descrições (anúncios responsivos) e adicione recursos: sitelinks, frases de destaque e snippets.'
        : 'Renove os recursos de imagem/vídeo e teste novas mensagens e chamadas.',
    conversaoBaixa:
      'Revise a página de destino (velocidade, clareza da oferta, formulário curto) e o alinhamento entre o anúncio e a página.',
    subentrega: (tipo) =>
      tipo === 'pesquisa'
        ? 'Amplie as palavras-chave (correspondência de frase/ampla) ou aumente os lances — a campanha não está conseguindo gastar.'
        : 'Amplie a segmentação/sinais de público ou aumente o lance — a campanha não está conseguindo gastar.',
    tipoOtimSubentrega: 'ajuste_lance',
    escalar:
      'Aumente o orçamento diário em 20% — a campanha está limitada pelo orçamento com CPA abaixo da média da conta.',
    saudavel: 'Mantenha e rode um teste A/B de anúncio pra buscar ganho incremental.',
  },
  tipoCampanhaLabel: (t) => TIPO_LABEL[t] ?? t,
  getMetrics,
}

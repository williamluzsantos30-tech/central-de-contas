/**
 * Página de preview do PDF de Criação — dados fictícios.
 * Acessar via /preview/criacao-pdf?tipo=copy_lp (ou copy_criativos, planejamento, roteiro)
 * Pública (não precisa de auth) — só pra você ver como o PDF tá ficando.
 */
import { useMemo, useState } from 'react'
import { PDFViewer } from '@react-pdf/renderer'
import { CriacaoPDFDoc } from '@/components/criacoes/CriacaoPDF'
import { PlanejamentoTrafegoPDFDoc } from '@/components/criacoes/PlanejamentoTrafegoPDF'
import type { Cliente, Criacao, PlanejamentoEstrutura, TipoCriacao } from '@/types/database'

const TIPOS: TipoCriacao[] = ['copy_lp', 'copy_criativos', 'planejamento', 'roteiro']

const tipoLabel: Record<TipoCriacao, string> = {
  copy_lp: 'Copy LP',
  copy_criativos: 'Copy Criativos',
  planejamento: 'Planejamento',
  roteiro: 'Roteiro',
}

const conteudoExemplo: Record<TipoCriacao, string> = {
  copy_lp: `[HERO]
Headline: Sua jornada para um sorriso de cinema começa aqui.
Subhead: Tratamentos ortodônticos com tecnologia 3D, planejamento digital e acompanhamento personalizado. Mais de 1.200 sorrisos transformados em São Paulo.
CTA: Agendar avaliação gratuita

[POR QUE NÓS]
• 15 anos de especialização em ortodontia digital
• Alinhadores invisíveis com 98% de previsibilidade
• Plano de tratamento entregue em 7 dias

[PROVA SOCIAL]
"A Dra. Maria mudou completamente minha autoestima. O tratamento foi rápido, confortável e o resultado superou todas as minhas expectativas." — Camila S., paciente

[OFERTA]
Avaliação ortodôntica completa + escaneamento 3D gratuitos esta semana.
Vagas limitadas. Garanta sua avaliação.

[CTA FINAL]
Quero meu sorriso transformado →`,

  copy_criativos: `VARIAÇÃO 1 — Dor / Identificação
"Cansada de esconder o sorriso nas fotos? Você não está sozinha. Mais de 1.200 mulheres descobriram com a Dra. Maria como ter um sorriso confiante em até 12 meses, sem aparelho aparente."

VARIAÇÃO 2 — Prova social
"Camila evitava sorrir há 8 anos. Em 9 meses de tratamento com alinhadores transparentes, ela recuperou a autoestima — e a confiança pra fotografar todos os dias. Veja o antes e depois ↓"

VARIAÇÃO 3 — Urgência
"Vagas pra avaliação ortodôntica gratuita esta semana acabando. Plano de tratamento em 7 dias, tecnologia 3D. Marque agora antes que feche."

VARIAÇÃO 4 — Benefício direto
"Alinhadores invisíveis. 98% de previsibilidade. Avaliação gratuita esta semana. Marque e descubra em 7 dias o plano completo do seu novo sorriso."`,

  planejamento: `OBJETIVO DO MÊS
Gerar 80 leads qualificados pra avaliação ortodôntica gratuita (CPL alvo: R$ 35).

PÚBLICO-ALVO
• Mulheres 28-45 anos
• Renda média/alta (classe A/B)
• Geolocalização: São Paulo capital (raio 15km do consultório)
• Interesses: estética, beleza, autocuidado, fitness

PLATAFORMAS
• Meta Ads (70% do budget) — Instagram + Facebook, foco em Reels e Stories
• Google Ads (30% do budget) — Search "ortodontia invisalign zona sul"

ORÇAMENTO TOTAL: R$ 4.500
• Meta: R$ 3.150
• Google: R$ 1.350

CRIATIVOS PREVISTOS
• 4 reels (depoimentos antes/depois + apresentação Dra)
• 6 estáticos (oferta da semana + prova social + benefícios)
• 2 carrosseis educativos (sobre o tratamento)

KPIs ALVO
• CPL: R$ 35
• CTR: > 2.5%
• Taxa de agendamento (lead → consulta): > 35%`,

  roteiro: `ROTEIRO — REEL "Antes e Depois Camila" (60s)

[0-3s · GANCHO]
Câmera fechada no rosto da Camila, ela cobre a boca rindo.
Texto em tela: "Eu evitava sorrir há 8 ANOS."

[3-10s · IDENTIFICAÇÃO]
Camila olhando pra câmera, conta a história em voz over:
"Toda foto eu tava de boca fechada. Casamento, viagem, aniversário... sempre escondendo. Achava que não tinha jeito porque tinha medo de aparelho."

[10-25s · A VIRADA]
Corte pra consultório, Dra. Maria mostra os alinhadores transparentes.
Camila narra: "Aí descobri os alinhadores invisíveis. Em 7 dias eu tinha o plano completo. E em 9 meses... olha o resultado."

[25-40s · ANTES E DEPOIS]
Sequência de fotos com sorriso aberto, em situações cotidianas.
Texto em tela: "9 MESES · ZERO APARELHO · MUITA CONFIANÇA"

[40-50s · PROVA + AUTORIDADE]
Dra. Maria fala direto pra câmera:
"Tenho 15 anos de ortodontia digital e mais de 1.200 sorrisos transformados. A tecnologia hoje permite tratamentos rápidos, confortáveis e previsíveis."

[50-60s · CTA]
Texto em tela: "AVALIAÇÃO ORTODÔNTICA + ESCANEAMENTO 3D GRATUITOS"
Voz over: "Vagas limitadas essa semana. Link na bio."`,
}

export default function PreviewCriacaoPDF() {
  const [tipo, setTipo] = useState<TipoCriacao>('copy_lp')

  const cliente = useMemo<Cliente>(
    () =>
      ({
        id: 'fake-cliente',
        nome: tipo === 'planejamento' ? 'GB Modas' : 'Dra. Maria Adélia Ortodontia',
        nicho: tipo === 'planejamento' ? 'Moda Feminina' : 'Saúde · Ortodontia',
        plataformas: ['meta_ads', 'google_ads'],
        status: 'ativo',
        squad: 'BlackOps',
        jornada_social: 'planejamento',
        observacoes: null,
        instagram_handle: '@dramaria.ortodontia',
        modulos: ['trafego'],
        gestor_id: null,
        account_manager_id: null,
        social_media_id: null,
        identidade_visual_urls: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as unknown as Cliente),
    [tipo],
  )

  const estruturaPlanejamentoFake = useMemo<PlanejamentoEstrutura>(
    () => ({
      diagnostico: {
        pontos_fortes: [
          'Conteúdo orgânico forte',
          'Loja com boa variedade de produtos',
          'Produção de vídeos consistente',
          'Equipe participativa',
          'Boa demanda física',
          'Grupo VIP ativo',
          'Entrega rápida na cidade',
        ],
        oportunidades: [
          'Escalar vendas através do tráfego pago',
          'Atrair novas clientes além da base atual',
          'Melhorar conversão do WhatsApp',
          'Explorar mais eventos e sazonalidades',
          'Fortalecer campanhas com vídeos humanizados',
        ],
        desafios: [
          'Pouca consistência em campanhas pagas',
          'Atendimento WhatsApp manual e demorado',
          'Concorrência local agressiva em moda',
        ],
      },
      campanhas: [
        {
          titulo: 'Campanha 1: Captação de Seguidores',
          subtitulo: 'Reconhecimento de marca',
          objetivo:
            'Aumentar seguidores qualificados no Instagram e fortalecer o reconhecimento da marca na cidade.',
          publico:
            'Mulheres 25-40 anos, interesse em moda feminina, tendências, looks para shows e eventos. Geolocalização: cidade da loja + raio 30km.',
          criativos: [
            'Provador',
            '"1 peça, 3 looks"',
            'Bastidores da loja',
            'Vídeos casuais nos stories',
            'Looks para eventos e shows',
            'Trends e modinhas',
          ],
          formatos: ['Reels (70%)', 'Stories (20%)', 'Carrossel (10%)'],
        },
        {
          titulo: 'Campanha 2: Conversão WhatsApp',
          subtitulo: 'Geração de vendas qualificadas',
          objetivo: 'Gerar conversas qualificadas e aumentar vendas no WhatsApp.',
          publico:
            'Mulheres 25-40 anos que já interagiram com o perfil ou visitaram a loja. Foco em remarketing.',
          criativos: [
            '"Me chama no WhatsApp e garanta seu look"',
            'Looks para show e eventos',
            'Novidades da semana',
            'Combos promocionais',
            'Vestidos (produto forte da loja)',
            'Peças tendência',
          ],
          formatos: ['Click-to-WhatsApp', 'Anúncio com botão de mensagem', 'Carrossel de produtos'],
        },
      ],
      estrategias: [
        {
          titulo: 'Explorar Eventos da Cidade',
          descricao: 'Shows e eventos locais aumentam muito as vendas',
          bullets: ['Looks para evento', 'Produção completa', 'Urgência de compra'],
        },
        {
          titulo: 'Aproveitar Sazonalidades',
          descricao: 'Datas comemorativas e estações geram picos de demanda',
          bullets: ['Dia das Mães', 'Festa Junina', 'Black Friday', 'Natal'],
        },
        {
          titulo: 'Conteúdo Humanizado',
          descricao: 'Vídeos com a vendedora geram conexão e confiança',
          bullets: ['Apresentação de looks', 'Dicas de combinação', 'Depoimentos'],
        },
      ],
    }),
    [],
  )

  const criacao = useMemo<Criacao>(
    () =>
      ({
        id: 'fake-criacao',
        cliente_id: 'fake-cliente',
        tipo,
        titulo:
          tipo === 'copy_lp'
            ? 'LP Avaliação Ortodôntica — Maio 2026'
            : tipo === 'copy_criativos'
              ? 'Variações Reels — Camila Antes e Depois'
              : tipo === 'planejamento'
                ? 'Planejamento Meta Ads · Maio 2026'
                : 'Reel Antes e Depois — Camila',
        briefing:
          'Cliente: Dra. Maria Adélia (ortodontia). Quer atrair pacientes para avaliação ortodôntica gratuita. Diferenciais: 15 anos de experiência, alinhadores invisíveis, plano de tratamento entregue em 7 dias. Tom: confiante, acolhedor, focado em prova social.',
        prompt: null,
        anexos: null,
        conteudo: conteudoExemplo[tipo],
        planejamento_estrutura: tipo === 'planejamento' ? estruturaPlanejamentoFake : null,
        status: 'aprovado',
        responsavel_id: null,
        enviado_para_producao_em: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Criacao),
    [tipo, estruturaPlanejamentoFake],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0a' }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: 12,
          background: '#171717',
          borderBottom: '1px solid #333',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#a3a3a3', fontSize: 12, marginRight: 8 }}>
          Preview do PDF — dados fictícios
        </span>
        {TIPOS.map((t) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: tipo === t ? '#f97316' : '#333',
              background: tipo === t ? 'rgba(249,115,22,0.15)' : 'transparent',
              color: tipo === t ? '#fb923c' : '#a3a3a3',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {tipoLabel[t]}
          </button>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <PDFViewer width="100%" height="100%" style={{ border: 0 }}>
          {tipo === 'planejamento' ? (
            <PlanejamentoTrafegoPDFDoc cliente={cliente} criacao={criacao} />
          ) : (
            <CriacaoPDFDoc cliente={cliente} criacao={criacao} />
          )}
        </PDFViewer>
      </div>
    </div>
  )
}

import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/layout/Layout'
import Login from '@/pages/Login'
import Clientes from '@/pages/Clientes'
import ClienteDetalhe from '@/pages/ClienteDetalhe'
import MinhasTarefas from '@/pages/MinhasTarefas'
import Admin from '@/pages/Admin'
import ClientesTrafego from '@/pages/trafego/ClientesTrafego'
import ProjetosWebdesign from '@/pages/webdesign/ProjetosWebdesign'
import CriativosWebdesign from '@/pages/webdesign/CriativosWebdesign'
import EdicaoVideo from '@/pages/webdesign/EdicaoVideo'
import SocialMedia from '@/pages/webdesign/SocialMedia'
import AgendaSocialMedia from '@/pages/social/Agenda'
import SocialClientes from '@/pages/social/Clientes'
import HeadSocial from '@/pages/social/HeadSocial'
import CalendarioPostagens from '@/pages/social/Calendario'
import PreviewCriacaoPDF from '@/pages/PreviewCriacaoPDF'
import PublicoCalendario from '@/pages/PublicoCalendario'
import PublicoNps from '@/pages/PublicoNps'
import PublicoPortal from '@/pages/PublicoPortal'
import PreviewCriacoesPanel from '@/pages/PreviewCriacoesPanel'
import PreviewEdicaoVideo from '@/pages/PreviewEdicaoVideo'
import VisaoExecutiva from '@/pages/operacional/VisaoExecutiva'
import Onboarding from '@/pages/clientes/Onboarding'
import Churns from '@/pages/clientes/churns/Churns'
import Renovacoes from '@/pages/clientes/renovacoes/Renovacoes'
import CentralOperacional from '@/pages/central-operacional/CentralOperacional'
import SetorDetalhe from '@/pages/central-operacional/SetorDetalhe'
import DocumentoDetalhe from '@/pages/central-operacional/DocumentoDetalhe'
import { CentralOperacionalProvider } from '@/pages/central-operacional/store'
import Flags from '@/pages/flags/Flags'
import ColaboradorDetalhe from '@/pages/flags/ColaboradorDetalhe'
import { FlagsProvider } from '@/pages/flags/store'
import VisaoExecutivaComercial from '@/pages/comercial/VisaoExecutivaComercial'
import MarketingFunnelPanel from '@/pages/comercial/MarketingFunnelPanel'
import MetasPanel from '@/pages/comercial/MetasPanel'
import SocialSelling from '@/pages/comercial/SocialSelling'
import CaixaEntrada from '@/pages/comercial/CaixaEntrada'
import SDR from '@/pages/comercial/SDR'
import CadastrarLeadQualificado from '@/pages/comercial/CadastrarLeadQualificado'
import Closer from '@/pages/comercial/Closer'
import { ComercialProvider } from '@/pages/comercial/store'
import Despesas from '@/pages/financeiro/Despesas'
import DRE from '@/pages/financeiro/DRE'
import DreSetor from '@/pages/financeiro/DreSetor'
import FluxoCaixa from '@/pages/financeiro/FluxoCaixa'
import { FinanceiroProvider } from '@/pages/financeiro/store'
import Configuracoes from '@/pages/configuracoes/Configuracoes'
import { RequirePermissao } from '@/components/auth/RequirePermissao'
import { PERM } from '@/hooks/usePermissoes'

function Protected({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth()
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-muted text-sm">
        Carregando...
      </div>
    )
  if (!session) return <Navigate to="/login" replace />
  return children
}

function AdminOnly({ children }: { children: JSX.Element }) {
  const { profile } = useAuth()
  if (profile?.role !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Calendário público do cliente — link compartilhável, sem login */}
          <Route path="/publico/calendario/:token" element={<PublicoCalendario />} />
          <Route path="/publico/nps/:token" element={<PublicoNps />} />
          <Route path="/publico/portal/:token" element={<PublicoPortal />} />
          <Route path="/preview/criacao-pdf" element={<PreviewCriacaoPDF />} />
          <Route path="/preview/criacoes-panel" element={<PreviewCriacoesPanel />} />
          <Route path="/preview/edicao-video" element={<PreviewEdicaoVideo />} />
          <Route
            element={
              <Protected>
                {/* Providers acima do Layout: o Lead (Comercial) e as Despesas
                    (Financeiro) são compartilhados entre suas telas E a aba
                    Integrações em Configurações (que injeta leads/despesas via
                    webhook simulado). */}
                <ComercialProvider>
                  <FinanceiroProvider>
                    <Layout />
                  </FinanceiroProvider>
                </ComercialProvider>
              </Protected>
            }
          >
            {/* Dashboard removido — raiz abre a lista de clientes. */}
            <Route path="/" element={<Navigate to="/clientes" replace />} />
            <Route path="/operacional/visao" element={<VisaoExecutiva />} />
            <Route path="/clientes/onboarding" element={<Onboarding />} />
            <Route path="/clientes/churns" element={<Churns />} />
            <Route path="/clientes/renovacoes" element={<Renovacoes />} />
            {/* Central Operacional — provider acima das 2 telas pra o estado
                (docs criados) sobreviver à navegação entre elas. */}
            <Route
              element={
                <CentralOperacionalProvider>
                  <Outlet />
                </CentralOperacionalProvider>
              }
            >
              <Route path="/central-operacional" element={<CentralOperacional />} />
              <Route path="/central-operacional/:setorId" element={<SetorDetalhe />} />
              <Route path="/central-operacional/:setorId/:docId" element={<DocumentoDetalhe />} />
            </Route>
            {/* Gestão de Flags — provider acima das 2 telas */}
            <Route
              element={
                <FlagsProvider>
                  <Outlet />
                </FlagsProvider>
              }
            >
              <Route path="/flags" element={<Flags />} />
              <Route path="/flags/:colabId" element={<ColaboradorDetalhe />} />
            </Route>
            {/* Comercial — funil Caixa de Entrada → SDR → Closer (+ Social
                Selling alimentando a Caixa). Provider está acima do Layout. */}
            <Route path="/comercial/visao" element={<VisaoExecutivaComercial />} />
            <Route path="/comercial/social-selling" element={<SocialSelling />} />
            <Route path="/comercial/caixa-entrada" element={<CaixaEntrada />} />
            <Route path="/comercial/sdr" element={<SDR />} />
            <Route path="/comercial/sdr/qualificar/:id" element={<CadastrarLeadQualificado />} />
            <Route path="/comercial/closer" element={<Closer />} />
            <Route path="/comercial/marketing" element={<MarketingFunnelPanel />} />
            <Route path="/comercial/metas" element={<MetasPanel />} />
            {/* Financeiro — Despesas (base) + DRE + Fluxo de Caixa (derivados) */}
            <Route path="/financeiro/despesas" element={<Despesas />} />
            <Route path="/financeiro/dre" element={<DRE />} />
            <Route path="/financeiro/dre-setor" element={<DreSetor />} />
            <Route path="/financeiro/fluxo-caixa" element={<FluxoCaixa />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route
              path="/clientes"
              element={
                <RequirePermissao perm={PERM.visualizar}>
                  <Clientes />
                </RequirePermissao>
              }
            />
            <Route
              path="/clientes/:id"
              element={
                <RequirePermissao perm={PERM.visualizar}>
                  <ClienteDetalhe />
                </RequirePermissao>
              }
            />
            {/* Execução › Tráfego = visão especializada (Gestor de Tráfego,
                Verba, Call Alinhamento + KPIs). Filtra por gestor_id != null;
                criação só na página Clientes. */}
            <Route
              path="/trafego/clientes"
              element={
                <RequirePermissao perm={PERM.visualizar}>
                  <ClientesTrafego />
                </RequirePermissao>
              }
            />
            <Route path="/minhas-tarefas" element={<MinhasTarefas />} />
            <Route path="/webdesign/projetos" element={<ProjetosWebdesign />} />
            <Route path="/webdesign/criativos" element={<CriativosWebdesign />} />
            <Route path="/webdesign/edicao-video" element={<EdicaoVideo />} />
            <Route path="/webdesign/social-media" element={<SocialMedia />} />
            <Route path="/social" element={<AgendaSocialMedia />} />
            <Route path="/social/agenda" element={<AgendaSocialMedia />} />
            <Route path="/social/head" element={<HeadSocial />} />
            {/* Execução › Social Media = visão especializada (Publicações do
                mês, Apresentar próximo plano, Relatório semanal). Filtra por
                social_media_id != null. Criação só na página Clientes. */}
            <Route
              path="/social/clientes"
              element={
                <RequirePermissao perm={PERM.visualizar}>
                  <SocialClientes />
                </RequirePermissao>
              }
            />
            <Route
              path="/social/clientes/:id"
              element={
                <RequirePermissao perm={PERM.visualizar}>
                  <ClienteDetalhe />
                </RequirePermissao>
              }
            />
            <Route path="/social/calendario" element={<CalendarioPostagens />} />
            {/* Métricas saíram do Operacional Social Media e viraram tab no Admin.
                Mantém redirect pra qualquer link antigo. */}
            <Route path="/social/metricas" element={<Navigate to="/admin" replace />} />
            <Route
              path="/templates"
              element={<Navigate to="/admin" replace />}
            />
            <Route
              path="/admin"
              element={
                <AdminOnly>
                  <Admin />
                </AdminOnly>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

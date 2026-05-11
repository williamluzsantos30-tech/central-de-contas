import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/layout/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Clientes from '@/pages/Clientes'
import ClienteDetalhe from '@/pages/ClienteDetalhe'
import MinhasTarefas from '@/pages/MinhasTarefas'
import Admin from '@/pages/Admin'
import ProjetosWebdesign from '@/pages/webdesign/ProjetosWebdesign'
import CriativosWebdesign from '@/pages/webdesign/CriativosWebdesign'
import SocialMedia from '@/pages/webdesign/SocialMedia'
import AgendaSocialMedia from '@/pages/social/Agenda'
import SocialClientes from '@/pages/social/Clientes'
import CalendarioPostagens from '@/pages/social/Calendario'

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
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/:id" element={<ClienteDetalhe />} />
            <Route path="/minhas-tarefas" element={<MinhasTarefas />} />
            <Route path="/webdesign/projetos" element={<ProjetosWebdesign />} />
            <Route path="/webdesign/criativos" element={<CriativosWebdesign />} />
            <Route path="/webdesign/social-media" element={<SocialMedia />} />
            <Route path="/social" element={<AgendaSocialMedia />} />
            <Route path="/social/agenda" element={<AgendaSocialMedia />} />
            <Route path="/social/clientes" element={<SocialClientes />} />
            <Route path="/social/clientes/:id" element={<ClienteDetalhe />} />
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

import { lazy, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { NotificationsProvider } from './lib/notifications'
import { AccountsProvider } from './lib/accounts'
import { setUnauthorizedHandler } from './lib/api'
import { ToastProvider } from './components/toast'
import { Layout } from './components/Layout'
import { Skeleton } from './components/ui'
import LoginPage from './pages/LoginPage'
import { ForbiddenPage, NotFoundPage } from './pages/ErrorPages'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const AccountsPage = lazy(() => import('./pages/AccountsPage'))
const MediaPage = lazy(() => import('./pages/MediaPage'))
const PostsPage = lazy(() => import('./pages/PostsPage'))
const PostEditorPage = lazy(() => import('./pages/PostEditorPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'))
const BatchesPage = lazy(() => import('./pages/BatchesPage'))
const BatchDetailPage = lazy(() => import('./pages/BatchesPage').then((m) => ({ default: m.BatchDetailPage })))
const BatchNewPage = lazy(() => import('./pages/BatchNewPage'))
const AutomationsPage = lazy(() => import('./pages/AutomationsPage'))
const AutomationEditorPage = lazy(() => import('./pages/AutomationEditorPage'))
const AutomationDetailPage = lazy(() => import('./pages/AutomationDetailPage'))

function SessionWatcher() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      const next = encodeURIComponent(location.pathname + location.search)
      navigate(`/login?expirou=1&next=${next}`, { replace: true })
    })
  }, [navigate, location, setUser])
  return null
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading)
    return (
      <div className="p-8" role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-40 w-full max-w-xl" />
      </div>
    )
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  return user?.role === 'admin' ? <>{children}</> : <ForbiddenPage />
}

export default function App() {
  return (
    <BrowserRouter basename="/ig">
      <AuthProvider>
        <ToastProvider>
          <SessionWatcher />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <RequireAuth>
                  <NotificationsProvider>
                    <AccountsProvider>
                      <Layout />
                    </AccountsProvider>
                  </NotificationsProvider>
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="contas" element={<AccountsPage />} />
              <Route path="midias" element={<MediaPage />} />
              <Route path="publicacoes" element={<PostsPage />} />
              <Route path="publicacoes/nova" element={<PostEditorPage />} />
              <Route path="publicacoes/:id" element={<PostEditorPage key="edit" />} />
              <Route path="lotes" element={<BatchesPage />} />
              <Route path="lotes/novo" element={<BatchNewPage />} />
              <Route path="lotes/:id" element={<BatchDetailPage />} />
              <Route path="automacoes" element={<AutomationsPage />} />
              <Route path="automacoes/nova" element={<AutomationEditorPage />} />
              <Route path="automacoes/:id" element={<AutomationDetailPage />} />
              <Route path="automacoes/:id/editar" element={<AutomationEditorPage key="edit" />} />
              <Route path="analise" element={<AnalysisPage />} />
              <Route path="avisos" element={<NotificationsPage />} />
              <Route path="configuracoes" element={<SettingsPage />} />
              <Route
                path="admin"
                element={
                  <RequireAdmin>
                    <AdminPage />
                  </RequireAdmin>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

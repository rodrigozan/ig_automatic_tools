import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { NotificationsProvider } from './lib/notifications'
import { AccountsProvider } from './lib/accounts'
import { setUnauthorizedHandler } from './lib/api'
import { ToastProvider } from './components/toast'
import { Layout } from './components/Layout'
import { Skeleton } from './components/ui'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import AdminPage from './pages/AdminPage'
import AccountsPage from './pages/AccountsPage'
import MediaPage from './pages/MediaPage'
import PostsPage from './pages/PostsPage'
import PostEditorPage from './pages/PostEditorPage'
import NotificationsPage from './pages/NotificationsPage'
import BatchesPage, { BatchDetailPage } from './pages/BatchesPage'
import BatchNewPage from './pages/BatchNewPage'
import AutomationsPage from './pages/AutomationsPage'
import AutomationEditorPage from './pages/AutomationEditorPage'
import AutomationDetailPage from './pages/AutomationDetailPage'
import { ForbiddenPage, NotFoundPage } from './pages/ErrorPages'

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

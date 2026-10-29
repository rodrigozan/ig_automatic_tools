import { AppBrand } from './AppBrand'
import { APP_NAME } from '../lib/appConfig'
import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, Bell, CalendarDays, Images, Camera, LayoutDashboard, Layers, LogOut, Menu, MessageCircle, Settings, Shield, WifiOff, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { ThemeSwitcher } from './ThemeSwitcher'
import { NotificationBell } from './NotificationBell'
import { ErrorBoundary } from './ErrorBoundary'
import { Skeleton } from './ui'

type NavItem = { to: string; label: string; Icon: typeof Bell; admin?: boolean }

export const navItems: NavItem[] = [
  { to: '/', label: 'Painel', Icon: LayoutDashboard },
  { to: '/publicacoes', label: 'Publicações', Icon: CalendarDays },
  { to: '/lotes', label: 'Lotes', Icon: Layers },
  { to: '/midias', label: 'Mídias', Icon: Images },
  { to: '/automacoes', label: 'Automações de DM', Icon: MessageCircle },
  { to: '/analise', label: 'Análise de perfis', Icon: BarChart3 },
  { to: '/contas', label: 'Contas do Instagram', Icon: Camera },
  { to: '/avisos', label: 'Avisos', Icon: Bell },
  { to: '/configuracoes', label: 'Configurações', Icon: Settings },
  { to: '/admin', label: 'Admin', Icon: Shield, admin: true },
]

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  return (
    <nav aria-label="Principal" className="flex flex-col gap-0.5">
      {navItems
        .filter((i) => !i.admin || user?.role === 'admin')
        .map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex h-[34px] max-md:h-11 items-center gap-2.5 rounded-control px-2.5 text-sm ${
                isActive ? 'bg-nav-active-bg font-medium text-nav-active-text' : 'text-nav-text hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} aria-hidden className={isActive ? 'text-nav-icon-active' : ''} />
                {label}
              </>
            )}
          </NavLink>
        ))}
    </nav>
  )
}

function UserBox() {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <div className="flex items-center gap-2 border-t border-border pt-3">
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-raised text-xs font-medium">{user.name.slice(0, 1)}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-faint">{user.email}</p>
      </div>
      <button onClick={logout} aria-label="Sair" title="Sair" className="flex h-9 w-9 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-ink">
        <LogOut size={16} />
      </button>
    </div>
  )
}

export function Layout({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const online = useOnline()
  const location = useLocation()
  const current = navItems.find((i) => (i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to)))

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
  }, [open])

  return (
    <div className="min-h-screen md:flex">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-surface focus:p-2">
        Pular para o conteúdo
      </a>
      <aside className="sticky top-0 hidden h-screen w-[230px] shrink-0 flex-col gap-4 border-r border-border bg-surface px-3 py-5 md:flex">
        <div className="flex items-center gap-2 px-2.5">
          <AppBrand />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>
        <ThemeSwitcher compact />
        <UserBox />
      </aside>

      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-surface px-2 md:hidden">
        <button aria-label="Abrir menu" aria-expanded={open} onClick={() => setOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-control">
          <Menu size={20} />
        </button>
        <span className="font-semibold">{current?.label ?? APP_NAME}</span>
        <NotificationBell />
      </header>

      {open && (
        <div className="fixed inset-0 z-40 flex flex-col gap-4 overflow-y-auto bg-surface px-4 py-3 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex items-center justify-between">
            <AppBrand />
            <button aria-label="Fechar menu" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-control">
              <X size={20} />
            </button>
          </div>
          <NavList onNavigate={() => setOpen(false)} />
          <ThemeSwitcher />
          <UserBox />
        </div>
      )}

      <div className="min-w-0 flex-1">
        {!online && (
          <div role="status" className="sticky top-0 z-20 flex items-center gap-2 bg-tag-warning-bg px-4 py-2 text-sm text-tag-warning-text">
            <WifiOff size={16} aria-hidden /> Sem conexão. Tentando de novo...
          </div>
        )}
        <header className="hidden h-12 items-center justify-end px-8 md:flex">
          <NotificationBell />
        </header>
        <main id="conteudo" className="mx-auto max-w-[1280px] px-4 pt-8 pb-16 md:px-8 md:pt-2">
          <fieldset disabled={!online} className="contents">
            <ErrorBoundary resetKey={location.pathname}>
              <Suspense
                fallback={
                  <div role="status" aria-label="Carregando">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="mt-6 h-40 w-full" />
                  </div>
                }
              >
                {children ?? <Outlet />}
              </Suspense>
            </ErrorBoundary>
          </fieldset>
        </main>
      </div>
    </div>
  )
}

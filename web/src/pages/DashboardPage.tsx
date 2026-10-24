import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, Plus } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useAccounts } from '../lib/accounts'
import { useNotifications } from '../lib/notifications'
import { useFetch } from '../lib/useFetch'
import { formatDateTime, zonedParts, zonedToUtc } from '../lib/format'
import type { Post } from '../lib/types'
import { Button, Card, EmptyState, ErrorCard, PageHeader, PostStatusTag, Skeleton, StatTile } from '../components/ui'
import { ReconnectBanners } from '../components/AccountBanners'
import { WeekCalendar, addDays, startOfWeek } from '../components/WeekCalendar'
import { ConnectButton } from './AccountsPage'
import { NotificationRow, useNotificationActions } from './NotificationsPage'

type Dashboard = {
  stats: { weekPosts: number; next24h: number; failed: number; connectedAccounts: number; accountsNeedingReconnect: number; unreadNotifications: number }
  upcoming: Post[]
}

const typeLabel = { post: 'Post', reel: 'Reel', carousel: 'Carrossel' }

export default function DashboardPage() {
  const { user } = useAuth()
  const tz = user?.timezone ?? 'America/Sao_Paulo'
  const navigate = useNavigate()
  const { accounts, loading: accLoading } = useAccounts()
  const { items: notifications } = useNotifications()
  const { read } = useNotificationActions()
  const dash = useFetch<Dashboard>('/dashboard')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(zonedParts(new Date(), tz).date))
  const week = useFetch<Post[]>(`/posts?from=${encodeURIComponent(zonedToUtc(weekStart, '00:00', tz))}&to=${encodeURIComponent(zonedToUtc(addDays(weekStart, 7), '00:00', tz))}&status=draft,scheduled,publishing,published,failed`)

  const firstName = user?.name.split(' ')[0] ?? ''
  const noAccounts = !accLoading && accounts.length === 0
  const unread = notifications.filter((n) => !n.readAt).slice(0, 5)

  return (
    <div>
      <PageHeader
        title={`Olá, ${firstName}`}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/publicacoes/nova')}>
            Nova publicação
          </Button>
        }
      />
      <ReconnectBanners />

      {noAccounts && (
        <Card className="mb-4 flex flex-col items-start gap-3 p-5">
          <Camera size={20} className="text-brand" aria-hidden />
          <h2 className="text-lg font-semibold">Conecte sua conta do Instagram</h2>
          <p className="text-muted">Conecte uma conta profissional (Creator ou Business) para agendar publicações e automatizar DMs.</p>
          <ConnectButton label="Conectar" />
        </Card>
      )}

      {dash.error ? (
        <div className="mb-4">
          <ErrorCard onRetry={dash.reload} />
        </div>
      ) : (
        <Card className="mb-4 grid grid-cols-2 md:grid-cols-4 md:divide-x md:divide-border">
          {dash.loading || !dash.data ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-7 w-12" />
              </div>
            ))
          ) : (
            <>
              <StatTile label="Publicações da semana" value={dash.data.stats.weekPosts} />
              <StatTile label="Próximas 24 horas" value={dash.data.stats.next24h} />
              <StatTile label="Falhas" value={<span className={dash.data.stats.failed ? 'text-negative' : ''}>{dash.data.stats.failed}</span>} />
              <StatTile label="Contas conectadas" value={dash.data.stats.connectedAccounts} />
            </>
          )}
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_384px]">
        <Card className="min-w-0">
          {week.error ? (
            <div className="p-5">
              <ErrorCard onRetry={week.reload} />
            </div>
          ) : week.loading && !week.data ? (
            <div className="p-5">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <WeekCalendar weekStart={weekStart} onChange={setWeekStart} posts={week.data ?? []} accounts={accounts} timeZone={tz} />
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-semibold">Próximas publicações</h2>
              <Link to="/publicacoes" className="text-sm font-medium text-brand underline">
                Ver todas
              </Link>
            </div>
            {dash.loading ? (
              <div className="p-5">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : !dash.data?.upcoming.length ? (
              <EmptyState
                text="Nenhuma publicação agendada"
                action={
                  <Button variant="primary" onClick={() => navigate('/publicacoes/nova')}>
                    Nova publicação
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {dash.data.upcoming.map((p) => (
                  <li key={p.id}>
                    <Link to={`/publicacoes/${p.id}`} className="flex min-h-[45px] items-center gap-3 px-5 py-2 hover:bg-raised">
                      <span className="w-24 text-sm font-medium tabular-nums">{formatDateTime(p.scheduledAt, tz)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-muted">
                        {typeLabel[p.type]} · @{accounts.find((a) => a.id === p.accountId)?.username ?? '—'}
                      </span>
                      <PostStatusTag status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-semibold">Avisos</h2>
              <Link to="/avisos" className="text-sm font-medium text-brand underline">
                Ver todos
              </Link>
            </div>
            {unread.length === 0 ? (
              <EmptyState text="Nenhum aviso" />
            ) : (
              <ul className="divide-y divide-border">
                {unread.map((n) => (
                  <NotificationRow key={n.id} n={n} onRead={() => read(n)} compact />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

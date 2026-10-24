import { Link } from 'react-router-dom'
import { AlertCircle, AlertTriangle, Check, KeyRound, MessageCircleWarning, Trash2 } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useNotifications, type Notification } from '../lib/notifications'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/format'
import { Button, Card, EmptyState, ErrorCard, PageHeader, SkeletonList, Tag } from '../components/ui'
import { useToast } from '../components/toast'

const meta: Record<string, { label: string; Icon: typeof AlertCircle; tone: 'error' | 'warning' }> = {
  publish_failed: { label: 'Publicação falhou', Icon: AlertCircle, tone: 'error' },
  token_expiring: { label: 'Conta a reconectar', Icon: KeyRound, tone: 'warning' },
  limit_near: { label: 'Perto do limite', Icon: AlertTriangle, tone: 'warning' },
  dm_failed: { label: 'DM falhou', Icon: MessageCircleWarning, tone: 'error' },
}

export function notificationLink(n: Notification) {
  if (n.type === 'publish_failed' && n.refId) return `/publicacoes/${n.refId}`
  if (n.type === 'dm_failed' && n.refId) return `/automacoes/${n.refId}`
  if (n.type === 'token_expiring' || n.type === 'limit_near') return '/contas'
  return null
}

export function NotificationRow({ n, onRead, onDelete, compact }: { n: Notification; onRead?: () => void; onDelete?: () => void; compact?: boolean }) {
  const { user } = useAuth()
  const m = meta[n.type] ?? meta.publish_failed
  const link = notificationLink(n)
  return (
    <li className={`flex items-start gap-3 px-5 py-3 ${n.readAt ? '' : 'bg-brand-soft/40'}`}>
      <m.Icon size={16} className={`mt-0.5 shrink-0 ${m.tone === 'error' ? 'text-negative' : 'text-warning'}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone={m.tone}>{m.label}</Tag>
          {!n.readAt && <span className="text-xs font-medium text-brand">Não lido</span>}
          <span className="text-xs text-faint tabular-nums">{formatDateTime(n.createdAt, user?.timezone ?? 'UTC')}</span>
        </div>
        <p className="mt-1 text-sm">{n.message}</p>
        {link && (
          <Link to={link} onClick={onRead} className="mt-1 inline-block text-sm font-medium text-brand underline">
            {n.type === 'publish_failed' ? 'Reagendar' : 'Abrir'}
          </Link>
        )}
      </div>
      {!compact && (
        <div className="flex gap-1">
          {!n.readAt && onRead && <Button variant="ghost" aria-label="Marcar como lido" title="Marcar como lido" onClick={onRead} icon={<Check size={14} />} />}
          {onDelete && <Button variant="ghost" aria-label="Apagar aviso" title="Apagar" onClick={onDelete} icon={<Trash2 size={14} />} />}
        </div>
      )}
    </li>
  )
}

export function useNotificationActions() {
  const { reload } = useNotifications()
  const toast = useToast()
  const read = async (n: Notification) => {
    if (n.readAt) return
    try {
      await api.patch(`/notifications/${n.id}/read`)
      await reload()
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    }
  }
  const remove = async (n: Notification) => {
    try {
      await api.delete(`/notifications/${n.id}`)
      await reload()
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    }
  }
  return { read, remove }
}

export default function NotificationsPage() {
  const { items, loading, error, reload } = useNotifications()
  const { read, remove } = useNotificationActions()
  const unread = items.filter((n) => !n.readAt)
  return (
    <div>
      <PageHeader
        title="Avisos"
        description="Falhas de publicação, contas a reconectar, limites da Meta e DMs com problema."
        actions={unread.length > 0 ? <Button onClick={() => Promise.all(unread.map(read))}>Marcar todos como lidos</Button> : undefined}
      />
      <Card>
        {loading ? (
          <SkeletonList />
        ) : error ? (
          <div className="p-5">
            <ErrorCard onRetry={reload} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState text="Nenhum aviso" />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <NotificationRow key={n.id} n={n} onRead={() => read(n)} onDelete={() => remove(n)} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

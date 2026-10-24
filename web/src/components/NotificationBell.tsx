import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotifications } from '../lib/notifications'

export function NotificationBell() {
  const { unread } = useNotifications()
  return (
    <Link
      to="/avisos"
      aria-label={unread > 0 ? `Avisos, ${unread} não lidos` : 'Avisos'}
      className="relative flex h-11 w-11 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-ink md:h-9 md:w-9"
    >
      <Bell size={18} />
      {unread > 0 && (
        <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-surface tabular-nums">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}

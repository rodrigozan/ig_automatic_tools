import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import { useAuth } from './auth'

export type Notification = { id: string; type: string; message: string; refId?: string; readAt?: string; createdAt: string }

type State = { items: Notification[]; unread: number; reload: () => Promise<void>; loading: boolean; error: boolean }

const Ctx = createContext<State>({ items: [], unread: 0, reload: async () => {}, loading: false, error: false })

export function useNotifications() {
  return useContext(Ctx)
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const reload = useCallback(async () => {
    try {
      const r = await api.get<Notification[]>('/notifications')
      setItems(r.data)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    reload()
    const t = setInterval(reload, 60_000)
    return () => clearInterval(t)
  }, [user, reload])

  return <Ctx.Provider value={{ items, unread: items.filter((i) => !i.readAt).length, reload, loading, error }}>{children}</Ctx.Provider>
}

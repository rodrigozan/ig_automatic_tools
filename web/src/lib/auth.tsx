import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import type { User } from './types'

type AuthState = {
  user: User | null
  loading: boolean
  refresh: () => Promise<void>
  setUser: (u: User | null) => void
  logout: () => Promise<void>
}

const Ctx = createContext<AuthState>({ user: null, loading: true, refresh: async () => {}, setUser: () => {}, logout: async () => {} })

export function useAuth() {
  return useContext(Ctx)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const r = await api.get<User>('/auth/me')
      setUser(r.data)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {})
    setUser(null)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return <Ctx.Provider value={{ user, loading, refresh, setUser, logout }}>{children}</Ctx.Provider>
}

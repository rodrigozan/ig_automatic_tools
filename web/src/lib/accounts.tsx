import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import type { Account } from './types'

type State = { accounts: Account[]; loading: boolean; error: boolean; reload: () => Promise<void> }

const Ctx = createContext<State>({ accounts: [], loading: true, error: false, reload: async () => {} })

export function useAccounts() {
  return useContext(Ctx)
}

export function AccountsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const reload = useCallback(async () => {
    try {
      const r = await api.get<Account[]>('/instagram/accounts')
      setAccounts(r.data)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    if (user) reload()
  }, [user, reload])
  return <Ctx.Provider value={{ accounts, loading, error, reload }}>{children}</Ctx.Provider>
}

export const connectUrl = '/ig/api/instagram/connect'

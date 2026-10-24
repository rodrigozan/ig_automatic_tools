import { useCallback, useEffect, useState } from 'react'
import { api, errorInfo } from './api'

export function useFetch<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(url))

  const load = useCallback(async () => {
    if (!url) return
    setLoading(true)
    setError(null)
    try {
      const r = await api.get<T>(url)
      setData(r.data)
    } catch (err) {
      setError(errorInfo(err).message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps])

  useEffect(() => {
    load()
  }, [load])

  return { data, setData, error, loading, reload: load }
}

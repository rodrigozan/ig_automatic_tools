import { useEffect } from 'react'

export function useBeforeUnload(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const fn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', fn)
    return () => window.removeEventListener('beforeunload', fn)
  }, [dirty])
}

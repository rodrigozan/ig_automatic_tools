import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'

type Toast = { id: number; text: string; tone: 'success' | 'error'; link?: { to: string; label: string } }

const Ctx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})

export function useToast() {
  return useContext(Ctx)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s, { ...t, id }])
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4000)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" role="status" className="fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-32px))] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="flex items-start gap-2 rounded-card border border-card-border bg-surface p-3 shadow-sm">
            {t.tone === 'success' ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-positive" aria-hidden />
            ) : (
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-negative" aria-hidden />
            )}
            <div className="flex-1 text-sm">
              {t.text}
              {t.link && (
                <Link to={t.link.to} className="ml-2 font-medium text-brand underline">
                  {t.link.label}
                </Link>
              )}
            </div>
            <button aria-label="Fechar" className="text-faint hover:text-ink" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

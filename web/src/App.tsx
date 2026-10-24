import { useEffect, useState } from 'react'
import { applyTheme, readThemePref, saveThemePref, watchSystemTheme, type ThemePref } from './lib/theme'

const options: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Sistema' },
]

export default function App() {
  const [pref, setPref] = useState<ThemePref>(readThemePref)

  useEffect(() => {
    applyTheme(pref)
    saveThemePref(pref)
    return watchSystemTheme(() => pref)
  }, [pref])

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">IG Automatic Tools</h1>
      <div className="mt-6 max-w-md rounded-card border border-card-border bg-surface p-5">
        <p className="text-muted">Hub de ferramentas para criadores de conteúdo no Instagram.</p>
        <div role="radiogroup" aria-label="Tema" className="mt-4 inline-flex rounded-control bg-raised p-1">
          {options.map((o) => (
            <button
              key={o.value}
              role="radio"
              aria-checked={pref === o.value}
              onClick={() => setPref(o.value)}
              className={`h-8 rounded-[6px] px-3 text-sm ${pref === o.value ? 'bg-surface font-medium text-ink' : 'text-muted'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}

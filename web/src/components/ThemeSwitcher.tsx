import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { applyTheme, readThemePref, saveThemePref, watchSystemTheme, type ThemePref } from '../lib/theme'

const options: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Escuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Monitor },
]

export function ThemeSwitcher({ compact }: { compact?: boolean }) {
  const [pref, setPref] = useState<ThemePref>(readThemePref)

  useEffect(() => {
    applyTheme(pref)
    saveThemePref(pref)
    return watchSystemTheme(() => pref)
  }, [pref])

  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex rounded-control bg-raised p-1">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          aria-label={compact ? label : undefined}
          title={label}
          onClick={() => setPref(value)}
          className={`inline-flex h-8 max-md:min-h-11 items-center gap-1.5 rounded-[6px] px-2.5 text-sm ${
            pref === value ? 'bg-surface font-medium text-ink' : 'text-muted hover:text-ink'
          }`}
        >
          <Icon size={14} aria-hidden />
          {!compact && label}
        </button>
      ))}
    </div>
  )
}

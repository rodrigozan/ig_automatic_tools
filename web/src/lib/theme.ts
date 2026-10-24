export type ThemePref = 'light' | 'dark' | 'system'

const KEY = 'ig-theme'

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    return 'system'
  }
  return 'system'
}

export function applyTheme(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

export function saveThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    return
  }
}

export function watchSystemTheme(getPref: () => ThemePref) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const fn = () => {
    if (getPref() === 'system') applyTheme('system')
  }
  mq.addEventListener('change', fn)
  return () => mq.removeEventListener('change', fn)
}

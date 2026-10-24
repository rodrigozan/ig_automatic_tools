export const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const weekdayShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function formatDateTime(iso: string | Date, timeZone: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('pt-BR', { timeZone, day: '2-digit', month: '2-digit' })
  const time = d.toLocaleTimeString('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' })
  return `${date} às ${time}`
}

export function formatDate(iso: string | Date, timeZone: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function zonedParts(iso: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

export function zonedToUtc(date: string, time: string, timeZone: string) {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const offset = (t: number) => {
    const p = zonedParts(new Date(t), timeZone)
    const [py, pmo, pd] = p.date.split('-').map(Number)
    const [ph, pmi] = p.time.split(':').map(Number)
    return Date.UTC(py, pmo - 1, pd, ph, pmi) - t
  }
  let t = guess - offset(guess)
  t = guess - offset(t)
  return new Date(t).toISOString()
}

export const timezones: string[] = (() => {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
  try {
    return intl.supportedValuesOf?.('timeZone') ?? ['America/Sao_Paulo']
  } catch {
    return ['America/Sao_Paulo']
  }
})()

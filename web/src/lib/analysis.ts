import type { ContentKind, EngagementLevel, ProfileActivity, ProfileMetrics } from './types'

export const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
export const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

export const activityLabel: Record<ProfileActivity, { text: string; tone: 'success' | 'warning' | 'error' | 'neutral' }> = {
  active: { text: 'Ativo', tone: 'success' },
  irregular: { text: 'Irregular', tone: 'warning' },
  abandoned: { text: 'Parado', tone: 'error' },
  insufficient: { text: 'Poucos posts', tone: 'neutral' },
}

export const engagementLabel: Record<EngagementLevel, { text: string; tone: 'success' | 'warning' | 'error' | 'neutral' }> = {
  high: { text: 'Alto', tone: 'success' },
  medium: { text: 'Médio', tone: 'warning' },
  low: { text: 'Baixo', tone: 'error' },
  unknown: { text: 'Sem dados', tone: 'neutral' },
}

const kindLabel: Record<ContentKind, string> = { image: 'imagem', reel: 'reels', video: 'vídeo', carousel: 'carrossel', text: 'texto/link' }

export function mixText(m: ProfileMetrics) {
  const parts = (Object.keys(m.contentMix) as ContentKind[])
    .filter((k) => m.contentMix[k] > 0)
    .sort((a, b) => m.contentMix[b] - m.contentMix[a])
    .map((k) => `${Math.round(m.contentMix[k] * 100)}% ${kindLabel[k]}`)
  return parts.length ? parts.join(' · ') : '—'
}

export function lastPostText(m: ProfileMetrics) {
  if (m.daysSinceLastPost === undefined) return '—'
  if (m.daysSinceLastPost === 0) return 'hoje'
  if (m.daysSinceLastPost === 1) return 'ontem'
  return `há ${m.daysSinceLastPost} dias`
}

// Linhas numéricas do comparativo: "better" diz qual direção é melhor, para destacar o líder da linha.
export type NumericRow = { key: string; label: string; better: 'high' | 'low'; value: (m: ProfileMetrics) => number | undefined; show: (m: ProfileMetrics) => string }

export const numericRows: NumericRow[] = [
  { key: 'followers', label: 'Seguidores', better: 'high', value: (m) => m.followers, show: (m) => compact.format(m.followers) },
  { key: 'posts', label: 'Posts no perfil', better: 'high', value: (m) => m.mediaCount, show: (m) => nf.format(m.mediaCount) },
  { key: 'perWeek', label: 'Posts por semana', better: 'high', value: (m) => m.postsPerWeek, show: (m) => nf.format(m.postsPerWeek) },
  { key: 'last30', label: 'Posts nos últimos 30 dias', better: 'high', value: (m) => m.postsLast30d, show: (m) => nf.format(m.postsLast30d) },
  { key: 'lastPost', label: 'Último post', better: 'low', value: (m) => m.daysSinceLastPost, show: lastPostText },
  { key: 'likes', label: 'Curtidas por post', better: 'high', value: (m) => m.avgLikes, show: (m) => (m.avgLikes === undefined ? '—' : nf.format(m.avgLikes)) },
  { key: 'comments', label: 'Comentários por post', better: 'high', value: (m) => m.avgComments, show: (m) => (m.avgComments === undefined ? '—' : nf.format(m.avgComments)) },
  { key: 'engagement', label: 'Engajamento por post', better: 'high', value: (m) => m.engagementRate, show: (m) => (m.engagementRate === undefined ? '—' : `${nf.format(m.engagementRate)}%`) },
]

// Mesmo comparativo, para Páginas do Facebook: reações e compartilhamentos no lugar de curtidas, e sem contagem de posts do perfil.
export const pageRows: NumericRow[] = [
  { key: 'followers', label: 'Seguidores', better: 'high', value: (m) => m.followers, show: (m) => compact.format(m.followers) },
  { key: 'perWeek', label: 'Posts por semana', better: 'high', value: (m) => m.postsPerWeek, show: (m) => nf.format(m.postsPerWeek) },
  { key: 'last30', label: 'Posts nos últimos 30 dias', better: 'high', value: (m) => m.postsLast30d, show: (m) => nf.format(m.postsLast30d) },
  { key: 'lastPost', label: 'Último post', better: 'low', value: (m) => m.daysSinceLastPost, show: lastPostText },
  { key: 'likes', label: 'Reações por post', better: 'high', value: (m) => m.avgLikes, show: (m) => (m.avgLikes === undefined ? '—' : nf.format(m.avgLikes)) },
  { key: 'comments', label: 'Comentários por post', better: 'high', value: (m) => m.avgComments, show: (m) => (m.avgComments === undefined ? '—' : nf.format(m.avgComments)) },
  { key: 'shares', label: 'Compartilhamentos por post', better: 'high', value: (m) => m.avgShares, show: (m) => (m.avgShares === undefined ? '—' : nf.format(m.avgShares)) },
  { key: 'engagement', label: 'Engajamento por post', better: 'high', value: (m) => m.engagementRate, show: (m) => (m.engagementRate === undefined ? '—' : `${nf.format(m.engagementRate)}%`) },
]

export function leaders(row: NumericRow, all: (ProfileMetrics | null)[]): number | undefined {
  const values = all.map((m) => (m ? row.value(m) : undefined)).filter((v): v is number => v !== undefined)
  if (values.length < 2) return undefined
  return row.better === 'high' ? Math.max(...values) : Math.min(...values)
}

// Quanto o concorrente está acima ou abaixo de você, em %, só para linhas em que isso faz sentido.
export function deltaVsOwn(row: NumericRow, own: ProfileMetrics | null, other: ProfileMetrics | null): string | null {
  if (!own || !other || row.key === 'lastPost') return null
  const a = row.value(own)
  const b = row.value(other)
  if (a === undefined || b === undefined || a === 0) return null
  const pct = Math.round(((b - a) / a) * 100)
  if (pct === 0) return 'igual a você'
  return `${pct > 0 ? '+' : ''}${pct}% vs você`
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined)

// Leitura rápida do comparativo, em frases. Só diz o que os números sustentam.
export function insights(own: ProfileMetrics | null, others: ProfileMetrics[]): string[] {
  if (!own || !others.length) return []
  const out: string[] = []
  const rate = avg(others.map((m) => m.postsPerWeek))
  if (rate !== undefined && own.postsPerWeek < rate * 0.7) {
    out.push(`Seu ritmo é de ${nf.format(own.postsPerWeek)} posts por semana; os outros perfis têm ${nf.format(rate)} em média.`)
  } else if (rate !== undefined && own.postsPerWeek > rate * 1.3) {
    out.push(`Você posta mais que a média dos outros perfis (${nf.format(own.postsPerWeek)} contra ${nf.format(rate)} por semana).`)
  }
  const er = avg(others.map((m) => m.engagementRate).filter((v): v is number => v !== undefined))
  if (own.engagementRate !== undefined && er !== undefined) {
    if (own.engagementRate < er * 0.7) out.push(`Seu engajamento (${nf.format(own.engagementRate)}%) está abaixo da média dos outros (${nf.format(er)}%).`)
    else if (own.engagementRate > er * 1.3) out.push(`Seu engajamento (${nf.format(own.engagementRate)}%) está acima da média dos outros (${nf.format(er)}%).`)
  }
  const reels = avg(others.map((m) => m.contentMix.reel))
  if (reels !== undefined && own.contentMix.reel + 0.2 < reels) {
    out.push(`Eles publicam mais reels (${Math.round(reels * 100)}% dos posts) que você (${Math.round(own.contentMix.reel * 100)}%).`)
  }
  const stopped = others.filter((m) => m.activity === 'abandoned').length
  if (stopped) out.push(`${stopped} dos perfis comparados está parado há mais de 60 dias.`)
  return out
}

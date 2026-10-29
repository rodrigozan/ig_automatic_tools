import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart3, Link2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { formatDate } from '../lib/format'
import { useAuth } from '../lib/auth'
import type { AnalysisOverview, ProfileAnalysis } from '../lib/types'
import { activityLabel, deltaVsOwn, engagementLabel, insights, leaders, mixText, nf, numericRows } from '../lib/analysis'
import { Banner, Button, Card, EmptyState, ErrorCard, Field, Input, PageHeader, Select, SkeletonList, Tag } from '../components/ui'
import { useToast } from '../components/toast'

const FacebookTab = lazy(() => import('./AnalysisFacebookTab'))

const connectMessages: Record<string, string> = {
  cancelado: 'Você cancelou a conexão com o Facebook.',
  falha: 'Não foi possível conectar o Facebook. Tente de novo.',
  sem_pagina: 'Nenhuma Página do Facebook está ligada à sua conta do Instagram. Ligue a conta a uma Página e tente de novo.',
}

function Avatar({ a }: { a: ProfileAnalysis }) {
  return a.profile.profilePictureUrl ? (
    <img src={a.profile.profilePictureUrl} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-raised text-xs text-muted" aria-hidden>
      {a.username.slice(0, 1).toUpperCase()}
    </span>
  )
}

export default function AnalysisPage() {
  const { data, setData, loading, error, reload } = useFetch<AnalysisOverview>('/analysis')
  const { user } = useAuth()
  const tz = user?.timezone ?? 'America/Sao_Paulo'
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [ownId, setOwnId] = useState<string>('')
  const [handle, setHandle] = useState('')
  const [handleError, setHandleError] = useState<string | undefined>()
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tab, setTab] = useState<'instagram' | 'facebook'>(params.get('aba') === 'facebook' ? 'facebook' : 'instagram')

  useEffect(() => {
    const conectado = params.get('conectado')
    if (conectado === 'paginas') {
      toast({ tone: 'success', text: 'Facebook conectado. Nenhuma conta do Instagram está ligada a essas Páginas, mas elas já aparecem na aba de Páginas.' })
      setTab('facebook')
    } else if (conectado) {
      toast({ tone: 'success', text: 'Facebook conectado. Já dá para analisar perfis e Páginas.' })
      reload()
    }
    const erro = params.get('erro')
    if (erro) toast({ tone: 'error', text: connectMessages[erro] ?? connectMessages.falha })
    if (params.has('conectado') || erro) setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const own = useMemo(() => data?.own.find((o) => o.accountId === ownId) ?? data?.own[0], [data, ownId])
  const columns = useMemo(() => [...(own?.analysis ? [own.analysis] : []), ...(data?.competitors ?? [])], [own, data])
  const metrics = columns.map((c) => c.metrics)
  const ownMetrics = own?.analysis?.metrics ?? null
  const notes = insights(ownMetrics, (data?.competitors ?? []).map((c) => c.metrics).filter((m): m is NonNullable<typeof m> => Boolean(m)))
  const canAdd = data?.facebook.connected

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setHandleError(undefined)
    setAdding(true)
    try {
      const r = await api.post<ProfileAnalysis>('/analysis/competitors', { username: handle })
      setData((cur) => (cur ? { ...cur, competitors: [...cur.competitors.filter((c) => c.id !== r.data.id), r.data] } : cur))
      setHandle('')
      toast({ tone: 'success', text: `@${r.data.username} analisado.` })
    } catch (err) {
      const info = errorInfo(err)
      if (info.fields.username) setHandleError(info.fields.username)
      else toast({ tone: 'error', text: info.message })
    } finally {
      setAdding(false)
    }
  }

  const refresh = async (a: ProfileAnalysis, isOwn: boolean, accountId?: string) => {
    setBusyId(a.id)
    try {
      const r = await api.post<ProfileAnalysis>(isOwn ? `/analysis/own/${accountId}/refresh` : `/analysis/competitors/${a.id}/refresh`)
      setData((cur) =>
        cur
          ? isOwn
            ? { ...cur, own: cur.own.map((o) => (o.accountId === accountId ? { ...o, analysis: r.data, error: null } : o)) }
            : { ...cur, competitors: cur.competitors.map((c) => (c.id === a.id ? r.data : c)) }
          : cur,
      )
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (a: ProfileAnalysis) => {
    setBusyId(a.id)
    try {
      await api.delete(`/analysis/competitors/${a.id}`)
      setData((cur) => (cur ? { ...cur, competitors: cur.competitors.filter((c) => c.id !== a.id) } : cur))
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader title="Análise de perfis" description="Compare o seu perfil ou Página com concorrentes e referências: frequência, engajamento e tipo de conteúdo." />

      <div role="tablist" aria-label="Rede" className="mb-4 flex gap-1 border-b border-card-border">
        {([['instagram', 'Instagram'], ['facebook', 'Páginas do Facebook']] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === key ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'facebook' ? (
        <Suspense fallback={<Card><SkeletonList /></Card>}>
          <FacebookTab />
        </Suspense>
      ) : loading ? (
        <Card>
          <SkeletonList />
        </Card>
      ) : error || !data ? (
        <ErrorCard message={error ?? undefined} onRetry={reload} />
      ) : data.own.length === 0 ? (
        <Card className="p-6">
          <EmptyState text="Conecte uma conta profissional do Instagram em “Contas do Instagram” para começar a análise." />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {data.facebook.configured && !data.facebook.connected && (
            <Banner
              tone="warning"
              action={
                <a href="/ig/api/analysis/facebook/connect" className="inline-flex h-9 items-center gap-2 rounded-control border border-control px-3.5 text-sm font-medium hover:bg-raised">
                  <Link2 size={16} aria-hidden /> Conectar Facebook
                </a>
              }
            >
              Para analisar outros perfis, conecte o Facebook. A sua conta do Instagram precisa estar ligada a uma Página.
            </Banner>
          )}

          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              {data.own.length > 1 && (
                <div className="w-56">
                  <Field label="Seu perfil">{(id) => (
                    <Select id={id} value={own?.accountId ?? ''} onChange={(e) => setOwnId(e.target.value)}>
                      {data.own.map((o) => (
                        <option key={o.accountId} value={o.accountId}>
                          @{o.username}
                        </option>
                      ))}
                    </Select>
                  )}</Field>
                </div>
              )}
              <form onSubmit={add} className="flex min-w-72 flex-1 flex-wrap items-end gap-3">
                <div className="min-w-56 flex-1">
                  <Field label="Adicionar perfil para comparar" error={handleError} hint="Use o @ ou o endereço do perfil. Só contas profissionais (business ou creator).">
                    {(id, describedBy) => (
                      <Input id={id} aria-describedby={describedBy} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@concorrente" disabled={!canAdd || adding} autoComplete="off" />
                    )}
                  </Field>
                </div>
                <Button type="submit" variant="primary" icon={<Plus size={16} />} loading={adding} loadingText="Analisando…" disabled={!canAdd || !handle.trim()}>
                  Adicionar
                </Button>
              </form>
            </div>
          </Card>

          {!own?.analysis ? (
            <Card className="p-6">
              <EmptyState text={own?.error ?? 'Ainda não foi possível analisar o seu perfil.'} action={<Button onClick={reload}>Tentar de novo</Button>} />
            </Card>
          ) : (
            <>
              {notes.length > 0 && (
                <Card className="p-4">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <BarChart3 size={16} className="text-brand" aria-hidden /> Em resumo
                  </h2>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-left">
                      <th className="sticky left-0 z-10 w-48 bg-surface p-3 font-medium text-muted">Perfil</th>
                      {columns.map((c, i) => (
                        <th key={c.id} className="min-w-44 p-3 align-top font-normal">
                          <div className="flex items-start gap-2">
                            <Avatar a={c} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-semibold">@{c.username}</div>
                              <div className="text-xs text-muted">{i === 0 ? 'Você' : 'Concorrente'} · {formatDate(c.fetchedAt, tz)}</div>
                            </div>
                            <div className="flex">
                              <button aria-label={`Atualizar @${c.username}`} title="Atualizar" disabled={busyId === c.id} onClick={() => refresh(c, i === 0, own.accountId)} className="flex h-8 w-8 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-ink disabled:opacity-50">
                                <RefreshCw size={14} className={busyId === c.id ? 'animate-spin' : ''} aria-hidden />
                              </button>
                              {i > 0 && (
                                <button aria-label={`Remover @${c.username}`} title="Remover" disabled={busyId === c.id} onClick={() => remove(c)} className="flex h-8 w-8 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-negative disabled:opacity-50">
                                  <Trash2 size={14} aria-hidden />
                                </button>
                              )}
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {numericRows.map((row) => {
                      const best = leaders(row, metrics)
                      return (
                        <tr key={row.key} className="border-b border-card-border last:border-0">
                          <th scope="row" className="sticky left-0 z-10 bg-surface p-3 text-left font-normal text-muted">{row.label}</th>
                          {columns.map((c, i) => {
                            const m = c.metrics
                            const v = m ? row.value(m) : undefined
                            const isBest = best !== undefined && v === best
                            const delta = i > 0 ? deltaVsOwn(row, ownMetrics, m) : null
                            return (
                              <td key={c.id} className="p-3 align-top tabular-nums">
                                <span className={isBest ? 'font-semibold text-brand' : ''}>{m ? row.show(m) : '—'}</span>
                                {delta && <div className="text-xs text-muted">{delta}</div>}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                    <tr className="border-b border-card-border">
                      <th scope="row" className="sticky left-0 z-10 bg-surface p-3 text-left font-normal text-muted">Tipo de conteúdo</th>
                      {columns.map((c) => (
                        <td key={c.id} className="p-3 align-top text-muted">{c.metrics ? mixText(c.metrics) : '—'}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-card-border">
                      <th scope="row" className="sticky left-0 z-10 bg-surface p-3 text-left font-normal text-muted">Atividade</th>
                      {columns.map((c) => (
                        <td key={c.id} className="p-3 align-top">{c.metrics && <Tag tone={activityLabel[c.metrics.activity].tone}>{activityLabel[c.metrics.activity].text}</Tag>}</td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row" className="sticky left-0 z-10 bg-surface p-3 text-left font-normal text-muted">Nível de engajamento</th>
                      {columns.map((c) => (
                        <td key={c.id} className="p-3 align-top">{c.metrics && <Tag tone={engagementLabel[c.metrics.engagementLevel].tone}>{engagementLabel[c.metrics.engagementLevel].text}</Tag>}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { title: 'Posts por semana', value: (m: NonNullable<ProfileAnalysis['metrics']>) => m.postsPerWeek, suffix: '' },
                  { title: 'Engajamento por post', value: (m: NonNullable<ProfileAnalysis['metrics']>) => m.engagementRate ?? 0, suffix: '%' },
                ].map((chart) => {
                  const values = columns.map((c) => (c.metrics ? chart.value(c.metrics) : 0))
                  const max = Math.max(...values, 0.0001)
                  return (
                    <Card key={chart.title} className="p-4">
                      <h2 className="mb-3 text-sm font-semibold">{chart.title}</h2>
                      <ul className="space-y-2">
                        {columns.map((c, i) => (
                          <li key={c.id} className="flex items-center gap-3 text-sm">
                            <span className="w-28 shrink-0 truncate text-muted">@{c.username}</span>
                            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-brand-track" role="img" aria-label={`${nf.format(values[i])}${chart.suffix}`}>
                              <span className={`block h-full rounded-full ${i === 0 ? 'bg-brand' : 'bg-faint'}`} style={{ width: `${Math.max(2, (values[i] / max) * 100)}%` }} />
                            </span>
                            <span className="w-14 text-right tabular-nums">{nf.format(values[i])}{chart.suffix}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )
                })}
              </div>

              <Card className="p-4">
                <h2 className="mb-3 text-sm font-semibold">Posts que mais engajaram</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {columns.map((c) => (
                    <div key={c.id}>
                      <div className="mb-1 font-medium">@{c.username}</div>
                      {c.metrics?.topPosts.length ? (
                        <ul className="space-y-1.5 text-sm">
                          {c.metrics.topPosts.map((p) => (
                            <li key={p.id} className="flex gap-2">
                              <span className="shrink-0 tabular-nums text-muted">♥ {nf.format(p.likes)} · 💬 {nf.format(p.comments)}</span>
                              {p.permalink ? (
                                <a href={p.permalink} target="_blank" rel="noreferrer" className="min-w-0 truncate text-brand underline">{p.caption || 'Ver post'}</a>
                              ) : (
                                <span className="min-w-0 truncate">{p.caption}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted">Sem posts para mostrar.</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              {data.competitors.length === 0 && (
                <p className="text-sm text-muted">
                  {canAdd ? 'Adicione perfis acima para ver o comparativo.' : 'Conecte o Facebook para adicionar perfis ao comparativo.'}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

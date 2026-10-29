import { useMemo, useState } from 'react'
import { BarChart3, Link2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { formatDate } from '../lib/format'
import { useAuth } from '../lib/auth'
import type { PageOverview, ProfileAnalysis } from '../lib/types'
import { activityLabel, deltaVsOwn, engagementLabel, insights, leaders, mixText, nf, pageRows } from '../lib/analysis'
import { Button, Card, EmptyState, ErrorCard, Field, Input, Select, SkeletonList, Tag } from '../components/ui'
import { useToast } from '../components/toast'

// Segunda aba da análise: Páginas do Facebook. Mesma ideia da aba do Instagram, com os números da Página.
export default function AnalysisFacebookTab() {
  const { data, setData, loading, error, reload } = useFetch<PageOverview>('/analysis/pages')
  const { user } = useAuth()
  const tz = user?.timezone ?? 'America/Sao_Paulo'
  const toast = useToast()
  const [ownId, setOwnId] = useState('')
  const [ref, setRef] = useState('')
  const [refError, setRefError] = useState<string | undefined>()
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const own = useMemo(() => data?.own.find((o) => o.pageId === ownId) ?? data?.own[0], [data, ownId])
  const columns = useMemo(() => [...(own?.analysis ? [own.analysis] : []), ...(data?.competitors ?? [])], [own, data])
  const metrics = columns.map((c) => c.metrics)
  const ownMetrics = own?.analysis?.metrics ?? null
  const notes = insights(ownMetrics, (data?.competitors ?? []).map((c) => c.metrics).filter((m): m is NonNullable<typeof m> => Boolean(m)))

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setRefError(undefined)
    setAdding(true)
    try {
      const r = await api.post<ProfileAnalysis>('/analysis/pages/competitors', { page: ref })
      setData((cur) => (cur ? { ...cur, competitors: [...cur.competitors.filter((c) => c.id !== r.data.id), r.data] } : cur))
      setRef('')
      toast({ tone: 'success', text: `${r.data.profile.name ?? r.data.username} analisada.` })
    } catch (err) {
      const info = errorInfo(err)
      if (info.fields.page) setRefError(info.fields.page)
      else setRefError(info.message)
    } finally {
      setAdding(false)
    }
  }

  const refresh = async (a: ProfileAnalysis, isOwn: boolean, pageId?: string) => {
    setBusyId(a.id)
    try {
      const r = await api.post<ProfileAnalysis>(isOwn ? `/analysis/pages/${pageId}/refresh` : `/analysis/pages/competitors/${a.id}/refresh`)
      setData((cur) =>
        cur
          ? isOwn
            ? { ...cur, own: cur.own.map((o) => (o.pageId === pageId ? { ...o, analysis: r.data, error: null } : o)) }
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
      await api.delete(`/analysis/pages/competitors/${a.id}`)
      setData((cur) => (cur ? { ...cur, competitors: cur.competitors.filter((c) => c.id !== a.id) } : cur))
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Card><SkeletonList /></Card>
  if (error || !data) return <ErrorCard message={error ?? undefined} onRetry={reload} />

  const connectLink = (
    <a href="/ig/api/analysis/facebook/connect" className="inline-flex h-9 items-center gap-2 rounded-control border border-control px-3.5 text-sm font-medium hover:bg-raised">
      <Link2 size={16} aria-hidden /> Conectar Facebook
    </a>
  )

  if (!data.facebook.connected) {
    return (
      <Card className="p-6">
        <EmptyState
          text={data.facebook.configured ? 'Conecte o Facebook e escolha as Páginas que quer analisar.' : 'O login do Facebook não está configurado no servidor.'}
          action={data.facebook.configured ? connectLink : undefined}
        />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          {data.own.length > 1 && (
            <div className="w-56">
              <Field label="Sua Página">{(id) => (
                <Select id={id} value={own?.pageId ?? ''} onChange={(e) => setOwnId(e.target.value)}>
                  {data.own.map((o) => (
                    <option key={o.pageId} value={o.pageId}>{o.name}</option>
                  ))}
                </Select>
              )}</Field>
            </div>
          )}
          <form onSubmit={add} className="flex min-w-72 flex-1 flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Field label="Adicionar Página para comparar" error={refError} hint="Use o endereço da Página ou o nome de usuário dela.">
                {(id, describedBy) => (
                  <Input id={id} aria-describedby={describedBy} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="facebook.com/concorrente" disabled={adding} autoComplete="off" />
                )}
              </Field>
            </div>
            <Button type="submit" variant="primary" icon={<Plus size={16} />} loading={adding} loadingText="Analisando…" disabled={!ref.trim()}>
              Adicionar
            </Button>
          </form>
          <div className="ml-auto">{connectLink}</div>
        </div>
      </Card>

      {!own?.analysis ? (
        <Card className="p-6">
          <EmptyState text={own?.error ?? 'Ainda não foi possível analisar a sua Página.'} action={<Button onClick={reload}>Tentar de novo</Button>} />
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
                  <th className="sticky left-0 z-10 w-48 bg-surface p-3 font-medium text-muted">Página</th>
                  {columns.map((c, i) => (
                    <th key={c.id} className="min-w-44 p-3 align-top font-normal">
                      <div className="flex items-start gap-2">
                        {c.profile.profilePictureUrl ? (
                          <img src={c.profile.profilePictureUrl} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-raised text-xs text-muted" aria-hidden>
                            {(c.profile.name ?? c.username).slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{c.profile.name ?? c.username}</div>
                          <div className="text-xs text-muted">{i === 0 ? 'Você' : 'Concorrente'} · {formatDate(c.fetchedAt, tz)}</div>
                        </div>
                        <div className="flex">
                          <button aria-label={`Atualizar ${c.profile.name ?? c.username}`} title="Atualizar" disabled={busyId === c.id} onClick={() => refresh(c, i === 0, own.pageId)} className="flex h-8 w-8 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-ink disabled:opacity-50">
                            <RefreshCw size={14} className={busyId === c.id ? 'animate-spin' : ''} aria-hidden />
                          </button>
                          {i > 0 && (
                            <button aria-label={`Remover ${c.profile.name ?? c.username}`} title="Remover" disabled={busyId === c.id} onClick={() => remove(c)} className="flex h-8 w-8 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-negative disabled:opacity-50">
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
                {pageRows.map((row) => {
                  const best = leaders(row, metrics)
                  return (
                    <tr key={row.key} className="border-b border-card-border last:border-0">
                      <th scope="row" className="sticky left-0 z-10 bg-surface p-3 text-left font-normal text-muted">{row.label}</th>
                      {columns.map((c, i) => {
                        const m = c.metrics
                        const v = m ? row.value(m) : undefined
                        const delta = i > 0 ? deltaVsOwn(row, ownMetrics, m) : null
                        return (
                          <td key={c.id} className="p-3 align-top tabular-nums">
                            <span className={best !== undefined && v === best ? 'font-semibold text-brand' : ''}>{m ? row.show(m) : '—'}</span>
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

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Posts que mais engajaram</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {columns.map((c) => (
                <div key={c.id}>
                  <div className="mb-1 font-medium">{c.profile.name ?? c.username}</div>
                  {c.metrics?.topPosts.length ? (
                    <ul className="space-y-1.5 text-sm">
                      {c.metrics.topPosts.map((p) => (
                        <li key={p.id} className="flex gap-2">
                          <span className="shrink-0 tabular-nums text-muted">👍 {nf.format(p.likes)} · 💬 {nf.format(p.comments)}</span>
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

          {data.competitors.length === 0 && <p className="text-sm text-muted">Adicione Páginas acima para ver o comparativo.</p>}
        </>
      )}
    </div>
  )
}

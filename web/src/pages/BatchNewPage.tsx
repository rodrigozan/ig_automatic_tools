import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, GripVertical, Lock, Plus, X } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useAccounts } from '../lib/accounts'
import { useAuth } from '../lib/auth'
import { formatDate, formatDateTime, weekdayShort, zonedParts, zonedToUtc } from '../lib/format'
import type { Batch, MediaItem } from '../lib/types'
import { Button, Card, ConfirmDialog, Field, FormError, Input, PageHeader, Select, Textarea } from '../components/ui'
import { ConversionTag, MediaThumb, Uploader, useMediaStatus } from '../components/media'
import { LimitBanner, ReconnectBanners } from '../components/AccountBanners'
import { useToast } from '../components/toast'
import { useBeforeUnload } from '../components/useDirtyGuard'
import { addDays } from '../components/WeekCalendar'

type Row = { media: MediaItem; caption: string; scheduledAt?: string; fixed: boolean }
type PreviewItem = { mediaId: string; caption: string; fixed: boolean; scheduledAt: string }

export default function BatchNewPage() {
  const { user } = useAuth()
  const tz = user?.timezone ?? 'America/Sao_Paulo'
  const { accounts } = useAccounts()
  const navigate = useNavigate()
  const toast = useToast()

  const defaults = useMemo(() => {
    const sched = user?.defaultSchedule ?? []
    const days = sched.map((d) => d.weekday)
    const times = [...new Set(sched.flatMap((d) => d.times))].sort()
    return { mode: days.length === 7 ? ('daily' as const) : ('selected_days' as const), days: days.length ? days : [1, 3, 5], times: times.length ? times : ['19:00'] }
  }, [user])

  const [accountId, setAccountId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [library, setLibrary] = useState<MediaItem[]>([])
  const [mode, setMode] = useState<'daily' | 'selected_days'>(defaults.mode)
  const [days, setDays] = useState<number[]>(defaults.days)
  const [times, setTimes] = useState<string[]>(defaults.times)
  const [newTime, setNewTime] = useState('')
  const [startDate, setStartDate] = useState(() => addDays(zonedParts(new Date(), tz).date, 1))
  const [name, setName] = useState('')
  const [defaultCaption, setDefaultCaption] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<{ message?: string; fields: Record<string, string> }>({ fields: {} })
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const dirty = rows.length > 0
  useBeforeUnload(dirty)

  useEffect(() => {
    if (!accountId) {
      const first = accounts.find((a) => a.status === 'connected')
      if (first) setAccountId(first.id)
    }
  }, [accounts, accountId])

  useEffect(() => {
    api
      .get<MediaItem[]>('/media?kind=video')
      .then((r) => setLibrary(r.data.filter((m) => !m.inUse && m.conversionStatus !== 'failed')))
      .catch(() => setLibrary([]))
  }, [])

  const mediaList = useMemo(() => rows.map((r) => r.media), [rows])
  const merge = useCallback((updated: MediaItem[]) => setRows((cur) => cur.map((r) => ({ ...r, media: updated.find((u) => u.id === r.media.id) ?? r.media }))), [])
  useMediaStatus(mediaList, merge)

  const addMedia = useCallback((m: MediaItem) => {
    if (m.kind !== 'video') return
    setRows((cur) => (cur.some((r) => r.media.id === m.id) ? cur : [...cur, { media: m, caption: '', fixed: false }]))
  }, [])

  const body = (list: Row[]) => ({
    accountId,
    name: name || undefined,
    mode,
    days: mode === 'daily' ? [] : days,
    times,
    startDate,
    items: list.map((r) => ({ mediaId: r.media.id, caption: r.caption, scheduledAt: r.fixed ? r.scheduledAt : undefined })),
  })

  const preview = async (list = rows) => {
    setCalculating(true)
    setError({ fields: {} })
    try {
      const r = await api.post<{ items: PreviewItem[] }>('/batches/preview', body(list))
      setRows(list.map((row, i) => ({ ...row, scheduledAt: r.data.items[i].scheduledAt, fixed: r.data.items[i].fixed })))
      setReviewing(true)
    } catch (err) {
      const e = errorInfo(err)
      setError({ message: e.message, fields: e.fields })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setCalculating(false)
    }
  }

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= rows.length || from === to) return
    const next = [...rows]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    if (reviewing) preview(next)
    else setRows(next)
  }

  const confirm = async () => {
    setConfirming(true)
    setError({ fields: {} })
    try {
      const r = await api.post<Batch & { summary: { total: number; first: string; last: string } }>('/batches', body(rows))
      setRows([])
      const s = r.data.summary
      toast({ tone: 'success', text: `${s.total} publicações agendadas, de ${formatDate(s.first, tz)} a ${formatDate(s.last, tz)}.`, link: { to: `/lotes/${r.data.id}`, label: 'Ver lote' } })
      navigate('/lotes')
    } catch (err) {
      const e = errorInfo(err)
      setError({ message: e.message, fields: e.fields })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setConfirming(false)
    }
  }

  const settingsChanged = () => setReviewing(false)
  const available = library.filter((m) => !rows.some((r) => r.media.id === m.id))

  return (
    <div className="pb-20">
      <PageHeader title="Novo lote" description="Suba vários vídeos e o app agenda um reel por horário, na ordem dos vídeos." />
      <ReconnectBanners />
      <LimitBanner accountId={accountId} />
      <FormError message={error.message} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-lg font-semibold">1. Conta e vídeos</h2>
          <Field label="Conta" error={error.fields.accountId}>
            {(id, d) => (
              <Select id={id} aria-describedby={d} value={accountId} onChange={(e) => (setAccountId(e.target.value), settingsChanged())}>
                {accounts.filter((a) => a.status === 'connected').length === 0 && <option value="">Nenhuma conta conectada</option>}
                {accounts
                  .filter((a) => a.status === 'connected')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      @{a.username}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <Uploader accept="video/*" onUploaded={(m) => (addMedia(m), settingsChanged())} label="Enviar vídeos" />
          {error.fields.items && <p className="text-xs text-negative">{error.fields.items}</p>}
          {available.length > 0 && (
            <details className="rounded-control border border-border">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Adicionar da biblioteca ({available.length})</summary>
              <ul className="max-h-60 overflow-y-auto p-2">
                {available.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 p-1">
                    <MediaThumb media={m} size={36} />
                    <span className="min-w-0 flex-1 truncate text-sm">{m.originalName}</span>
                    <Button type="button" icon={<Plus size={14} />} onClick={() => (addMedia(m), settingsChanged())}>
                      Adicionar
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="text-sm text-muted tabular-nums">{rows.length} vídeos no lote</p>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-lg font-semibold">2. Frequência e horários</h2>
          <div role="radiogroup" aria-label="Frequência" className="grid grid-cols-2 gap-2">
            {[
              { v: 'daily' as const, l: 'Todo dia' },
              { v: 'selected_days' as const, l: 'Dias da semana' },
            ].map((o) => (
              <button key={o.v} type="button" role="radio" aria-checked={mode === o.v} onClick={() => (setMode(o.v), settingsChanged())} className={`h-10 max-md:min-h-11 rounded-control border text-sm font-medium ${mode === o.v ? 'border-brand bg-brand-soft text-brand-ink' : 'border-control'}`}>
                {o.l}
              </button>
            ))}
          </div>
          {mode === 'selected_days' && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Dias</legend>
              <div className="flex flex-wrap gap-2">
                {weekdayShort.map((d, i) => {
                  const on = days.includes(i)
                  return (
                    <label key={d} className={`flex h-9 max-md:h-11 min-w-12 cursor-pointer items-center justify-center rounded-control border px-2 text-sm ${on ? 'border-brand bg-brand-soft font-medium text-brand-ink' : 'border-control'}`}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => (setDays(on ? days.filter((x) => x !== i) : [...days, i].sort()), settingsChanged())} />
                      {d}
                    </label>
                  )
                })}
              </div>
              {error.fields.days && <p className="mt-2 text-xs text-negative">{error.fields.days}</p>}
            </fieldset>
          )}
          <div>
            <span className="mb-2 block text-sm font-medium">Horários</span>
            <div className="flex flex-wrap items-center gap-2">
              {times.map((t) => (
                <span key={t} className="inline-flex h-8 items-center gap-1 rounded-full bg-raised pr-1 pl-3 text-sm tabular-nums">
                  {t}
                  <button type="button" aria-label={`Remover ${t}`} onClick={() => (setTimes(times.filter((x) => x !== t)), settingsChanged())} className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-ink">
                    <X size={12} />
                  </button>
                </span>
              ))}
              <Input type="time" aria-label="Novo horário" className="w-28" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              <Button type="button" disabled={!newTime} onClick={() => (setTimes([...new Set([...times, newTime])].sort()), setNewTime(''), settingsChanged())}>
                Adicionar
              </Button>
            </div>
            {error.fields.times && <p className="mt-2 text-xs text-negative">{error.fields.times}</p>}
            <p className="mt-2 text-xs text-faint">Vêm da agenda padrão das Configurações. A mudança aqui vale só para este lote.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data inicial" error={error.fields.startDate}>
              {(id, d) => <Input id={id} type="date" aria-describedby={d} value={startDate} onChange={(e) => (setStartDate(e.target.value), settingsChanged())} />}
            </Field>
            <Field label="Nome do lote (opcional)">{(id) => <Input id={id} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />}</Field>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <h2 className="text-lg font-semibold">3. Revisão</h2>
          <Button onClick={() => preview()} loading={calculating} loadingText="Calculando horários..." disabled={rows.length === 0 || !times.length}>
            {reviewing ? 'Recalcular horários' : 'Revisar'}
          </Button>
        </div>
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">Envie ou adicione vídeos para revisar.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2 border-b border-border p-5">
              <Field label="Legenda padrão" hint="Cole aqui e aplique a todos os vídeos. Depois ajuste cada um.">
                {(id, d) => <Textarea id={id} aria-describedby={d} rows={3} value={defaultCaption} onChange={(e) => setDefaultCaption(e.target.value)} />}
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={!defaultCaption} onClick={() => setRows(rows.map((r) => ({ ...r, caption: r.caption || defaultCaption })))}>
                  Aplicar às vazias
                </Button>
                <Button type="button" disabled={!defaultCaption} onClick={() => setRows(rows.map((r) => ({ ...r, caption: defaultCaption })))}>
                  Aplicar a todas
                </Button>
              </div>
            </div>
            <ol className="divide-y divide-border">
              {rows.map((r, i) => {
                const parts = r.scheduledAt ? zonedParts(r.scheduledAt, tz) : null
                return (
                  <li
                    key={r.media.id}
                    draggable
                    onDragStart={() => setDragIdx(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIdx !== null) reorder(dragIdx, i)
                      setDragIdx(null)
                    }}
                    className={`grid gap-3 p-4 md:grid-cols-[auto_auto_1fr_300px] ${dragIdx === i ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-1 md:flex-col md:justify-center">
                      <span className="cursor-grab text-faint" aria-hidden title="Arraste para reordenar">
                        <GripVertical size={16} />
                      </span>
                      <button type="button" aria-label={`Subir ${r.media.originalName}`} disabled={i === 0} onClick={() => reorder(i, i - 1)} className="flex h-8 w-8 max-md:h-11 max-md:w-11 items-center justify-center rounded-control hover:bg-raised disabled:opacity-40">
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" aria-label={`Descer ${r.media.originalName}`} disabled={i === rows.length - 1} onClick={() => reorder(i, i + 1)} className="flex h-8 w-8 max-md:h-11 max-md:w-11 items-center justify-center rounded-control hover:bg-raised disabled:opacity-40">
                        <ArrowDown size={14} />
                      </button>
                      <button type="button" aria-label={`Tirar ${r.media.originalName} do lote`} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="flex h-8 w-8 max-md:h-11 max-md:w-11 items-center justify-center rounded-control text-muted hover:bg-raised md:hidden">
                        <X size={14} />
                      </button>
                    </div>
                    <MediaThumb media={r.media} size={72} />
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-faint tabular-nums">{i + 1}</span>
                        <span className="truncate text-sm font-medium">{r.media.originalName}</span>
                        <ConversionTag status={r.media.conversionStatus} />
                      </div>
                      <Textarea aria-label={`Legenda de ${r.media.originalName}`} aria-invalid={Boolean(error.fields[`items.${i}.caption`])} rows={2} className="min-h-16" value={r.caption} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} />
                      <span className={`text-xs tabular-nums ${r.caption.length > 2200 ? 'text-negative' : 'text-faint'}`}>{r.caption.length} de 2.200</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {parts ? (
                        <>
                          <div className="flex gap-2">
                            <Input type="date" aria-label={`Data de ${r.media.originalName}`} value={parts.date} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, scheduledAt: zonedToUtc(e.target.value, parts.time, tz), fixed: true } : x)))} />
                            <Input type="time" aria-label={`Hora de ${r.media.originalName}`} className="w-32" value={parts.time} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, scheduledAt: zonedToUtc(parts.date, e.target.value, tz), fixed: true } : x)))} />
                          </div>
                          <span className="flex items-center gap-1 text-xs text-faint">
                            {r.fixed ? (
                              <>
                                <Lock size={12} aria-hidden /> Horário fixo{' '}
                                <button type="button" className="underline" onClick={() => setRows(rows.map((x, j) => (j === i ? { ...x, fixed: false } : x)))}>
                                  soltar
                                </button>
                              </>
                            ) : (
                              formatDateTime(r.scheduledAt!, tz)
                            )}
                          </span>
                          {error.fields[`items.${i}.scheduledAt`] && <span className="text-xs text-negative">{error.fields[`items.${i}.scheduledAt`]}</span>}
                        </>
                      ) : (
                        <span className="text-sm text-faint">Clique em Revisar</span>
                      )}
                      <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="hidden self-start text-xs text-muted underline md:block">
                        Tirar do lote
                      </button>
                    </div>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </Card>

      <div className="fixed right-0 bottom-0 left-0 z-20 border-t border-border bg-surface md:left-[230px]">
        <div className="mx-auto flex max-w-[1280px] items-center justify-end gap-2 px-4 py-3 md:px-8">
          <Button className="mr-auto" onClick={() => (dirty ? setLeaveOpen(true) : navigate('/lotes'))}>
            Voltar
          </Button>
          <Button variant="primary" onClick={confirm} loading={confirming} loadingText="Agendando..." disabled={!reviewing || calculating || rows.length === 0}>
            Confirmar lote
          </Button>
        </div>
      </div>
      <ConfirmDialog open={leaveOpen} title="Descartar o lote?" message="Os vídeos enviados ficam em Mídias, mas as legendas e horários serão perdidos." confirmLabel="Descartar" danger onClose={() => setLeaveOpen(false)} onConfirm={() => navigate('/lotes')} />
    </div>
  )
}

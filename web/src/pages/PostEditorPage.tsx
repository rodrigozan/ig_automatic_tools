import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ExternalLink, X } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useAccounts } from '../lib/accounts'
import { useAuth } from '../lib/auth'
import { formatDateTime, zonedParts, zonedToUtc } from '../lib/format'
import type { MediaItem, Post, PostType, PostDestination } from '../lib/types'
import { Button, Card, ConfirmDialog, ErrorCard, Field, FormError, Input, PageHeader, PostStatusTag, Select, Skeleton, Textarea } from '../components/ui'
import { ConversionTag, MediaThumb, Uploader, useMediaStatus } from '../components/media'
import { LimitBanner, ReconnectBanners } from '../components/AccountBanners'
import { useToast } from '../components/toast'
import { useBeforeUnload } from '../components/useDirtyGuard'

const types: { v: PostType; l: string; hint: string }[] = [
  { v: 'post', l: 'Post', hint: '1 imagem' },
  { v: 'reel', l: 'Reel', hint: '1 vídeo' },
  { v: 'carousel', l: 'Carrossel', hint: '2 a 10 imagens ou vídeos' },
]

function defaultWhen(tz: string) {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  d.setMinutes(0, 0, 0)
  return zonedParts(d, tz)
}

export default function PostEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const { user } = useAuth()
  const tz = user?.timezone ?? 'America/Sao_Paulo'
  const { accounts } = useAccounts()
  const navigate = useNavigate()
  const toast = useToast()

  const [post, setPost] = useState<Post | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [destination, setDestination] = useState<PostDestination>('instagram')
  const [facebookPageId, setFacebookPageId] = useState('')
  const [pages, setPages] = useState<{ pageId: string; name: string }[]>([])
  const [type, setType] = useState<PostType>('post')
  const [selected, setSelected] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState(() => defaultWhen(tz).date)
  const [time, setTime] = useState(() => defaultWhen(tz).time)
  const [library, setLibrary] = useState<MediaItem[]>([])
  const [saving, setSaving] = useState<'scheduled' | 'draft' | 'now' | null>(null)
  const [nowOpen, setNowOpen] = useState(false)
  const [error, setError] = useState<{ message?: string; fields: Record<string, string> }>({ fields: {} })
  const [dirty, setDirty] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  useBeforeUnload(dirty)

  const load = useCallback(async () => {
    setLoadError(false)
    try {
      const pageList = await api.get<{ pageId: string; name: string }[]>('/publishing/facebook-pages')
      setPages(pageList.data)
      if (!id && pageList.data.length === 1) setFacebookPageId(pageList.data[0].pageId)
      const lib = await api.get<MediaItem[]>('/media')
      let items = lib.data
      if (id) {
        const r = await api.get<Post>(`/posts/${id}`)
        setPost(r.data)
        setDestination(r.data.destination ?? 'instagram')
        setFacebookPageId(r.data.facebookPageId ?? '')
        setAccountId(r.data.accountId)
        setType(r.data.type)
        setSelected(r.data.mediaIds)
        setCaption(r.data.caption)
        const p = zonedParts(r.data.scheduledAt, tz)
        setDate(p.date)
        setTime(p.time)
        const missing = r.data.mediaIds.filter((m) => !items.some((x) => x.id === m))
        if (missing.length) {
          const extra = await api.get<MediaItem[]>(`/media?ids=${missing.join(',')}`)
          items = [...items, ...extra.data]
        }
      }
      setLibrary(items)
    } catch {
      setLoadError(true)
    }
  }, [id, tz])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (isNew && !accountId) {
      const first = accounts.find((a) => a.status === 'connected')
      if (first) setAccountId(first.id)
    }
  }, [accounts, accountId, isNew])

  const merge = useCallback((updated: MediaItem[]) => setLibrary((cur) => cur.map((m) => updated.find((u) => u.id === m.id) ?? m)), [])
  useMediaStatus(library, merge)

  const locked = post && !['draft', 'scheduled', 'failed'].includes(post.status)
  const lockReason = post?.status === 'published' ? 'Já publicada, não dá para editar.' : post?.status === 'publishing' ? 'Já em publicação, não dá para editar.' : post?.status === 'cancelled' ? 'Publicação cancelada.' : ''

  const allowedKind = type === 'post' ? 'image' : type === 'reel' ? 'video' : null
  const maxItems = type === 'carousel' ? 10 : 1
  const available = useMemo(
    () => library.filter((m) => !m.deleted && m.conversionStatus !== 'failed' && (!allowedKind || m.kind === allowedKind)),
    [library, allowedKind],
  )
  const selectedItems = selected.map((sid) => library.find((m) => m.id === sid)).filter(Boolean) as MediaItem[]

  const touch = () => setDirty(true)

  const toggle = (m: MediaItem) => {
    touch()
    setSelected((cur) => {
      if (cur.includes(m.id)) return cur.filter((x) => x !== m.id)
      if (maxItems === 1) return [m.id]
      return cur.length >= maxItems ? cur : [...cur, m.id]
    })
  }

  const move = (idx: number, dir: -1 | 1) => {
    touch()
    setSelected((cur) => {
      const next = [...cur]
      const j = idx + dir
      if (j < 0 || j >= next.length) return cur
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }

  const onUploaded = useCallback(
    (m: MediaItem) => {
      setLibrary((cur) => [m, ...cur])
      setDirty(true)
      setSelected((cur) => {
        const kindOk = type === 'carousel' || (type === 'post' ? m.kind === 'image' : m.kind === 'video')
        if (!kindOk) return cur
        if (type !== 'carousel') return [m.id]
        return cur.length >= 10 ? cur : [...cur, m.id]
      })
    },
    [type],
  )

  const submit = async (status: 'scheduled' | 'draft' | 'now') => {
    setSaving(status)
    setError({ fields: {} })
    const now = status === 'now'
    const body = {
      ...(destination !== 'facebook' ? { accountId } : {}),
      destination,
      ...(destination !== 'instagram' ? { facebookPageId } : {}),
      type,
      mediaIds: selected,
      caption,
      status: now ? 'scheduled' : status,
      ...(now ? { publishNow: true } : { scheduledAt: zonedToUtc(date, time, tz) }),
    }
    try {
      const r = isNew ? await api.post<Post>('/posts', body) : await api.patch<Post>(`/posts/${id}`, body)
      setDirty(false)
      toast({
        tone: 'success',
        text: status === 'draft' ? 'Rascunho salvo.' : now ? 'Publicando agora. Acompanhe o status na lista.' : `Agendado para ${formatDateTime(r.data.scheduledAt, tz)}.`,
        link: { to: `/publicacoes/${r.data.id}`, label: 'Ver' },
      })
      navigate('/publicacoes')
    } catch (err) {
      const e = errorInfo(err)
      setError({ message: e.message, fields: e.fields })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(null)
    }
  }

  const cancelPost = async () => {
    try {
      await api.delete(`/posts/${id}`)
      toast({ tone: 'success', text: 'Publicação cancelada.' })
      navigate('/publicacoes')
    } catch (err) {
      setError({ message: errorInfo(err).message, fields: {} })
      setCancelOpen(false)
    }
  }

  const back = () => (dirty ? setLeaveOpen(true) : navigate('/publicacoes'))

  if (loadError) return <ErrorCard onRetry={load} />
  if (!isNew && !post)
    return (
      <div role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    )

  const connected = accounts.filter((a) => a.status === 'connected' || a.id === accountId)

  return (
    <div className="pb-20">
      <PageHeader
        title={isNew ? 'Nova publicação' : 'Editar publicação'}
        actions={
          <>
            {post && <PostStatusTag status={post.status} />}
            {post?.fbPermalink && <a href={post.fbPermalink} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand underline">Ver no Facebook</a>}
            {post?.permalink && (
              <a href={post.permalink} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 text-sm font-medium text-brand underline">
                Ver no Instagram <ExternalLink size={14} aria-hidden />
              </a>
            )}
          </>
        }
      />
      <ReconnectBanners />
      {destination !== 'facebook' && <LimitBanner accountId={accountId} />}
      {post?.status === 'failed' && post.lastError && <FormError message={`Falhou: ${post.lastError} Escolha um novo horário e salve para reagendar.`} />}
      {locked && <p className="mb-4 rounded-control bg-raised px-3 py-2 text-sm text-muted">{lockReason}</p>}
      <FormError message={error.message} />

      <fieldset disabled={Boolean(locked)} className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="flex flex-col gap-4 p-5">
          <Field label="Publicar em" error={error.fields.destination}>
            {(fid, d) => <Select id={fid} aria-describedby={d} value={destination} onChange={(e) => (touch(), setDestination(e.target.value as PostDestination))}>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="both">Instagram e Facebook</option>
            </Select>}
          </Field>
          {destination !== 'instagram' && <Field label="Página do Facebook" error={error.fields.facebookPageId} hint={pages.length === 0 ? 'Conecte o Facebook na tela de Análises para escolher uma Página.' : undefined}>
            {(fid, d) => <Select id={fid} aria-describedby={d} aria-invalid={Boolean(error.fields.facebookPageId)} value={facebookPageId} onChange={(e) => (touch(), setFacebookPageId(e.target.value))}>
              <option value="">Escolha uma Página</option>
              {pages.map((p) => <option key={p.pageId} value={p.pageId}>{p.name}</option>)}
            </Select>}
          </Field>}
          {destination !== 'instagram' && type === 'carousel' && <p className="text-sm text-muted">No Facebook, o carrossel aceita apenas imagens.</p>}
          {destination !== 'facebook' && <Field label="Conta do Instagram" error={error.fields.accountId}>
            {(fid, d) => (
              <Select id={fid} aria-describedby={d} aria-invalid={Boolean(error.fields.accountId)} value={accountId} onChange={(e) => (touch(), setAccountId(e.target.value))}>
                {connected.length === 0 && <option value="">Nenhuma conta conectada</option>}
                {connected.map((a) => (
                  <option key={a.id} value={a.id}>
                    @{a.username}
                    {a.status !== 'connected' ? ' (precisa reconectar)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium" id="tipo-label">
              Tipo
            </span>
            <div role="radiogroup" aria-labelledby="tipo-label" className="grid grid-cols-3 gap-2">
              {types.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  role="radio"
                  aria-checked={type === t.v}
                  onClick={() => {
                    touch()
                    setType(t.v)
                    setSelected((cur) => (t.v === 'carousel' ? cur : cur.slice(0, 1).filter((sid) => library.find((m) => m.id === sid)?.kind === (t.v === 'post' ? 'image' : 'video'))))
                  }}
                  className={`flex flex-col items-start rounded-control border px-3 py-2 text-left ${type === t.v ? 'border-brand bg-brand-soft text-brand-ink' : 'border-control'}`}
                >
                  <span className="text-sm font-medium">{t.l}</span>
                  <span className="text-xs text-muted">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Mídias</span>
            <Uploader accept={type === 'post' ? 'image/*' : type === 'reel' ? 'video/*' : 'image/*,video/*'} multiple={type === 'carousel'} onUploaded={onUploaded} label="Enviar do computador" />
            {error.fields.mediaIds && <p className="text-xs text-negative">{error.fields.mediaIds}</p>}
            {available.length > 0 && (
              <details className="rounded-control border border-border" open={isNew}>
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Escolher da biblioteca ({available.length})</summary>
                <ul className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto p-2 sm:grid-cols-2">
                  {available.map((m) => {
                    const on = selected.includes(m.id)
                    return (
                      <li key={m.id}>
                        <label className={`flex cursor-pointer items-center gap-2 rounded-control p-1.5 ${on ? 'bg-brand-soft' : 'hover:bg-raised'}`}>
                          <input type="checkbox" checked={on} onChange={() => toggle(m)} className="h-4 w-4 accent-[var(--accent)]" />
                          <MediaThumb media={m} size={40} />
                          <span className="min-w-0 flex-1 truncate text-sm">{m.originalName}</span>
                          <ConversionTag status={m.conversionStatus} />
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </details>
            )}
          </div>

          <Field label="Legenda" error={error.fields.caption} hint={`${caption.length} de 2.200 caracteres`}>
            {(fid, d) => <Textarea id={fid} aria-describedby={d} aria-invalid={Boolean(error.fields.caption) || caption.length > 2200} rows={6} value={caption} onChange={(e) => (touch(), setCaption(e.target.value))} />}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data" error={error.fields.scheduledAt}>
              {(fid, d) => <Input id={fid} type="date" aria-describedby={d} aria-invalid={Boolean(error.fields.scheduledAt)} value={date} onChange={(e) => (touch(), setDate(e.target.value))} required />}
            </Field>
            <Field label="Hora" hint={`Fuso: ${tz.replace(/_/g, ' ')}`}>
              {(fid, d) => <Input id={fid} type="time" aria-describedby={d} value={time} onChange={(e) => (touch(), setTime(e.target.value))} required />}
            </Field>
          </div>
        </Card>

        <Card className="h-fit p-5 lg:sticky lg:top-4">
          <h2 className="mb-3 text-lg font-semibold">Prévia</h2>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma mídia escolhida.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {selectedItems.map((m, i) => (
                <li key={m.id} className="flex items-center gap-2">
                  <span className="w-4 text-xs text-faint tabular-nums">{i + 1}</span>
                  <MediaThumb media={m} size={type === 'carousel' ? 48 : 120} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{m.originalName}</p>
                    <ConversionTag status={m.conversionStatus} error={m.conversionError} />
                  </div>
                  {type === 'carousel' && (
                    <>
                      <button type="button" aria-label={`Subir ${m.originalName}`} disabled={i === 0} onClick={() => move(i, -1)} className="flex h-8 w-8 max-md:h-11 max-md:w-11 items-center justify-center rounded-control hover:bg-raised disabled:opacity-40">
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" aria-label={`Descer ${m.originalName}`} disabled={i === selectedItems.length - 1} onClick={() => move(i, 1)} className="flex h-8 w-8 max-md:h-11 max-md:w-11 items-center justify-center rounded-control hover:bg-raised disabled:opacity-40">
                        <ArrowDown size={14} />
                      </button>
                    </>
                  )}
                  <button type="button" aria-label={`Tirar ${m.originalName}`} onClick={() => toggle(m)} className="flex h-8 w-8 max-md:h-11 max-md:w-11 items-center justify-center rounded-control hover:bg-raised">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ol>
          )}
          {caption && <p className="mt-4 line-clamp-6 text-sm whitespace-pre-wrap text-muted">{caption}</p>}
        </Card>
      </fieldset>

      <div className="fixed right-0 bottom-0 left-0 z-20 border-t border-border bg-surface md:left-[230px]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-end gap-2 px-4 py-3 md:px-8">
          <Button className="mr-auto" onClick={back}>
            Voltar
          </Button>
          {!isNew && !locked && (
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              Cancelar publicação
            </Button>
          )}
          {!locked && (
            <>
              <Button onClick={() => submit('draft')} loading={saving === 'draft'} loadingText="Salvando..." disabled={saving !== null}>
                Salvar rascunho
              </Button>
              <Button onClick={() => setNowOpen(true)} loading={saving === 'now'} loadingText="Publicando..." disabled={saving !== null}>
                Publicar agora
              </Button>
              <Button variant="primary" onClick={() => submit('scheduled')} loading={saving === 'scheduled'} loadingText="Agendando..." disabled={saving !== null}>
                Agendar
              </Button>
            </>
          )}
          {locked && (
            <Link to="/publicacoes" className="text-sm font-medium text-brand underline">
              Voltar à lista
            </Link>
          )}
        </div>
      </div>

      <ConfirmDialog open={leaveOpen} title="Descartar mudanças?" message="O que você preencheu será perdido." confirmLabel="Descartar" danger onClose={() => setLeaveOpen(false)} onConfirm={() => navigate('/publicacoes')} />
      <ConfirmDialog open={nowOpen} title="Publicar agora?" message={`A publicação vai para ${destination === 'both' ? 'Instagram e Facebook' : destination === 'facebook' ? 'o Facebook' : 'o Instagram'} em instantes, ignorando a data e a hora preenchidas.`} confirmLabel="Publicar agora" onClose={() => setNowOpen(false)} onConfirm={() => (setNowOpen(false), submit('now'))} />
      <ConfirmDialog open={cancelOpen} title="Cancelar esta publicação?" message="Ela não será publicada. O arquivo é apagado em 7 dias." confirmLabel="Cancelar publicação" danger onClose={() => setCancelOpen(false)} onConfirm={cancelPost} />
    </div>
  )
}

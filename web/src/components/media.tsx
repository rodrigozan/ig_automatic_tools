import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Film, ImageIcon, Loader2, RotateCcw, Upload, X } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { formatBytes } from '../lib/format'
import type { MediaItem } from '../lib/types'
import { Button, Tag } from './ui'

export function MediaThumb({ media, size = 56 }: { media: Pick<MediaItem, 'kind' | 'url' | 'originalName'>; size?: number }) {
  const style = { width: size, height: size }
  if (!media.url)
    return (
      <span style={style} className="flex shrink-0 items-center justify-center rounded-control bg-raised text-faint">
        {media.kind === 'video' ? <Film size={16} aria-hidden /> : <ImageIcon size={16} aria-hidden />}
      </span>
    )
  return media.kind === 'video' ? (
    <video src={`${media.url}#t=0.5`} style={style} className="shrink-0 rounded-control bg-raised object-cover" muted preload="metadata" aria-label={media.originalName} />
  ) : (
    <img src={media.url} style={style} className="shrink-0 rounded-control bg-raised object-cover" alt={media.originalName} loading="lazy" />
  )
}

export function ConversionTag({ status, error }: { status: MediaItem['conversionStatus']; error?: string }) {
  if (status === 'pending' || status === 'converting')
    return (
      <Tag tone="warning" icon={<Loader2 size={12} className="animate-spin" aria-hidden />}>
        {status === 'pending' ? 'Analisando' : 'Convertendo'}
      </Tag>
    )
  if (status === 'failed')
    return (
      <span title={error}>
        <Tag tone="error" icon={<AlertCircle size={12} aria-hidden />}>
          Falhou
        </Tag>
      </span>
    )
  return (
    <Tag tone="success" icon={<CheckCircle2 size={12} aria-hidden />}>
      Pronto
    </Tag>
  )
}

export function useMediaStatus(items: MediaItem[], onUpdate: (m: MediaItem[]) => void) {
  const pending = items.filter((m) => m.conversionStatus === 'pending' || m.conversionStatus === 'converting').map((m) => m.id)
  const key = pending.join(',')
  const cb = useRef(onUpdate)
  cb.current = onUpdate
  useEffect(() => {
    if (!key) return
    const t = setInterval(async () => {
      try {
        const r = await api.get<MediaItem[]>(`/media?ids=${key}`)
        cb.current(r.data)
      } catch {
        return
      }
    }, 3000)
    return () => clearInterval(t)
  }, [key])
}

type UploadItem = { key: string; file: File; progress: number; status: 'uploading' | 'done' | 'error'; error?: string; media?: MediaItem }

export function Uploader({ accept, multiple = true, onUploaded, label = 'Enviar arquivos' }: { accept: string; multiple?: boolean; onUploaded: (m: MediaItem) => void; label?: string }) {
  const [items, setItems] = useState<UploadItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  const send = useCallback(
    async (item: UploadItem) => {
      const update = (patch: Partial<UploadItem>) => setItems((s) => s.map((x) => (x.key === item.key ? { ...x, ...patch } : x)))
      update({ status: 'uploading', progress: 0, error: undefined })
      const form = new FormData()
      form.append('files', item.file)
      try {
        const r = await api.post<MediaItem[]>('/media', form, {
          onUploadProgress: (e) => update({ progress: e.total ? Math.round((e.loaded / e.total) * 100) : 0 }),
        })
        update({ status: 'done', progress: 100, media: r.data[0] })
        onUploaded(r.data[0])
      } catch (err) {
        update({ status: 'error', error: errorInfo(err).message })
      }
    },
    [onUploaded],
  )

  const add = (files: FileList | null) => {
    if (!files) return
    const list = Array.from(files).map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, file, progress: 0, status: 'uploading' as const }))
    setItems((s) => [...s, ...list])
    list.reduce((p, item) => p.then(() => send(item)), Promise.resolve())
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          add(e.dataTransfer.files)
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-card border border-dashed px-4 py-6 text-center ${drag ? 'border-brand bg-brand-soft' : 'border-control'}`}
      >
        <Upload size={18} className="text-muted" aria-hidden />
        <p className="text-sm text-muted">Arraste os arquivos para cá ou</p>
        <Button type="button" onClick={() => inputRef.current?.click()}>
          {label}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          tabIndex={-1}
          aria-label={label}
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {items.filter((i) => i.status !== 'done').length > 0 && (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {items
            .filter((i) => i.status !== 'done')
            .map((i) => (
              <li key={i.key} className="rounded-control bg-raised px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{i.file.name}</span>
                  <span className="text-xs text-faint tabular-nums">{formatBytes(i.file.size)}</span>
                  {i.status === 'uploading' && <span className="w-10 text-right text-xs tabular-nums">{i.progress}%</span>}
                  {i.status === 'error' && (
                    <>
                      <button type="button" onClick={() => send(i)} className="flex h-8 items-center gap-1 rounded-control px-2 text-xs font-medium hover:bg-surface">
                        <RotateCcw size={12} aria-hidden /> Tentar de novo
                      </button>
                      <button type="button" aria-label={`Remover ${i.file.name}`} onClick={() => setItems((s) => s.filter((x) => x.key !== i.key))} className="flex h-8 w-8 items-center justify-center rounded-control hover:bg-surface">
                        <X size={14} />
                      </button>
                    </>
                  )}
                </div>
                {i.status === 'uploading' && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-track" role="progressbar" aria-valuenow={i.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Envio de ${i.file.name}`}>
                    <div className="h-full bg-brand transition-[width] duration-200" style={{ width: `${i.progress}%` }} />
                  </div>
                )}
                {i.status === 'error' && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-negative">
                    <AlertCircle size={12} aria-hidden /> {i.error}
                  </p>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

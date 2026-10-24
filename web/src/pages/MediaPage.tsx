import { useCallback, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { formatBytes } from '../lib/format'
import type { MediaItem } from '../lib/types'
import { Button, Card, ConfirmDialog, EmptyState, ErrorCard, PageHeader, Select, SkeletonList } from '../components/ui'
import { ConversionTag, MediaThumb, Uploader, useMediaStatus } from '../components/media'
import { useToast } from '../components/toast'

export default function MediaPage() {
  const [filter, setFilter] = useState('')
  const { data, setData, loading, error, reload } = useFetch<MediaItem[]>(`/media${filter ? `?status=${filter}` : ''}`)
  const [removing, setRemoving] = useState<MediaItem | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const items = data ?? []

  const merge = useCallback(
    (updated: MediaItem[]) => setData((cur) => (cur ?? []).map((m) => updated.find((u) => u.id === m.id) ?? m)),
    [setData],
  )
  useMediaStatus(items, merge)

  const onUploaded = useCallback((m: MediaItem) => setData((cur) => [m, ...(cur ?? [])]), [setData])

  const remove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      await api.delete(`/media/${removing.id}`)
      setData(items.filter((m) => m.id !== removing.id))
      toast({ tone: 'success', text: 'Mídia apagada.' })
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    } finally {
      setBusy(false)
      setRemoving(null)
    }
  }

  return (
    <div>
      <PageHeader title="Mídias" description="Arquivos enviados para publicar. Cada arquivo é apagado do servidor depois de publicado." />
      <Card className="mb-4 p-5">
        <Uploader accept="image/*,video/*" onUploaded={onUploaded} />
      </Card>
      <div className="mb-3 flex items-center gap-2">
        <label htmlFor="filtro-midia" className="text-sm text-muted">
          Situação
        </label>
        <Select id="filtro-midia" className="w-48" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todas</option>
          <option value="ready">Prontas</option>
          <option value="processing">Em análise ou conversão</option>
          <option value="failed">Com falha</option>
        </Select>
      </div>
      <Card>
        {loading && !data ? (
          <SkeletonList />
        ) : error ? (
          <div className="p-5">
            <ErrorCard onRetry={reload} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState text="Nenhuma mídia enviada" />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((m) => (
              <li key={m.id} className="flex min-h-[72px] items-center gap-3 px-5 py-2">
                <MediaThumb media={m} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.originalName}</p>
                  <p className="text-xs text-faint tabular-nums">
                    {m.kind === 'video' ? 'Vídeo' : 'Imagem'} · {formatBytes(m.sizeBytes)}
                    {m.width ? ` · ${m.width}×${m.height}` : ''}
                    {m.durationSec ? ` · ${Math.round(m.durationSec)} s` : ''}
                    {m.inUse ? ' · em uma publicação' : ''}
                  </p>
                  {m.conversionStatus === 'failed' && m.conversionError && <p className="text-xs text-negative">{m.conversionError}</p>}
                </div>
                <ConversionTag status={m.conversionStatus} error={m.conversionError} />
                <Button variant="ghost" aria-label={`Apagar ${m.originalName}`} title={m.inUse ? 'Em uma publicação' : 'Apagar'} onClick={() => setRemoving(m)} icon={<Trash2 size={14} />} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog open={Boolean(removing)} title="Apagar mídia?" message={removing?.originalName} confirmLabel="Apagar" danger loading={busy} onClose={() => setRemoving(null)} onConfirm={remove} />
    </div>
  )
}

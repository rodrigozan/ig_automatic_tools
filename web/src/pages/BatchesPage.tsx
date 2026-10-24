import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { useAccounts } from '../lib/accounts'
import { useAuth } from '../lib/auth'
import { formatDate, formatDateTime, weekdayShort } from '../lib/format'
import type { Batch } from '../lib/types'
import { Button, Card, ConfirmDialog, EmptyState, ErrorCard, PageHeader, PostStatusTag, Skeleton, SkeletonList, Tag } from '../components/ui'
import { useToast } from '../components/toast'

const batchStatus: Record<Batch['status'], { tone: 'brand' | 'success' | 'neutral'; label: string }> = {
  draft: { tone: 'neutral', label: 'Rascunho' },
  scheduled: { tone: 'brand', label: 'Agendado' },
  completed: { tone: 'success', label: 'Concluído' },
  cancelled: { tone: 'neutral', label: 'Cancelado' },
}

function frequency(b: Batch) {
  const days = b.mode === 'daily' ? 'Todo dia' : b.days.map((d) => weekdayShort[d]).join(', ')
  return `${days} · ${b.times.join(', ')}`
}

export default function BatchesPage() {
  const { data, loading, error, reload } = useFetch<Batch[]>('/batches')
  const { accounts } = useAccounts()
  const { user } = useAuth()
  const tz = user?.timezone ?? 'America/Sao_Paulo'
  const navigate = useNavigate()
  return (
    <div>
      <PageHeader
        title="Lotes"
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/lotes/novo')}>
            Novo lote
          </Button>
        }
      />
      <Card>
        {loading ? (
          <SkeletonList />
        ) : error ? (
          <div className="p-5">
            <ErrorCard onRetry={reload} />
          </div>
        ) : !data?.length ? (
          <EmptyState
            text="Nenhum lote ainda"
            action={
              <Button variant="primary" onClick={() => navigate('/lotes/novo')}>
                Novo lote
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((b) => (
              <li key={b.id}>
                <Link to={`/lotes/${b.id}`} className="flex min-h-[45px] flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2 hover:bg-raised">
                  <span className="min-w-40 flex-1 font-medium">{b.name || `Lote de ${formatDate(b.createdAt, tz)}`}</span>
                  <span className="text-sm text-muted">@{accounts.find((a) => a.id === b.accountId)?.username ?? '—'}</span>
                  <span className="text-sm text-muted">{frequency(b)}</span>
                  <span className="text-sm tabular-nums">
                    {b.first && b.last ? `${formatDate(b.first, tz)} a ${formatDate(b.last, tz)}` : '—'}
                  </span>
                  <span className="w-28 text-right text-sm tabular-nums">
                    {b.counts.published ?? 0}/{b.totalItems} publicados
                  </span>
                  <Tag tone={batchStatus[b.status].tone}>{batchStatus[b.status].label}</Tag>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

export function BatchDetailPage() {
  const { id } = useParams()
  const { data, loading, error, reload } = useFetch<Batch>(`/batches/${id}`)
  const { accounts } = useAccounts()
  const { user } = useAuth()
  const tz = user?.timezone ?? 'America/Sao_Paulo'
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  if (loading)
    return (
      <div role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    )
  if (error || !data) return <ErrorCard onRetry={reload} />

  const pending = (data.counts.scheduled ?? 0) + (data.counts.draft ?? 0)

  const cancel = async () => {
    setBusy(true)
    try {
      const r = await api.delete<{ cancelled: number }>(`/batches/${id}`)
      toast({ tone: 'success', text: `${r.data.cancelled} publicações canceladas.` })
      await reload()
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={data.name || `Lote de ${formatDate(data.createdAt, tz)}`}
        description={`@${accounts.find((a) => a.id === data.accountId)?.username ?? '—'} · ${frequency(data)}`}
        actions={
          <>
            <Tag tone={batchStatus[data.status].tone}>{batchStatus[data.status].label}</Tag>
            {pending > 0 && data.status === 'scheduled' && (
              <Button variant="danger" onClick={() => setOpen(true)}>
                Cancelar lote
              </Button>
            )}
          </>
        }
      />
      <Card>
        <ul className="divide-y divide-border">
          {(data.posts ?? []).map((p, i) => (
            <li key={p.id}>
              <Link to={`/publicacoes/${p.id}`} className="flex min-h-[45px] flex-wrap items-center gap-x-4 px-5 py-2 hover:bg-raised">
                <span className="w-6 text-xs text-faint tabular-nums">{i + 1}</span>
                <span className="w-28 text-sm font-medium tabular-nums">{formatDateTime(p.scheduledAt, tz)}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{p.caption || <span className="text-faint">Sem legenda</span>}</span>
                <PostStatusTag status={p.status} />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <ConfirmDialog
        open={open}
        title="Cancelar lote?"
        message={`${pending} publicações pendentes serão canceladas. As já publicadas não mudam.`}
        confirmLabel="Cancelar lote"
        danger
        loading={busy}
        onClose={() => setOpen(false)}
        onConfirm={cancel}
      />
    </div>
  )
}

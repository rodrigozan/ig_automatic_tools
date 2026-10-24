import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useFetch } from '../lib/useFetch'
import { useAccounts } from '../lib/accounts'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/format'
import type { Automation, Conversation, DmMessageItem } from '../lib/types'
import { Card, EmptyState, ErrorCard, PageHeader, Select, Skeleton, SkeletonList, StatTile, Tag } from '../components/ui'

const convStatus: Record<Conversation['status'], { tone: 'brand' | 'success' | 'neutral' | 'error'; label: string }> = {
  active: { tone: 'brand', label: 'Em andamento' },
  completed: { tone: 'success', label: 'Concluída' },
  expired: { tone: 'neutral', label: 'Fora da janela' },
  failed: { tone: 'error', label: 'Falhou' },
}

function Messages({ conversationId, tz }: { conversationId: string; tz: string }) {
  const { data, loading, error, reload } = useFetch<DmMessageItem[]>(`/conversations/${conversationId}/messages`)
  if (loading) return <SkeletonList rows={2} />
  if (error) return <ErrorCard onRetry={reload} />
  return (
    <ol className="flex flex-col gap-2 px-5 pb-4">
      {(data ?? []).map((m) => (
        <li key={m.id} className={`max-w-[85%] rounded-card px-3 py-2 text-sm ${m.direction === 'out' ? 'self-end bg-brand-soft text-brand-ink' : 'self-start bg-raised'}`}>
          {m.text ?? <span className="text-faint italic">{m.textExpired ? 'Texto apagado após 90 dias' : 'Sem texto'}</span>}
          <div className="mt-1 flex gap-2 text-[11px] text-faint tabular-nums">
            <span>{formatDateTime(m.createdAt, tz)}</span>
            {m.status === 'failed' && <span className="text-negative">Falhou{m.error ? `: ${m.error}` : ''}</span>}
            {m.status === 'queued' && <span>Na fila (limite por hora)</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function AutomationDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const tz = user?.timezone ?? 'America/Sao_Paulo'
  const { accounts } = useAccounts()
  const [status, setStatus] = useState('')
  const automation = useFetch<Automation>(`/automations/${id}`)
  const convs = useFetch<Conversation[]>(`/automations/${id}/conversations${status ? `?status=${status}` : ''}`)
  const [open, setOpen] = useState<string | null>(null)

  if (automation.loading)
    return (
      <div role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    )
  if (automation.error || !automation.data) return <ErrorCard onRetry={automation.reload} />
  const a = automation.data
  const stepIndex = (sid: string) => a.steps.findIndex((s) => s.id === sid) + 1
  const s = a.stats ?? {}
  const replied = (convs.data ?? []).filter((c) => c.replied).length

  return (
    <div>
      <PageHeader
        title={a.name}
        description={`@${accounts.find((x) => x.id === a.accountId)?.username ?? '—'} · ${a.target === 'any_post' ? 'qualquer post' : 'um post'} · ${a.matchMode === 'exact' ? 'palavra exata' : 'contém'}: ${a.keywords.join(', ')}`}
        actions={
          <>
            <Tag tone={a.active ? 'success' : 'neutral'}>{a.active ? 'Ativa' : 'Desativada'}</Tag>
            <Link to={`/automacoes/${a.id}/editar`} className="inline-flex h-9 items-center rounded-control border border-control px-3.5 text-sm font-medium hover:bg-raised">
              Editar
            </Link>
          </>
        }
      />
      <Card className="mb-4 grid grid-cols-2 divide-border md:grid-cols-5 md:divide-x">
        <StatTile label="Disparos" value={s.total ?? 0} />
        <StatTile label="Em andamento" value={s.active ?? 0} />
        <StatTile label="Concluídas" value={s.completed ?? 0} />
        <StatTile label="Responderam" value={replied} />
        <StatTile label="Falhas" value={s.failed ?? 0} />
      </Card>
      <div className="mb-3 flex items-center gap-2">
        <label htmlFor="filtro-conv" className="text-sm text-muted">
          Situação
        </label>
        <Select id="filtro-conv" className="w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todas</option>
          <option value="active">Em andamento</option>
          <option value="completed">Concluídas</option>
          <option value="expired">Fora da janela</option>
          <option value="failed">Com falha</option>
        </Select>
      </div>
      <Card>
        {convs.loading ? (
          <SkeletonList />
        ) : convs.error ? (
          <div className="p-5">
            <ErrorCard onRetry={convs.reload} />
          </div>
        ) : !convs.data?.length ? (
          <EmptyState text="Ninguém disparou esta automação ainda" />
        ) : (
          <ul className="divide-y divide-border">
            {convs.data.map((c) => (
              <li key={c.id}>
                <button type="button" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)} className="flex min-h-[45px] w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2 text-left hover:bg-raised">
                  {open === c.id ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                  <span className="min-w-32 flex-1 font-medium">{c.followerUsername ? `@${c.followerUsername}` : c.igScopedUserId}</span>
                  <span className="text-sm text-muted tabular-nums">{formatDateTime(c.startedAt, tz)}</span>
                  <span className="text-sm text-muted">Passo {stepIndex(c.currentStepId) || '—'}</span>
                  <span className="text-sm">{c.replied ? 'Respondeu' : 'Sem resposta'}</span>
                  {c.queued ? <Tag tone="warning">Limite por hora</Tag> : <Tag tone={convStatus[c.status].tone}>{convStatus[c.status].label}</Tag>}
                </button>
                {open === c.id && <Messages conversationId={c.id} tz={tz} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

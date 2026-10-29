import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, List, Plus } from 'lucide-react'
import { useFetch } from '../lib/useFetch'
import { useAccounts } from '../lib/accounts'
import { useAuth } from '../lib/auth'
import { formatDateTime, zonedParts, zonedToUtc } from '../lib/format'
import type { Post } from '../lib/types'
import { Button, Card, EmptyState, ErrorCard, PageHeader, PostStatusTag, Select, SkeletonList } from '../components/ui'
import { ReconnectBanners } from '../components/AccountBanners'
import { WeekCalendar, addDays, startOfWeek } from '../components/WeekCalendar'

import { PostDateFilter } from '../components/PostDateFilter'

const typeLabel = { post: 'Post', reel: 'Reel', carousel: 'Carrossel' }

export default function PostsPage() {
  const { user } = useAuth()
  const tz = user?.timezone ?? 'America/Sao_Paulo'
  const { accounts } = useAccounts()
  const navigate = useNavigate()
  const [view, setView] = useState<'list' | 'week'>('list')
  const [status, setStatus] = useState('scheduled,failed,draft,publishing')
  const [accountId, setAccountId] = useState('')
  const [dates, setDates] = useState<string[]>([])
  const [weekStart, setWeekStart] = useState(() => startOfWeek(zonedParts(new Date(), tz).date))

  const qs = new URLSearchParams()
  if (status && view === 'list') qs.set('status', status)
  if (accountId) qs.set('accountId', accountId)
  if (view === 'week') {
    qs.set('from', zonedToUtc(weekStart, '00:00', tz))
    qs.set('to', zonedToUtc(addDays(weekStart, 7), '00:00', tz))
  }
  if (dates.length && view === 'list') qs.set('dates', dates.join(','))
  if (view === 'list') qs.set('order', 'desc')
  const { data, loading, error, reload } = useFetch<Post[]>(`/posts?${qs}`)
  const posts = data ?? []

  return (
    <div>
      <PageHeader
        title="Publicações"
        actions={
          <>
            <Button onClick={() => navigate('/lotes/novo')}>Novo lote</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/publicacoes/nova')}>
              Nova publicação
            </Button>
          </>
        }
      />
      <ReconnectBanners />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div role="radiogroup" aria-label="Visualização" className="inline-flex rounded-control bg-raised p-1">
          {[
            { v: 'list' as const, l: 'Lista', I: List },
            { v: 'week' as const, l: 'Semana', I: CalendarDays },
          ].map(({ v, l, I }) => (
            <button key={v} role="radio" aria-checked={view === v} onClick={() => setView(v)} className={`inline-flex h-8 max-md:min-h-11 items-center gap-1.5 rounded-[6px] px-3 text-sm ${view === v ? 'bg-surface font-medium' : 'text-muted'}`}>
              <I size={14} aria-hidden /> {l}
            </button>
          ))}
        </div>
        {view === 'list' && (
          <Select aria-label="Situação" className="w-56" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="scheduled,failed,draft,publishing">Pendentes e com falha</option>
            <option value="scheduled">Agendadas</option>
            <option value="failed">Com falha</option>
            <option value="draft">Rascunhos</option>
            <option value="published">Publicadas</option>
            <option value="published,cancelled">Histórico</option>
            <option value="">Todas</option>
          </Select>
        )}
        <Select aria-label="Conta" className="w-56" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Todas as contas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              @{a.username}
            </option>
          ))}
        </Select>
        {view === 'list' && <PostDateFilter dates={dates} onChange={setDates} today={zonedParts(new Date(), tz).date} />}
      </div>
      <Card>
        {loading && !data ? (
          <SkeletonList />
        ) : error ? (
          <div className="p-5">
            <ErrorCard onRetry={reload} />
          </div>
        ) : view === 'week' ? (
          <WeekCalendar weekStart={weekStart} onChange={setWeekStart} posts={posts} accounts={accounts} timeZone={tz} />
        ) : posts.length === 0 ? (
          <EmptyState
            text={dates.length ? "Nenhuma publicação nas datas selecionadas" : "Nenhuma publicação ainda"}
            action={
              <>
                <Button variant="primary" onClick={() => navigate('/publicacoes/nova')}>
                  Nova publicação
                </Button>
                <Button onClick={() => navigate('/lotes/novo')}>Novo lote</Button>
              </>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {posts.map((p) => (
              <li key={p.id}>
                <Link to={`/publicacoes/${p.id}`} className="flex min-h-[45px] flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2 hover:bg-raised">
                  <span className="w-28 text-sm font-medium tabular-nums">{formatDateTime(p.scheduledAt, tz)}</span>
                  <span className="w-20 text-sm text-muted">{typeLabel[p.type]}</span>
                  <span className="w-36 truncate text-sm text-muted">{p.destination === 'facebook' ? 'Facebook' : `@${accounts.find((a) => a.id === p.accountId)?.username ?? '—'}${p.destination === 'both' ? ' · Facebook' : ''}`}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{p.caption || <span className="text-faint">Sem legenda</span>}</span>
                  <PostStatusTag status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

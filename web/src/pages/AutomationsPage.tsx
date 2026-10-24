import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { useAccounts } from '../lib/accounts'
import type { Automation } from '../lib/types'
import { Button, Card, ConfirmDialog, EmptyState, ErrorCard, PageHeader, SkeletonList, Tag, Toggle } from '../components/ui'
import { ReconnectBanners } from '../components/AccountBanners'
import { useToast } from '../components/toast'

export default function AutomationsPage() {
  const { data, setData, loading, error, reload } = useFetch<Automation[]>('/automations')
  const { accounts } = useAccounts()
  const navigate = useNavigate()
  const toast = useToast()
  const [removing, setRemoving] = useState<Automation | null>(null)
  const [busy, setBusy] = useState(false)

  const setActive = async (a: Automation, active: boolean) => {
    try {
      const r = await api.patch<Automation>(`/automations/${a.id}/active`, { active })
      setData((cur) => (cur ?? []).map((x) => (x.id === a.id ? { ...x, ...r.data } : x)))
      toast({ tone: 'success', text: active ? 'Automação ativada.' : 'Automação desativada.' })
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    }
  }

  const remove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      await api.delete(`/automations/${removing.id}`)
      setData((cur) => (cur ?? []).filter((x) => x.id !== removing.id))
      toast({ tone: 'success', text: 'Automação apagada.' })
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    } finally {
      setBusy(false)
      setRemoving(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Automações de DM"
        description="Quem comentar a palavra-chave recebe a mensagem por DM."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/automacoes/nova')}>
            Nova automação
          </Button>
        }
      />
      <ReconnectBanners />
      <Card>
        {loading ? (
          <SkeletonList />
        ) : error ? (
          <div className="p-5">
            <ErrorCard onRetry={reload} />
          </div>
        ) : !data?.length ? (
          <EmptyState
            text="Nenhuma automação ainda"
            action={
              <Button variant="primary" onClick={() => navigate('/automacoes/nova')}>
                Nova automação
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((a) => (
              <li key={a.id} className="flex min-h-[45px] flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2">
                <Link to={`/automacoes/${a.id}`} className="min-w-40 flex-1 font-medium hover:underline">
                  {a.name}
                </Link>
                <span className="text-sm text-muted">@{accounts.find((x) => x.id === a.accountId)?.username ?? '—'}</span>
                <span className="flex flex-wrap gap-1">
                  {a.keywords.slice(0, 3).map((k) => (
                    <Tag key={k} tone="neutral">
                      {k}
                    </Tag>
                  ))}
                  {a.keywords.length > 3 && <Tag tone="neutral">+{a.keywords.length - 3}</Tag>}
                </span>
                <span className="w-28 text-right text-sm tabular-nums">{a.stats?.total ?? 0} disparos</span>
                <Link to={`/automacoes/${a.id}/editar`} className="text-sm font-medium text-brand underline">
                  Editar
                </Link>
                <Toggle checked={a.active} label={`${a.name} ativa`} onChange={(v) => setActive(a, v)} />
                <Button variant="ghost" aria-label={`Apagar ${a.name}`} onClick={() => setRemoving(a)} icon={<Trash2 size={14} />} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={Boolean(removing)}
        title="Apagar automação?"
        message="As conversas e mensagens desta automação também serão apagadas."
        confirmLabel="Apagar"
        danger
        loading={busy}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
      />
    </div>
  )
}

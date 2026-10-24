import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Camera, CheckCircle2 } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { connectUrl, useAccounts } from '../lib/accounts'
import { useAuth } from '../lib/auth'
import { formatDate } from '../lib/format'
import { Button, Card, ConfirmDialog, EmptyState, ErrorCard, FormError, PageHeader, SkeletonList, Tag } from '../components/ui'
import { ReconnectBanners } from '../components/AccountBanners'
import { useToast } from '../components/toast'
import type { Account } from '../lib/types'

const connectErrors: Record<string, string> = {
  cancelado: 'A conexão foi cancelada no Instagram.',
  nao_profissional: 'A conta precisa ser profissional (Creator ou Business).',
  outra_pessoa: 'Esta conta do Instagram já está conectada a outro usuário.',
  falha: 'Não foi possível conectar. Tente de novo.',
}

export function ConnectButton({ label = 'Conectar conta', primary = true }: { label?: string; primary?: boolean }) {
  return (
    <a
      href={connectUrl}
      className={`inline-flex h-9 max-md:min-h-11 items-center gap-2 rounded-control px-3.5 text-sm font-medium ${
        primary ? 'bg-primary text-on-primary hover:opacity-90' : 'border border-control text-ink hover:bg-raised'
      }`}
    >
      <Camera size={16} aria-hidden /> {label}
    </a>
  )
}

export default function AccountsPage() {
  const { accounts, loading, error, reload } = useAccounts()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const [removing, setRemoving] = useState<Account | null>(null)
  const [busy, setBusy] = useState(false)
  const connected = params.get('conectada')
  const err = params.get('erro')

  useEffect(() => {
    if (connected) {
      toast({ tone: 'success', text: `@${connected} conectado.` })
      reload()
      setParams({}, { replace: true })
    }
  }, [connected, reload, setParams, toast])

  const disconnect = async () => {
    if (!removing) return
    setBusy(true)
    try {
      await api.delete(`/instagram/accounts/${removing.id}`)
      toast({ tone: 'success', text: `@${removing.username} desconectado.` })
      await reload()
    } catch (e) {
      toast({ tone: 'error', text: errorInfo(e).message })
    } finally {
      setBusy(false)
      setRemoving(null)
    }
  }

  return (
    <div>
      <PageHeader title="Contas do Instagram" description="Contas profissionais (Creator ou Business) conectadas pelo login do Instagram." actions={<ConnectButton />} />
      {err && <FormError message={connectErrors[err] ?? connectErrors.falha} />}
      <ReconnectBanners />
      <Card>
        {loading ? (
          <SkeletonList rows={2} />
        ) : error ? (
          <div className="p-5">
            <ErrorCard onRetry={reload} />
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState text="Nenhuma conta conectada" action={<ConnectButton />} />
        ) : (
          <ul className="divide-y divide-border">
            {accounts.map((a) => (
              <li key={a.id} className="flex min-h-[72px] flex-wrap items-center gap-3 px-5 py-3">
                {a.profilePictureUrl ? (
                  <img src={a.profilePictureUrl} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-raised">
                    <Camera size={16} aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">@{a.username}</p>
                  <p className="text-xs text-faint">
                    {a.accountType === 'BUSINESS' ? 'Business' : 'Creator'} · conectada em {formatDate(a.connectedAt, user?.timezone ?? 'UTC')} ·{' '}
                    <span className="tabular-nums">
                      {a.usage.used}/{a.usage.limit}
                    </span>{' '}
                    publicações em 24 h
                  </p>
                </div>
                {a.status === 'connected' ? (
                  <Tag tone="success" icon={<CheckCircle2 size={12} aria-hidden />}>
                    Conectada
                  </Tag>
                ) : (
                  <Tag tone="warning">Precisa reconectar</Tag>
                )}
                <div className="flex gap-2">
                  {a.status !== 'connected' && <ConnectButton label="Reconectar" primary={false} />}
                  <Button variant="danger" onClick={() => setRemoving(a)}>
                    Desconectar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={Boolean(removing)}
        title={`Desconectar @${removing?.username ?? ''}?`}
        message="As publicações pendentes desta conta serão canceladas e as automações desativadas. O histórico fica."
        confirmLabel="Desconectar"
        danger
        loading={busy}
        onClose={() => setRemoving(null)}
        onConfirm={disconnect}
      />
    </div>
  )
}

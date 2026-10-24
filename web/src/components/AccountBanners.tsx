import { Banner } from './ui'
import { connectUrl, useAccounts } from '../lib/accounts'

export function ReconnectBanners() {
  const { accounts } = useAccounts()
  return (
    <>
      {accounts
        .filter((a) => a.status !== 'connected')
        .map((a) => (
          <Banner
            key={a.id}
            tone="warning"
            action={
              <a href={connectUrl} className="inline-flex h-9 max-md:min-h-11 items-center rounded-control border border-control bg-surface px-3 text-sm font-medium text-ink">
                Reconectar
              </a>
            }
          >
            Reconecte @{a.username}. Enquanto isso, não dá para agendar nessa conta.
          </Banner>
        ))}
    </>
  )
}

export function LimitBanner({ accountId }: { accountId?: string }) {
  const { accounts } = useAccounts()
  const a = accounts.find((x) => x.id === accountId)
  if (!a || !a.usage.near) return null
  return (
    <Banner tone="warning">
      {a.usage.full
        ? `@${a.username} chegou ao limite de ${a.usage.limit} publicações da Meta em 24 horas. As próximas esperam a janela liberar.`
        : `@${a.username} está perto do limite da Meta: ${a.usage.used} de ${a.usage.limit} publicações nas últimas 24 horas.`}
    </Banner>
  )
}

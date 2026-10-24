import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { useAuth } from '../lib/auth'
import { formatDate } from '../lib/format'
import type { User } from '../lib/types'
import { Button, Card, ConfirmDialog, Dash, EmptyState, ErrorCard, Field, FormError, Input, PageHeader, SkeletonList, Tag, Toggle } from '../components/ui'
import { useToast } from '../components/toast'

type AdminUser = User & { counts: Record<string, number> }
type Invite = { id: string; email: string; usedAt?: string; createdAt: string }

const countLabels: [string, string][] = [
  ['accounts', 'Contas'],
  ['posts', 'Publicações'],
  ['automations', 'Automações'],
  ['conversations', 'Conversas'],
]

export default function AdminPage() {
  const { user } = useAuth()
  const toast = useToast()
  const users = useFetch<AdminUser[]>('/admin/users')
  const invites = useFetch<Invite[]>('/admin/invites')
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<{ message?: string; field?: string }>({})
  const [removing, setRemoving] = useState<Invite | null>(null)
  const tz = user?.timezone ?? 'America/Sao_Paulo'

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setError({})
    try {
      const r = await api.post<Invite>('/admin/invites', { email })
      invites.setData([r.data, ...(invites.data ?? [])])
      setEmail('')
      toast({ tone: 'success', text: `Convite criado para ${r.data.email}.` })
    } catch (err) {
      const i = errorInfo(err)
      setError({ message: i.message, field: i.fields.email })
    } finally {
      setInviting(false)
    }
  }

  const setActive = async (u: AdminUser, active: boolean) => {
    try {
      const r = await api.patch<User>(`/admin/users/${u.id}`, { active })
      users.setData((users.data ?? []).map((x) => (x.id === u.id ? { ...x, ...r.data } : x)))
      toast({ tone: 'success', text: active ? `${u.email} ativado.` : `${u.email} desativado.` })
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    }
  }

  const removeInvite = async () => {
    if (!removing) return
    try {
      await api.delete(`/admin/invites/${removing.id}`)
      invites.setData((invites.data ?? []).filter((i) => i.id !== removing.id))
    } catch (err) {
      toast({ tone: 'error', text: errorInfo(err).message })
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div>
      <PageHeader title="Admin" description="Convites e usuários. Aqui aparecem só os números, nunca o texto das DMs." />

      <h2 className="mb-3 text-lg font-semibold">Convites</h2>
      <Card className="mb-8">
        <form onSubmit={invite} className="flex flex-wrap items-end gap-3 border-b border-border p-5">
          <div className="min-w-60 flex-1">
            <Field label="E-mail para convidar" error={error.field}>
              {(id, d) => (
                <Input id={id} type="email" aria-describedby={d} aria-invalid={Boolean(error.field)} value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="nome@exemplo.com" />
              )}
            </Field>
          </div>
          <Button variant="primary" type="submit" loading={inviting} loadingText="Convidando...">
            Convidar
          </Button>
        </form>
        {error.message && !error.field && (
          <div className="px-5 pt-4">
            <FormError message={error.message} />
          </div>
        )}
        {invites.loading ? (
          <SkeletonList rows={3} />
        ) : invites.error ? (
          <div className="p-5">
            <ErrorCard onRetry={invites.reload} />
          </div>
        ) : !invites.data?.length ? (
          <EmptyState text="Nenhum convite" />
        ) : (
          <ul className="divide-y divide-border">
            {invites.data.map((i) => (
              <li key={i.id} className="flex min-h-[45px] items-center gap-3 px-5 py-1.5">
                <span className="min-w-0 flex-1 truncate">{i.email}</span>
                {i.usedAt ? <Tag tone="success">Usado em {formatDate(i.usedAt, tz)}</Tag> : <Tag tone="neutral">Aguardando</Tag>}
                <Button variant="ghost" aria-label={`Remover convite de ${i.email}`} onClick={() => setRemoving(i)} icon={<Trash2 size={14} />} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Usuários</h2>
      <Card>
        {users.loading ? (
          <SkeletonList rows={3} />
        ) : users.error ? (
          <div className="p-5">
            <ErrorCard onRetry={users.reload} />
          </div>
        ) : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela de usuários">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-5 py-3 font-normal">Usuário</th>
                  <th className="px-3 py-3 font-normal">Papel</th>
                  {countLabels.map(([, l]) => (
                    <th key={l} className="px-3 py-3 text-right font-normal">
                      {l}
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right font-normal">Ativo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(users.data ?? []).map((u) => (
                  <tr key={u.id} className="h-[45px]">
                    <td className="px-5 py-1.5">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-faint">{u.email}</div>
                    </td>
                    <td className="px-3">{u.role === 'admin' ? <Tag tone="brand">Admin</Tag> : <Tag tone="neutral">Creator</Tag>}</td>
                    {countLabels.map(([k]) => (
                      <td key={k} className="px-3 text-right tabular-nums">
                        {u.counts?.[k] ?? <Dash />}
                      </td>
                    ))}
                    <td className="px-5 text-right">
                      <Toggle checked={u.active} label={`Conta de ${u.email} ativa`} disabled={u.id === user?.id} onChange={(v) => setActive(u, v)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remover convite?"
        message={removing ? `${removing.email} não poderá mais entrar se ainda não entrou.` : ''}
        confirmLabel="Remover"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={removeInvite}
      />
    </div>
  )
}

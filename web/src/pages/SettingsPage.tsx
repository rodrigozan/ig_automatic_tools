import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api, errorInfo } from '../lib/api'
import { timezones } from '../lib/format'
import type { User, WeekdayTimes } from '../lib/types'
import { Button, Card, ConfirmDialog, Field, FormError, Input, PageHeader, Select } from '../components/ui'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { ScheduleEditor } from '../components/ScheduleEditor'
import { useToast } from '../components/toast'

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-border py-8 first:border-t-0 first:pt-0 md:grid-cols-[280px_1fr] md:gap-8">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-muted">{description}</p>
      </div>
      <Card className="p-5">{children}</Card>
    </section>
  )
}

export default function SettingsPage() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.name ?? '')
  const [tz, setTz] = useState(user?.timezone ?? 'America/Sao_Paulo')
  const [schedule, setSchedule] = useState<WeekdayTimes[]>(user?.defaultSchedule ?? [])
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<{ message?: string; fields: Record<string, string> }>({ fields: {} })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [deleting, setDeleting] = useState(false)

  if (!user) return null

  const save = async (section: string, body: Partial<User>) => {
    setSaving(section)
    setError({ fields: {} })
    try {
      const r = await api.patch<User>('/users/me', body)
      setUser(r.data)
      toast({ tone: 'success', text: 'Configurações salvas.' })
    } catch (err) {
      const e = errorInfo(err)
      setError({ message: e.message, fields: e.fields })
    } finally {
      setSaving(null)
    }
  }

  const deleteAccount = async () => {
    setDeleting(true)
    try {
      await api.delete('/users/me')
      setUser(null)
      navigate('/login', { replace: true })
    } catch (err) {
      setError({ message: errorInfo(err).message, fields: {} })
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const tzList = timezones.includes(tz) ? timezones : [tz, ...timezones]

  return (
    <div>
      <PageHeader title="Configurações" />
      <FormError message={error.message} />
      <div>
      <Section title="Perfil" description="Seu nome no painel. O e-mail vem do login.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            save('perfil', { name })
          }}
        >
          <Field label="Nome" error={error.fields.name}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={Boolean(error.fields.name)} value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />}
          </Field>
          <Field label="E-mail">{(id) => <Input id={id} value={user.email} disabled />}</Field>
          <div>
            <Button variant="primary" type="submit" loading={saving === 'perfil'} loadingText="Salvando...">
              Salvar
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Fuso horário" description="Todos os horários que você escolhe valem neste fuso.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            save('fuso', { timezone: tz })
          }}
        >
          <Field label="Fuso" error={error.fields.timezone}>
            {(id, d) => (
              <Select id={id} aria-describedby={d} value={tz} onChange={(e) => setTz(e.target.value)}>
                {tzList.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div>
            <Button type="submit" loading={saving === 'fuso'} loadingText="Salvando...">
              Salvar fuso
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Agenda padrão" description="Dias da semana e horários usados para programar os lotes. Dá para ajustar em cada lote.">
        <ScheduleEditor value={schedule} onChange={setSchedule} />
        {error.fields.defaultSchedule && <p className="mt-2 text-xs text-negative">{error.fields.defaultSchedule}</p>}
        <div className="mt-4">
          <Button onClick={() => save('agenda', { defaultSchedule: schedule })} loading={saving === 'agenda'} loadingText="Salvando...">
            Salvar agenda
          </Button>
        </div>
      </Section>

      <Section title="Tema" description="A escolha fica salva neste navegador.">
        <ThemeSwitcher />
      </Section>

      <Section title="Excluir conta" description="Apaga na hora tudo o que é seu: contas conectadas, mídias, publicações, automações e conversas.">
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>
          Excluir minha conta
        </Button>
      </Section>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Excluir sua conta?"
        message="Isso não pode ser desfeito. Digite seu e-mail para confirmar."
        confirmLabel="Excluir minha conta"
        danger
        loading={deleting}
        onClose={() => {
          setDeleteOpen(false)
          setConfirmEmail('')
        }}
        onConfirm={() => {
          if (confirmEmail.trim().toLowerCase() === user.email) deleteAccount()
        }}
      >
        <div className="mt-4">
          <Field label="Seu e-mail" error={confirmEmail && confirmEmail.trim().toLowerCase() !== user.email ? 'O e-mail não confere.' : undefined}>
            {(id, d) => <Input id={id} aria-describedby={d} value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} autoComplete="off" />}
          </Field>
        </div>
      </ConfirmDialog>
    </div>
  )
}

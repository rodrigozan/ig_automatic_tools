import { AppBrand } from '../components/AppBrand'
import { Navigate, useSearchParams } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { ThemeSwitcher } from '../components/ThemeSwitcher'

const messages: Record<string, string> = {
  not_invited: 'Seu e-mail ainda não foi liberado.',
  disabled: 'Sua conta está desativada.',
  unverified: 'O provedor não confirmou seu e-mail.',
  failed: 'Não foi possível entrar. Tente de novo.',
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#1877F2" d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07z" />
    </svg>
  )
}

export default function LoginPage() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/'
  if (!loading && user) return <Navigate to={next} replace />

  const erro = params.get('erro')
  const message = erro ? messages[erro] ?? messages.failed : params.get('expirou') ? 'Sua sessão expirou. Entre de novo.' : null
  const q = `?next=${encodeURIComponent(next)}`

  const btn =
    'flex h-10 max-md:min-h-11 w-full items-center justify-center gap-2 rounded-control border border-control bg-surface text-sm font-medium hover:bg-raised'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm rounded-card border border-card-border bg-surface p-6">
        <div className="mb-6 flex items-center gap-2">
          <AppBrand className="text-lg" />
        </div>
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="mt-1 mb-6 text-muted">Agende publicações e automatize DMs do seu Instagram.</p>
        {message && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-control bg-tag-error-bg px-3 py-2 text-sm text-tag-error-text">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
            {message}
          </div>
        )}
        <div className="flex flex-col gap-3">
          <a className={btn} href={`/ig/api/auth/google${q}`}>
            <GoogleIcon /> Entrar com Google
          </a>
          <a className={btn} href={`/ig/api/auth/facebook${q}`}>
            <FacebookIcon /> Entrar com Facebook
          </a>
        </div>
        <p className="mt-6 text-xs text-faint">Acesso só por convite.</p>
      </div>
      <div className="mt-6">
        <ThemeSwitcher />
      </div>
    </main>
  )
}

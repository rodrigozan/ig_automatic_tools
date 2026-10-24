import { Link } from 'react-router-dom'
import { Button } from '../components/ui'

function Frame({ code, title, children }: { code: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <span className="text-sm text-faint tabular-nums">{code}</span>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </div>
  )
}

export function NotFoundPage() {
  return (
    <Frame code="404" title="Página não encontrada">
      <Link to="/" className="font-medium text-brand underline">
        Ir para o Painel
      </Link>
    </Frame>
  )
}

export function ForbiddenPage() {
  return (
    <Frame code="403" title="Você não tem acesso a esta página">
      <Link to="/" className="font-medium text-brand underline">
        Ir para o Painel
      </Link>
    </Frame>
  )
}

export function ServerErrorPage({ onRetry }: { onRetry?: () => void }) {
  return (
    <Frame code="500" title="Algo deu errado. Tente de novo">
      <Button onClick={() => (onRetry ? onRetry() : window.location.reload())}>Tentar de novo</Button>
    </Frame>
  )
}

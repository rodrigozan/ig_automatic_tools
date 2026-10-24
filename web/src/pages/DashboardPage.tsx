import { Camera } from 'lucide-react'
import { Card, PageHeader } from '../components/ui'
import { ConnectButton } from './AccountsPage'
import { useAuth } from '../lib/auth'

export default function DashboardPage() {
  const { user } = useAuth()
  return (
    <div>
      <PageHeader title={`Olá, ${user?.name.split(' ')[0] ?? ''}`} description="Bem-vindo ao IG Automatic Tools." />
      <Card className="flex max-w-xl flex-col items-start gap-3 p-5">
        <Camera size={20} className="text-brand" aria-hidden />
        <h2 className="text-lg font-semibold">Conecte sua conta do Instagram</h2>
        <p className="text-muted">Conecte uma conta profissional (Creator ou Business) para agendar publicações e automatizar DMs.</p>
        <ConnectButton label="Conectar" />
      </Card>
    </div>
  )
}

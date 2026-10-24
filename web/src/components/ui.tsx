import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Loader2, Ban, FileText, CalendarClock } from 'lucide-react'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
  loadingText?: string
  icon?: ReactNode
}

export function Button({ variant = 'secondary', loading, loadingText, icon, children, className = '', disabled, ...rest }: BtnProps) {
  const base =
    'inline-flex h-9 max-md:min-h-11 items-center justify-center gap-2 rounded-control px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50'
  const styles = {
    primary: 'bg-primary text-on-primary hover:opacity-90',
    secondary: 'border border-control bg-transparent text-ink hover:bg-raised',
    ghost: 'text-muted hover:bg-raised hover:text-ink',
    danger: 'border border-control text-negative hover:bg-raised',
  }[variant]
  return (
    <button className={`${base} ${styles} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon}
      {loading && loadingText ? loadingText : children}
    </button>
  )
}

export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-card border border-card-border bg-surface ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

type FieldProps = { label: string; error?: string; hint?: string; children: (id: string, describedBy?: string) => ReactNode }

export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId()
  const descId = error || hint ? `${id}-desc` : undefined
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id, descId)}
      {error ? (
        <p id={descId} className="flex items-center gap-1 text-xs text-negative">
          <AlertCircle size={14} aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={descId} className="text-xs text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

const controlCls =
  'rounded-control border border-control bg-surface px-3 text-sm text-ink placeholder:text-faint disabled:opacity-50 aria-[invalid=true]:border-negative'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...rest }, ref) {
  return <input ref={ref} className={`h-10 ${controlCls} ${/\bw-/.test(className) ? '' : 'w-full'} ${className}`} {...rest} />
})

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`h-10 ${controlCls} ${/\bw-/.test(className) ? '' : 'w-full'} ${className}`} {...rest}>
      {children}
    </select>
  )
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${/\bmin-h-/.test(className) ? '' : 'min-h-24'} w-full py-2 ${controlCls} ${className}`} {...rest} />
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-50 md:h-7 md:w-7"
    >
      <span className={`relative h-4 w-7 rounded-full transition-colors duration-150 ${checked ? 'bg-toggle-on' : 'bg-control'}`}>
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full transition-transform duration-150 ${checked ? 'translate-x-3.5 bg-ground' : 'translate-x-0.5 bg-surface'}`}
        />
      </span>
    </button>
  )
}

type TagTone = 'success' | 'error' | 'warning' | 'neutral' | 'brand'

export function Tag({ tone, children, icon }: { tone: TagTone; children: ReactNode; icon?: ReactNode }) {
  const cls = {
    success: 'bg-tag-success-bg text-tag-success-text',
    error: 'bg-tag-error-bg text-tag-error-text',
    warning: 'bg-tag-warning-bg text-tag-warning-text',
    neutral: 'bg-tag-neutral-bg text-tag-neutral-text',
    brand: 'bg-tag-brand-bg text-tag-brand-text',
  }[tone]
  return (
    <span className={`inline-flex h-5 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap ${cls}`}>
      {icon}
      {children}
    </span>
  )
}

const postStatus: Record<string, { tone: TagTone; label: string; Icon: typeof Clock }> = {
  draft: { tone: 'neutral', label: 'Rascunho', Icon: FileText },
  scheduled: { tone: 'brand', label: 'Agendado', Icon: CalendarClock },
  publishing: { tone: 'warning', label: 'Publicando', Icon: Loader2 },
  published: { tone: 'success', label: 'Publicado', Icon: CheckCircle2 },
  failed: { tone: 'error', label: 'Falhou', Icon: AlertCircle },
  cancelled: { tone: 'neutral', label: 'Cancelado', Icon: Ban },
}

export function PostStatusTag({ status }: { status: string }) {
  const s = postStatus[status] ?? postStatus.draft
  return (
    <Tag tone={s.tone} icon={<s.Icon size={12} aria-hidden />}>
      {s.label}
    </Tag>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-control bg-raised ${className}`} aria-hidden />
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 p-5" aria-label="Carregando" role="status">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  )
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
      <p className="text-muted">{text}</p>
      {action && <div className="flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function ErrorCard({ message = 'Algo deu errado', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-start gap-3 p-5" role="alert">
      <p className="flex items-center gap-2 font-medium text-negative">
        <AlertCircle size={16} aria-hidden /> {message}
      </p>
      {onRetry && <Button onClick={onRetry}>Tentar de novo</Button>}
    </Card>
  )
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div role="alert" className="mb-4 flex items-start gap-2 rounded-control bg-tag-error-bg px-3 py-2 text-sm text-tag-error-text">
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  )
}

export function Banner({ tone, children, action }: { tone: 'warning' | 'error'; children: ReactNode; action?: ReactNode }) {
  const cls = tone === 'warning' ? 'bg-tag-warning-bg text-tag-warning-text' : 'bg-tag-error-bg text-tag-error-text'
  return (
    <div role="status" className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-control px-4 py-2.5 text-sm ${cls}`}>
      <span className="flex items-center gap-2">
        <AlertTriangle size={16} aria-hidden /> {children}
      </span>
      {action}
    </div>
  )
}

export function Dash() {
  return <span className="text-faint">—</span>
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-card border border-card-border bg-surface p-0 text-ink backdrop:bg-black/50"
    >
      {open && (
        <div className="p-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="mt-3">{children}</div>
        </div>
      )}
    </dialog>
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean
  title: string
  message?: ReactNode
  confirmLabel: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
  children?: ReactNode
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      {message && <div className="text-muted">{message}</div>}
      {children}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Voltar</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 p-5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-2xl font-medium tabular-nums">{value}</span>
    </div>
  )
}

export { CheckCircle2, AlertCircle }

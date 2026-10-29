import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './ui'
import { addDays } from './WeekCalendar'

export function PostDateFilter({ dates, onChange, today }: { dates: string[]; onChange: (dates: string[]) => void; today: string }) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => (dates[0] ?? today).slice(0, 7) + '-01')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const first = new Date(`${month}T12:00:00Z`)
  const offset = (first.getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const shiftMonth = (amount: number) => setMonth(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + amount, 1)).toISOString().slice(0, 10))
  const label = dates.length === 0 ? 'Todas as datas' : dates.length === 1 ? dates[0].split('-').reverse().join('/') : `${dates.length} dias selecionados`
  return (
    <div ref={root} className="relative max-sm:w-full" onKeyDown={(event) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }}>
      <button ref={trigger} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="inline-flex h-10 items-center gap-2 rounded-control border border-control bg-surface px-3 text-sm hover:bg-raised">
        <CalendarDays size={16} aria-hidden />{label}
      </button>
      {open && <div id={id} role="group" aria-label="Filtrar por datas" className="absolute left-0 top-full z-20 mt-2 w-[min(304px,calc(100vw-48px))] rounded-card border border-control bg-surface p-3 shadow-lg">
        <div className="mb-2 flex items-center justify-between">
          <Button aria-label="Mês anterior" variant="ghost" onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></Button>
          <span className="text-sm font-medium capitalize" aria-live="polite">{first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
          <Button aria-label="Próximo mês" variant="ghost" onClick={() => shiftMonth(1)}><ChevronRight size={16} /></Button>
        </div>
        <p className="mb-3 text-xs text-muted">Marque um ou mais dias para filtrar.</p>
        <div className="grid grid-cols-7 gap-1">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => <span key={day} className="py-1 text-center text-xs text-muted">{day}</span>)}
          {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
          {Array.from({ length: count }, (_, i) => {
            const date = addDays(month, i)
            const selected = dates.includes(date)
            return <button key={date} type="button" aria-label={date.split('-').reverse().join('/')} aria-pressed={selected} aria-current={date === today ? 'date' : undefined} onClick={() => onChange(selected ? dates.filter(d => d !== date) : [...dates, date].sort())} className={`h-9 rounded-control text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 ${selected ? 'bg-primary text-on-primary' : 'hover:bg-raised'} ${date === today && !selected ? 'font-bold text-brand' : ''}`}>{i + 1}</button>
          })}
        </div>
        <div className="mt-3 flex justify-between gap-2">
          <Button variant="ghost" disabled={!dates.length} onClick={() => onChange([])}>Limpar</Button>
          <Button onClick={() => { setOpen(false); trigger.current?.focus() }}>Concluir</Button>
        </div>
      </div>}
    </div>
  )
}

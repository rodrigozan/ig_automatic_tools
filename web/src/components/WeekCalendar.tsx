import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { weekdayShort, zonedParts } from '../lib/format'
import type { Account, Post } from '../lib/types'
import { PostStatusTag } from './ui'

export function startOfWeek(date: string) {
  const d = new Date(`${date}T12:00:00Z`)
  const dow = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const typeLabel = { post: 'Post', reel: 'Reel', carousel: 'Carrossel' }

export function WeekCalendar({
  weekStart,
  onChange,
  posts,
  accounts,
  timeZone,
}: {
  weekStart: string
  onChange: (weekStart: string) => void
  posts: Post[]
  accounts: Account[]
  timeZone: string
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = zonedParts(new Date(), timeZone).date
  const byDay = new Map<string, Post[]>()
  for (const p of posts) {
    const { date } = zonedParts(p.scheduledAt, timeZone)
    byDay.set(date, [...(byDay.get(date) ?? []), p])
  }
  const label = `${days[0].split('-').reverse().slice(0, 2).join('/')} a ${days[6].split('-').reverse().slice(0, 2).join('/')}`
  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="font-medium tabular-nums">Semana de {label}</span>
        <div className="flex gap-1">
          <button aria-label="Semana anterior" onClick={() => onChange(addDays(weekStart, -7))} className="flex h-9 w-9 max-md:h-11 max-md:w-11 items-center justify-center rounded-control hover:bg-raised">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => onChange(startOfWeek(today))} className="h-9 max-md:h-11 rounded-control px-3 text-sm hover:bg-raised">
            Hoje
          </button>
          <button aria-label="Próxima semana" onClick={() => onChange(addDays(weekStart, 7))} className="flex h-9 w-9 max-md:h-11 max-md:w-11 items-center justify-center rounded-control hover:bg-raised">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-7 md:divide-x md:divide-y-0">
        {days.map((d, i) => {
          const list = (byDay.get(d) ?? []).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
          return (
            <div key={d} className="min-h-24 p-2 md:min-h-56">
              <div className={`mb-2 flex items-baseline gap-1.5 px-1 text-xs ${d === today ? 'font-semibold text-brand' : 'text-muted'}`}>
                <span>{weekdayShort[(i + 1) % 7]}</span>
                <span className="tabular-nums">{d.slice(8)}</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {list.map((p) => (
                  <li key={p.id}>
                    <Link to={`/publicacoes/${p.id}`} className="block rounded-control bg-raised px-2 py-1.5 text-xs hover:outline hover:outline-1 hover:outline-control">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium tabular-nums">{zonedParts(p.scheduledAt, timeZone).time}</span>
                        <span className="text-faint">{typeLabel[p.type]}</span>
                      </div>
                      <div className="truncate text-muted">@{accounts.find((a) => a.id === p.accountId)?.username ?? '—'}</div>
                      <div className="mt-1">
                        <PostStatusTag status={p.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

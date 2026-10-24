import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { weekdayNames } from '../lib/format'
import type { WeekdayTimes } from '../lib/types'
import { Button, Input } from './ui'

export function ScheduleEditor({ value, onChange }: { value: WeekdayTimes[]; onChange: (v: WeekdayTimes[]) => void }) {
  const [draft, setDraft] = useState<Record<number, string>>({})
  const byDay = new Map(value.map((d) => [d.weekday, d.times]))

  const setDay = (weekday: number, times: string[]) => {
    const rest = value.filter((d) => d.weekday !== weekday)
    onChange((times.length ? [...rest, { weekday, times: [...new Set(times)].sort() }] : rest).sort((a, b) => a.weekday - b.weekday))
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {weekdayNames.map((name, weekday) => {
        const times = byDay.get(weekday) ?? []
        return (
          <div key={weekday} className="flex flex-wrap items-center gap-2 py-2.5">
            <span className="w-20 text-sm font-medium">{name}</span>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {times.length === 0 && <span className="text-xs text-faint">Sem horários</span>}
              {times.map((t) => (
                <span key={t} className="inline-flex h-7 items-center gap-1 rounded-full bg-raised pr-1 pl-2.5 text-sm tabular-nums">
                  {t}
                  <button
                    type="button"
                    aria-label={`Remover ${t} de ${name}`}
                    onClick={() => setDay(weekday, times.filter((x) => x !== t))}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:text-ink"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                aria-label={`Novo horário para ${name}`}
                className="w-28"
                value={draft[weekday] ?? ''}
                onChange={(e) => setDraft({ ...draft, [weekday]: e.target.value })}
              />
              <Button
                type="button"
                aria-label={`Adicionar horário em ${name}`}
                icon={<Plus size={14} />}
                disabled={!draft[weekday]}
                onClick={() => {
                  setDay(weekday, [...times, draft[weekday]])
                  setDraft({ ...draft, [weekday]: '' })
                }}
              >
                Adicionar
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

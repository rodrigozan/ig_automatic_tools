export type WeekdayTimes = { weekday: number; times: string[] }

export type User = {
  id: string
  name: string
  email: string
  avatarUrl?: string
  role: 'admin' | 'creator'
  timezone: string
  defaultSchedule: WeekdayTimes[]
  active: boolean
  providers: string[]
  createdAt: string
}

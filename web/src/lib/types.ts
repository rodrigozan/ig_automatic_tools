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

export type Account = {
  id: string
  igUserId: string
  username: string
  accountType: string
  profilePictureUrl?: string
  status: 'connected' | 'expired' | 'revoked'
  tokenExpiresAt: string
  connectedAt: string
  usage: { used: number; limit: number; near: boolean; full: boolean }
  firstStepButtons: boolean
}

export type MediaItem = {
  id: string
  kind: 'video' | 'image'
  originalName: string
  mimeType: string
  sizeBytes: number
  durationSec?: number
  width?: number
  height?: number
  conversionStatus: 'pending' | 'converting' | 'done' | 'not_needed' | 'failed'
  conversionError?: string
  deleted: boolean
  url: string | null
  createdAt: string
  inUse?: boolean
}

export type PostType = 'post' | 'reel' | 'carousel'
export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled'

export type Post = {
  id: string
  accountId: string
  batchId?: string
  type: PostType
  mediaIds: string[]
  caption: string
  scheduledAt: string
  status: PostStatus
  attempts: number
  nextAttemptAt?: string
  lastError?: string
  igMediaId?: string
  permalink?: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

export type Batch = {
  id: string
  accountId: string
  name?: string
  mode: 'daily' | 'selected_days'
  days: number[]
  times: string[]
  startDate: string
  status: 'draft' | 'scheduled' | 'completed' | 'cancelled'
  totalItems: number
  counts: Record<string, number>
  first?: string
  last?: string
  createdAt: string
  posts?: Post[]
}

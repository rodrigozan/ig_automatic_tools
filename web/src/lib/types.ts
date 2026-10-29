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

export type PostDestination = 'instagram' | 'facebook' | 'both'

export type Post = {
  destination?: PostDestination
  facebookPageId?: string
  fbPostId?: string
  fbPermalink?: string
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

export type DmButton = { label: string; type: 'postback' | 'url'; url?: string; nextStepId?: string | null }
export type DmStep = { id: string; text: string; buttons: DmButton[] }

export type Automation = {
  id: string
  accountId: string
  name: string
  target: 'specific_post' | 'any_post'
  igMediaId?: string
  keywords: string[]
  matchMode: 'contains' | 'exact'
  startStepId: string
  steps: DmStep[]
  active: boolean
  createdAt: string
  updatedAt: string
  stats?: Record<string, number>
}

export type Conversation = {
  id: string
  followerUsername?: string
  igScopedUserId: string
  currentStepId: string
  status: 'active' | 'completed' | 'expired' | 'failed'
  queued: boolean
  buttonsPending: boolean
  windowExpiresAt: string
  startedAt: string
  completedAt?: string
  replied: boolean
  messages: { in: number; out: number }
}

export type DmMessageItem = { id: string; direction: 'in' | 'out'; text: string | null; textExpired: boolean; stepId?: string; status: string; error?: string; createdAt: string }

export type IgPost = { id: string; caption?: string; mediaType: string; thumbnailUrl?: string; mediaUrl?: string; permalink?: string; timestamp?: string }

export type ContentKind = 'image' | 'reel' | 'video' | 'carousel' | 'text'
export type ProfileActivity = 'active' | 'irregular' | 'abandoned' | 'insufficient'
export type EngagementLevel = 'high' | 'medium' | 'low' | 'unknown'

export type ProfileMetrics = {
  followers: number
  following?: number
  mediaCount: number
  postsAnalyzed: number
  lastPostAt?: string
  daysSinceLastPost?: number
  postsLast30d: number
  postsPerWeek: number
  avgLikes?: number
  avgComments?: number
  avgShares?: number
  engagementRate?: number
  likesHidden: boolean
  contentMix: Record<ContentKind, number>
  activity: ProfileActivity
  engagementLevel: EngagementLevel
  topPosts: { id: string; kind: ContentKind; likes: number; comments: number; timestamp?: string; permalink?: string; caption: string }[]
  hasWebsite: boolean
  hasBio: boolean
}

export type ProfileAnalysis = {
  id: string
  username: string
  kind: 'own' | 'competitor' | 'lookup'
  profile: { name?: string; biography?: string; website?: string; profilePictureUrl?: string }
  metrics: ProfileMetrics | null
  error: string | null
  fetchedAt: string
}

export type AnalysisOverview = {
  facebook: { configured: boolean; connected: boolean }
  own: { accountId: string; username: string; analysis: ProfileAnalysis | null; error: string | null }[]
  competitors: ProfileAnalysis[]
}

export type PageOverview = {
  facebook: { configured: boolean; connected: boolean }
  own: { pageId: string; name: string; analysis: ProfileAnalysis | null; error: string | null }[]
  competitors: ProfileAnalysis[]
}

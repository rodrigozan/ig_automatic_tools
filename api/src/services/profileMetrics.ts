// Métricas de um perfil a partir do que a API devolve: dados do perfil e os posts mais recentes.
// Função pura (sem rede nem banco): é o que o comparativo da tela e a prospecção do Harvey leem.

export type RawProfile = {
  username: string;
  name?: string;
  biography?: string;
  website?: string;
  profilePictureUrl?: string;
  followers: number;
  following?: number;
  mediaCount: number;
};

export type RawPost = {
  id: string;
  caption?: string;
  mediaType: string; // IMAGE | VIDEO | CAROUSEL_ALBUM | TEXT (só Páginas do Facebook)
  productType?: string; // FEED | REELS | STORY ...
  likes?: number; // ausente quando o perfil esconde as curtidas
  comments?: number;
  timestamp?: string;
  permalink?: string;
};

export type ContentKind = "image" | "reel" | "video" | "carousel" | "text";
export type Activity = "active" | "irregular" | "abandoned" | "insufficient";
export type EngagementLevel = "high" | "medium" | "low" | "unknown";

export type TopPost = { id: string; kind: ContentKind; likes: number; comments: number; timestamp?: string; permalink?: string; caption: string };

export type ProfileMetrics = {
  followers: number;
  following?: number;
  mediaCount: number;
  postsAnalyzed: number;
  lastPostAt?: string;
  daysSinceLastPost?: number;
  postsLast30d: number;
  postsPerWeek: number;
  avgLikes?: number;
  avgComments?: number;
  engagementRate?: number; // % dos seguidores que curte ou comenta, por post
  likesHidden: boolean;
  contentMix: Record<ContentKind, number>; // participação, 0 a 1
  activity: Activity;
  engagementLevel: EngagementLevel;
  topPosts: TopPost[];
  hasWebsite: boolean;
  hasBio: boolean;
};

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export function contentKind(p: Pick<RawPost, "mediaType" | "productType">): ContentKind {
  if (p.mediaType === "TEXT") return "text";
  if (p.mediaType === "CAROUSEL_ALBUM") return "carousel";
  if (p.productType === "REELS") return "reel";
  if (p.mediaType === "VIDEO") return "video";
  return "image";
}

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

export function engagementLevel(rate: number | undefined): EngagementLevel {
  if (rate === undefined) return "unknown";
  if (rate >= 3) return "high";
  if (rate >= 1) return "medium";
  return "low";
}

export function activityLevel(analyzed: number, daysSinceLast: number | undefined, postsPerWeek: number): Activity {
  if (analyzed < 3 || daysSinceLast === undefined) return analyzed === 0 ? "abandoned" : "insufficient";
  if (daysSinceLast > 60 || postsPerWeek < 0.25) return "abandoned";
  if (daysSinceLast <= 14 && postsPerWeek >= 1) return "active";
  return "irregular";
}

export function computeMetrics(profile: RawProfile, posts: RawPost[], now: Date = new Date()): ProfileMetrics {
  const dated = posts
    .map((p) => ({ ...p, at: p.timestamp ? Date.parse(p.timestamp) : NaN }))
    .filter((p) => Number.isFinite(p.at))
    .sort((a, b) => b.at - a.at);
  const t = now.getTime();
  const last = dated[0];
  const daysSinceLastPost = last ? Math.max(0, Math.floor((t - last.at) / DAY)) : undefined;
  const postsLast30d = dated.filter((p) => t - p.at <= 30 * DAY).length;

  // Ritmo: posts dos últimos 90 dias por semana. Se a lista veio cheia e o mais antigo ainda cabe
  // nos 90 dias, a janela real é menor e o ritmo seria subestimado: usa o intervalo observado.
  const in90 = dated.filter((p) => t - p.at <= 90 * DAY);
  const oldest = dated[dated.length - 1];
  const windowMs = oldest && in90.length === dated.length && dated.length >= 30 ? Math.max(t - oldest.at, DAY) : 90 * DAY;
  const postsPerWeek = round(in90.length / (windowMs / WEEK));

  const withLikes = dated.filter((p) => typeof p.likes === "number");
  const likesHidden = dated.length > 0 && withLikes.length === 0;
  const avgLikes = withLikes.length ? round(withLikes.reduce((s, p) => s + (p.likes ?? 0), 0) / withLikes.length, 1) : undefined;
  const withComments = dated.filter((p) => typeof p.comments === "number");
  const avgComments = withComments.length ? round(withComments.reduce((s, p) => s + (p.comments ?? 0), 0) / withComments.length, 1) : undefined;
  const interactions = avgLikes !== undefined || avgComments !== undefined ? (avgLikes ?? 0) + (avgComments ?? 0) : undefined;
  const engagementRate = interactions !== undefined && profile.followers > 0 && !likesHidden ? round((interactions / profile.followers) * 100) : undefined;

  const mix: Record<ContentKind, number> = { image: 0, reel: 0, video: 0, carousel: 0, text: 0 };
  for (const p of dated) mix[contentKind(p)] += 1;
  if (dated.length) for (const k of Object.keys(mix) as ContentKind[]) mix[k] = round(mix[k] / dated.length);

  const topPosts = [...dated]
    .sort((a, b) => (b.likes ?? 0) + (b.comments ?? 0) - ((a.likes ?? 0) + (a.comments ?? 0)))
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      kind: contentKind(p),
      likes: p.likes ?? 0,
      comments: p.comments ?? 0,
      timestamp: p.timestamp,
      permalink: p.permalink,
      caption: (p.caption ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
    }));

  return {
    followers: profile.followers,
    following: profile.following,
    mediaCount: profile.mediaCount,
    postsAnalyzed: dated.length,
    lastPostAt: last ? new Date(last.at).toISOString() : undefined,
    daysSinceLastPost,
    postsLast30d,
    postsPerWeek,
    avgLikes,
    avgComments,
    engagementRate,
    likesHidden,
    contentMix: mix,
    activity: activityLevel(dated.length, daysSinceLastPost, postsPerWeek),
    engagementLevel: engagementLevel(engagementRate),
    topPosts,
    hasWebsite: Boolean(profile.website),
    hasBio: Boolean((profile.biography ?? "").trim()),
  };
}

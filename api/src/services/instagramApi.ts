import axios, { AxiosError } from "axios";
import { config } from "../config";

const GRAPH = "https://graph.instagram.com";
const VERSION = "v23.0";

export const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
];

export class IgApiError extends Error {
  constructor(
    message: string,
    public code?: number,
    public subcode?: number,
    public status?: number
  ) {
    super(message);
  }
  get tokenInvalid() {
    return this.code === 190;
  }
}

function wrap(err: unknown): never {
  const e = err as AxiosError<{ error?: { message?: string; code?: number; error_subcode?: number }; error_message?: string }>;
  const data = e.response?.data;
  const msg = data?.error?.message ?? data?.error_message ?? e.message ?? "Erro na API do Instagram";
  throw new IgApiError(msg, data?.error?.code, data?.error?.error_subcode, e.response?.status);
}

async function get<T>(path: string, params: Record<string, unknown>): Promise<T> {
  try {
    return (await axios.get<T>(`${GRAPH}/${VERSION}${path}`, { params, timeout: 30_000 })).data;
  } catch (err) {
    wrap(err);
  }
}

async function post<T>(path: string, params: Record<string, unknown>, body?: unknown): Promise<T> {
  try {
    return (await axios.post<T>(`${GRAPH}/${VERSION}${path}`, body ?? null, { params, timeout: 60_000 })).data;
  } catch (err) {
    wrap(err);
  }
}

const FB_GRAPH = "https://graph.facebook.com";
const FB_VERSION = "v23.0";

async function fbGet<T>(path: string, params: Record<string, unknown>): Promise<T> {
  try {
    return (await axios.get<T>(`${FB_GRAPH}/${FB_VERSION}${path}`, { params, timeout: 30_000 })).data;
  } catch (err) {
    wrap(err);
  }
}

export const FB_ANALYSIS_SCOPES = ["instagram_basic", "pages_show_list", "pages_read_engagement"];

export type AnalysisSource = { profile: import("./profileMetrics").RawProfile; posts: import("./profileMetrics").RawPost[] };
export type FbPage = { pageId: string; pageName: string; pageToken: string; igUserId?: string; igUsername?: string };

type RawMedia = { id: string; caption?: string; media_type: string; media_product_type?: string; like_count?: number; comments_count?: number; timestamp?: string; permalink?: string };
const MEDIA_FIELDS = "id,caption,media_type,media_product_type,like_count,comments_count,timestamp,permalink";
const mapMedia = (m: RawMedia) => ({
  id: m.id,
  caption: m.caption,
  mediaType: m.media_type,
  productType: m.media_product_type,
  likes: m.like_count,
  comments: m.comments_count,
  timestamp: m.timestamp,
  permalink: m.permalink,
});

export type IgProfile = { igUserId: string; username: string; accountType: string; profilePictureUrl?: string };
export type IgMediaItem = { id: string; caption?: string; mediaType: string; thumbnailUrl?: string; mediaUrl?: string; permalink?: string; timestamp?: string };
export type ContainerParams = Record<string, string | boolean>;
export type DmMessage = { text: string; buttons?: { type: "postback" | "url"; title: string; payload?: string; url?: string }[] };

function messagePayload(m: DmMessage) {
  if (!m.buttons?.length) return { text: m.text };
  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: m.text,
        buttons: m.buttons.map((b) =>
          b.type === "url" ? { type: "web_url", url: b.url, title: b.title } : { type: "postback", title: b.title, payload: b.payload }
        ),
      },
    },
  };
}

export function instagramCallbackUrl() {
  return `${config.publicBaseUrl}/api/instagram/callback`;
}

export const igApi = {
  authUrl(state: string) {
    const p = new URLSearchParams({
      client_id: config.instagramAppId,
      redirect_uri: instagramCallbackUrl(),
      response_type: "code",
      scope: IG_SCOPES.join(","),
      state,
      enable_fb_login: "0",
      force_authentication: "1",
    });
    return `https://www.instagram.com/oauth/authorize?${p}`;
  },

  async exchangeCode(code: string): Promise<{ accessToken: string; expiresIn: number }> {
    let shortToken: string;
    try {
      const form = new URLSearchParams({
        client_id: config.instagramAppId,
        client_secret: config.instagramAppSecret,
        grant_type: "authorization_code",
        redirect_uri: instagramCallbackUrl(),
        code,
      });
      const r = await axios.post("https://api.instagram.com/oauth/access_token", form, { timeout: 30_000 });
      shortToken = r.data.access_token;
    } catch (err) {
      wrap(err);
    }
    try {
      const r = await axios.get(`${GRAPH}/access_token`, {
        params: { grant_type: "ig_exchange_token", client_secret: config.instagramAppSecret, access_token: shortToken },
        timeout: 30_000,
      });
      return { accessToken: r.data.access_token, expiresIn: r.data.expires_in };
    } catch (err) {
      wrap(err);
    }
  },

  async refreshToken(token: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const r = await axios.get(`${GRAPH}/refresh_access_token`, {
        params: { grant_type: "ig_refresh_token", access_token: token },
        timeout: 30_000,
      });
      return { accessToken: r.data.access_token, expiresIn: r.data.expires_in };
    } catch (err) {
      wrap(err);
    }
  },

  async profile(token: string): Promise<IgProfile> {
    const d = await get<{ user_id: string; username: string; account_type: string; profile_picture_url?: string }>("/me", {
      fields: "user_id,username,account_type,profile_picture_url",
      access_token: token,
    });
    return { igUserId: String(d.user_id), username: d.username, accountType: d.account_type, profilePictureUrl: d.profile_picture_url };
  },

  async ownsId(id: string, token: string, username: string): Promise<boolean> {
    const d = await get<{ username?: string }>(`/${id}`, { fields: "username", access_token: token });
    return !!d.username && d.username.toLowerCase() === username.toLowerCase();
  },

  async subscribeWebhooks(igUserId: string, token: string) {
    await post(`/${igUserId}/subscribed_apps`, { subscribed_fields: "comments,messages,messaging_postbacks", access_token: token });
  },

  async unsubscribeWebhooks(igUserId: string, token: string) {
    try {
      await axios.delete(`${GRAPH}/${VERSION}/${igUserId}/subscribed_apps`, { params: { access_token: token }, timeout: 30_000 });
    } catch (err) {
      wrap(err);
    }
  },

  async listMedia(igUserId: string, token: string): Promise<IgMediaItem[]> {
    const d = await get<{ data: { id: string; caption?: string; media_type: string; thumbnail_url?: string; media_url?: string; permalink?: string; timestamp?: string }[] }>(
      `/${igUserId}/media`,
      { fields: "id,caption,media_type,thumbnail_url,media_url,permalink,timestamp", limit: 30, access_token: token }
    );
    return d.data.map((m) => ({
      id: m.id,
      caption: m.caption,
      mediaType: m.media_type,
      thumbnailUrl: m.thumbnail_url,
      mediaUrl: m.media_url,
      permalink: m.permalink,
      timestamp: m.timestamp,
    }));
  },

  async publishingLimit(igUserId: string, token: string): Promise<{ quotaTotal?: number; quotaUsage?: number }> {
    const d = await get<{ data: { config?: { quota_total?: number }; quota_usage?: number }[] }>(`/${igUserId}/content_publishing_limit`, {
      fields: "config,quota_usage",
      access_token: token,
    });
    return { quotaTotal: d.data[0]?.config?.quota_total, quotaUsage: d.data[0]?.quota_usage };
  },

  async createContainer(igUserId: string, token: string, params: ContainerParams): Promise<string> {
    const d = await post<{ id: string }>(`/${igUserId}/media`, { ...params, access_token: token });
    return d.id;
  },

  async containerStatus(containerId: string, token: string): Promise<{ statusCode: string; status?: string }> {
    const d = await get<{ status_code: string; status?: string }>(`/${containerId}`, { fields: "status_code,status", access_token: token });
    return { statusCode: d.status_code, status: d.status };
  },

  async publishContainer(igUserId: string, token: string, creationId: string): Promise<string> {
    const d = await post<{ id: string }>(`/${igUserId}/media_publish`, { creation_id: creationId, access_token: token });
    return d.id;
  },

  async permalink(mediaId: string, token: string): Promise<string | undefined> {
    const d = await get<{ permalink?: string }>(`/${mediaId}`, { fields: "permalink", access_token: token });
    return d.permalink;
  },

  async sendPrivateReply(igUserId: string, token: string, commentId: string, message: DmMessage): Promise<string> {
    const d = await post<{ message_id: string }>(`/${igUserId}/messages`, { access_token: token }, {
      recipient: { comment_id: commentId },
      message: messagePayload(message),
    });
    return d.message_id;
  },

  // Perfil próprio e posts recentes, pela API do login do Instagram (a mesma da publicação).
  async ownAnalysisData(igUserId: string, token: string): Promise<AnalysisSource> {
    const p = await get<{ username: string; name?: string; biography?: string; website?: string; profile_picture_url?: string; followers_count?: number; follows_count?: number; media_count?: number }>(
      `/${igUserId}`,
      { fields: "username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count", access_token: token }
    );
    const m = await get<{ data: RawMedia[] }>(`/${igUserId}/media`, { fields: MEDIA_FIELDS, limit: 50, access_token: token });
    return {
      profile: {
        username: p.username,
        name: p.name,
        biography: p.biography,
        website: p.website,
        profilePictureUrl: p.profile_picture_url,
        followers: p.followers_count ?? 0,
        following: p.follows_count,
        mediaCount: p.media_count ?? 0,
      },
      posts: (m.data ?? []).map(mapMedia),
    };
  },

  // Outro perfil profissional (business ou creator) pelo business_discovery. Só existe na API pelo Facebook:
  // precisa do token da Página ligada à conta e do id do Instagram dessa Página.
  async businessDiscovery(fbIgUserId: string, pageToken: string, username: string): Promise<AnalysisSource> {
    const d = await fbGet<{ business_discovery?: { username: string; name?: string; biography?: string; website?: string; profile_picture_url?: string; followers_count?: number; follows_count?: number; media_count?: number; media?: { data: RawMedia[] } } }>(
      `/${fbIgUserId}`,
      {
        fields: `business_discovery.username(${username}){username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count,media.limit(50){${MEDIA_FIELDS}}}`,
        access_token: pageToken,
      }
    );
    const b = d.business_discovery;
    if (!b) throw new IgApiError("Perfil não encontrado.", 110);
    return {
      profile: {
        username: b.username,
        name: b.name,
        biography: b.biography,
        website: b.website,
        profilePictureUrl: b.profile_picture_url,
        followers: b.followers_count ?? 0,
        following: b.follows_count,
        mediaCount: b.media_count ?? 0,
      },
      posts: (b.media?.data ?? []).map(mapMedia),
    };
  },

  fbAuthUrl(state: string, redirectUri: string) {
    const p = new URLSearchParams({
      client_id: config.facebookAppId,
      redirect_uri: redirectUri,
      state,
      scope: FB_ANALYSIS_SCOPES.join(","),
      response_type: "code",
    });
    return `https://www.facebook.com/${FB_VERSION}/dialog/oauth?${p}`;
  },

  // Código do login do Facebook -> token de usuário de longa duração -> Páginas e a conta do Instagram de cada uma.
  // O token de Página obtido de um token de usuário de longa duração não expira.
  async fbPages(code: string, redirectUri: string): Promise<FbPage[]> {
    const short = await fbGet<{ access_token: string }>("/oauth/access_token", {
      client_id: config.facebookAppId,
      client_secret: config.facebookAppSecret,
      redirect_uri: redirectUri,
      code,
    });
    const long = await fbGet<{ access_token: string }>("/oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: config.facebookAppId,
      client_secret: config.facebookAppSecret,
      fb_exchange_token: short.access_token,
    });
    const pages = await fbGet<{ data: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }[] }>("/me/accounts", {
      fields: "id,name,access_token,instagram_business_account{id,username}",
      limit: 100,
      access_token: long.access_token,
    });
    return (pages.data ?? []).map((p) => ({
      pageId: p.id,
      pageName: p.name,
      pageToken: p.access_token,
      igUserId: p.instagram_business_account?.id,
      igUsername: p.instagram_business_account?.username,
    }));
  },

  async sendMessage(igUserId: string, token: string, recipientId: string, message: DmMessage): Promise<string> {
    const d = await post<{ message_id: string }>(`/${igUserId}/messages`, { access_token: token }, {
      recipient: { id: recipientId },
      message: messagePayload(message),
    });
    return d.message_id;
  },
};

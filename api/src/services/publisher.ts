import { FacebookPage } from "../models/FacebookPage";
import { decrypt, Encrypted } from "../lib/crypto";
import { Types } from "mongoose";
import { config, limits } from "../config";
import { ScheduledPost, ScheduledPostDoc } from "../models/ScheduledPost";
import { InstagramAccount } from "../models/InstagramAccount";
import { Media, MediaDoc, READY_STATUSES } from "../models/Media";
import { User } from "../models/User";
import { formatInZone, HOUR, MINUTE } from "../lib/time";
import { igApi, IgApiError, ContainerParams } from "./instagramApi";
import { accessToken, markExpired } from "./accounts";
import { publishUsage } from "./limits";
import { notify } from "./notifications";
import { removeMediaFile } from "./mediaProcessing";

export const MAX_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 5 * MINUTE;
export const LATE_TOLERANCE_MS = HOUR;

export const postFinalHooks: ((post: ScheduledPostDoc) => Promise<void>)[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function publicMediaUrl(m: MediaDoc) {
  return `${config.publicBaseUrl}/public/media/${m.publicToken}`;
}

async function waitContainer(containerId: string, token: string) {
  for (let i = 0; i < limits.containerPollMax; i++) {
    const s = await igApi.containerStatus(containerId, token);
    if (s.statusCode === "FINISHED" || s.statusCode === "PUBLISHED") return;
    if (s.statusCode === "ERROR" || s.statusCode === "EXPIRED") {
      throw new IgApiError(`O Instagram recusou a mídia (${s.status ?? s.statusCode}).`);
    }
    await sleep(limits.containerPollMs);
  }
  throw new IgApiError("O Instagram demorou demais para processar a mídia.");
}

async function userZone(userId: Types.ObjectId) {
  const u = await User.findById(userId, { timezone: 1 });
  return u?.timezone ?? "America/Sao_Paulo";
}

async function failPost(post: ScheduledPostDoc, reason: string) {
  post.status = "failed";
  post.lastError = reason;
  post.nextAttemptAt = undefined;
  await post.save();
  const tz = await userZone(post.userId);
  await notify(post.userId, "publish_failed", `A publicação de ${formatInZone(post.scheduledAt, tz)} falhou: ${reason}`, post.id);
  for (const hook of postFinalHooks) await hook(post);
}

async function loadMedia(post: ScheduledPostDoc) {
  const items = await Media.find({ _id: { $in: post.mediaIds } });
  const byId = new Map(items.map((m) => [m.id as string, m]));
  return post.mediaIds.map((id) => byId.get(String(id)));
}

async function createContainers(post: ScheduledPostDoc, media: MediaDoc[], igUserId: string, token: string) {
  const caption = post.caption ?? "";
  if (post.type === "post") {
    return igApi.createContainer(igUserId, token, { image_url: publicMediaUrl(media[0]), caption });
  }
  if (post.type === "reel") {
    return igApi.createContainer(igUserId, token, { media_type: "REELS", video_url: publicMediaUrl(media[0]), caption, share_to_feed: true });
  }
  const children: string[] = [];
  for (const m of media) {
    const params: ContainerParams =
      m.kind === "image"
        ? { image_url: publicMediaUrl(m), is_carousel_item: true }
        : { media_type: "VIDEO", video_url: publicMediaUrl(m), is_carousel_item: true };
    const id = await igApi.createContainer(igUserId, token, params);
    await waitContainer(id, token);
    children.push(id);
  }
  return igApi.createContainer(igUserId, token, { media_type: "CAROUSEL", children: children.join(","), caption });
}

export async function publishPost(postId: Types.ObjectId | string, now = new Date()) {
  const post = await ScheduledPost.findOneAndUpdate({ _id: postId, status: "scheduled" }, { $set: { status: "publishing" } }, { new: true });
  if (!post) return null;
  const account = await InstagramAccount.findById(post.accountId);
  let publishingInstagram = false;
  try {
    const needsInstagram = post.destination !== "facebook" && !post.igMediaId;
    if (needsInstagram && (!account || account.disconnectedAt || account.status !== "connected")) {
      throw new IgApiError("A conta do Instagram precisa ser reconectada.");
    }
    const media = await loadMedia(post);
    if (media.some((m) => !m || m.deletedAt)) throw new IgApiError("Uma das mídias foi apagada.");
    if (needsInstagram && account) {
      publishingInstagram = true;
      const token = accessToken(account);
      const containerId = await createContainers(post, media as MediaDoc[], account.igUserId, token);
      post.igContainerId = containerId;
      await waitContainer(containerId, token);
      const mediaId = await igApi.publishContainer(account.igUserId, token, containerId);
      post.igMediaId = mediaId;
      await post.save();
      post.permalink = await igApi.permalink(mediaId, token).catch(() => undefined);
      await post.save();
      publishingInstagram = false;
    }
    if ((post.destination === "facebook" || post.destination === "both") && !post.fbPostId) {
      const page = await FacebookPage.findOne({ userId: post.userId, pageId: post.facebookPageId });
      if (!page) throw new IgApiError("Reconecte a Página do Facebook antes de publicar.");
      post.fbPostId = await igApi.publishFacebook(page.pageId, decrypt(page.tokenEnc as Encrypted), post.type, (media as MediaDoc[]).map(publicMediaUrl), post.caption ?? "");
      post.fbPermalink = `https://www.facebook.com/${post.fbPostId}`;
      await post.save();
    }
    post.status = "published";
    post.publishedAt = new Date();
    post.lastError = undefined;
    post.nextAttemptAt = undefined;
    post.attempts = (post.attempts ?? 0) + 1;
    await post.save();
    for (const m of media as MediaDoc[]) {
      await removeMediaFile(m);
      m.deletedAt = new Date();
      await m.save();
    }
    if (account && post.destination !== "facebook") {
      const usage = await publishUsage(account, new Date());
      if (usage.near) {
        await notify(
          account.userId,
          "limit_near",
          `@${account.username} usou ${usage.used} de ${usage.limit} publicações permitidas pela Meta nas últimas 24 horas.`,
          account.id,
          { dedupe: true }
        );
      }
    }
    for (const hook of postFinalHooks) await hook(post);
    return post;
  } catch (err) {
    const e = err as IgApiError;
    if (e instanceof IgApiError && e.tokenInvalid && account && publishingInstagram) await markExpired(account);
    post.attempts = (post.attempts ?? 0) + 1;
    post.lastError = e.message ?? "Erro desconhecido.";
    if (post.attempts >= MAX_ATTEMPTS) {
      await failPost(post, post.lastError);
    } else {
      post.status = "scheduled";
      post.nextAttemptAt = new Date(now.getTime() + RETRY_DELAY_MS);
      await post.save();
    }
    return post;
  }
}

let running = false;

export async function runPublisherTick(now = new Date()) {
  if (running) return;
  running = true;
  try {
    const due = await ScheduledPost.find({
      status: "scheduled",
      scheduledAt: { $lte: now },
      $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }],
    })
      .sort({ scheduledAt: 1 })
      .limit(50);
    for (const post of due) {
      const media = await loadMedia(post);
      const broken = media.find((m) => !m || m.deletedAt || m.conversionStatus === "failed");
      if (media.some((m) => !m || m.deletedAt || m.conversionStatus === "failed")) {
        await failPost(post, broken?.conversionError ?? "Uma das mídias não está disponível.");
        continue;
      }
      if (media.some((m) => !READY_STATUSES.includes(m!.conversionStatus as (typeof READY_STATUSES)[number]))) continue;
      const account = await InstagramAccount.findById(post.accountId);
      if (account && post.destination !== "facebook" && !post.igMediaId) {
        const usage = await publishUsage(account, now);
        if (usage.full) {
          post.nextAttemptAt = usage.freeAt ?? new Date(now.getTime() + RETRY_DELAY_MS);
          await post.save();
          continue;
        }
      }
      await publishPost(post._id, now);
    }
  } finally {
    running = false;
  }
}

export async function recoverOnStartup(now = new Date()) {
  const cutoff = new Date(now.getTime() - LATE_TOLERANCE_MS);
  const late = await ScheduledPost.find({
    status: "scheduled",
    $or: [
      { nextAttemptAt: { $exists: false }, scheduledAt: { $lt: cutoff } },
      { nextAttemptAt: null, scheduledAt: { $lt: cutoff } },
      { nextAttemptAt: { $lt: cutoff } },
    ],
  });
  for (const post of late) await failPost(post, "Atrasada: o horário passou há mais de 1 hora. Reagende.");
  const stuck = await ScheduledPost.find({ status: "publishing" });
  for (const post of stuck) {
    await failPost(post, "Publicação interrompida por reinício do serviço. Confira nas redes selecionadas antes de reagendar.");
  }
  await runPublisherTick(now);
}

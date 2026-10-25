import { Types } from "mongoose";
import { limits } from "../config";
import { DAY, HOUR } from "../lib/time";
import { InstagramAccount, InstagramAccountDoc } from "../models/InstagramAccount";
import { DmAutomation, DmAutomationDoc, Step } from "../models/DmAutomation";
import { DmConversation, DmConversationDoc } from "../models/DmConversation";
import { DmMessage } from "../models/DmMessage";
import { igApi, DmMessage as OutMessage, IgApiError } from "./instagramApi";
import { accessToken, markExpired } from "./accounts";
import { notify } from "./notifications";

export const TEXT_TTL_MS = 90 * DAY;
export const PRIVATE_REPLY_WINDOW_MS = 7 * DAY;
export const MESSAGING_WINDOW_MS = 24 * HOUR;
export const REPLY_PROMPT = "Responda esta mensagem para continuar.";

export function normalize(text: string) {
  return text.normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ");
}

export function keywordMatches(comment: string, keywords: string[], mode: "contains" | "exact") {
  const c = normalize(comment);
  return keywords.some((k) => {
    const kw = normalize(k);
    if (!kw) return false;
    return mode === "exact" ? c === kw : c.includes(kw);
  });
}

function steps(conv: DmConversationDoc): Step[] {
  return conv.flow!.steps as unknown as Step[];
}

function findStep(conv: DmConversationDoc, id: string) {
  return steps(conv).find((s) => s.id === id);
}

export function hasNext(step: Step) {
  return step.buttons.some((b) => b.type === "postback" && b.nextStepId);
}

export function buildMessage(conv: DmConversationDoc, step: Step, withButtons: boolean): OutMessage {
  if (!withButtons || step.buttons.length === 0) {
    const prompt = !withButtons && hasNext(step) ? `\n\n${REPLY_PROMPT}` : "";
    return { text: `${step.text}${prompt}` };
  }
  return {
    text: step.text,
    buttons: step.buttons.map((b) =>
      b.type === "url"
        ? { type: "url" as const, title: b.label, url: b.url }
        : { type: "postback" as const, title: b.label, payload: `c:${conv.id}:${b.nextStepId ?? ""}` }
    ),
  };
}

async function record(conv: DmConversationDoc, data: { direction: "in" | "out"; text?: string; stepId?: string; buttonPayload?: string; igMessageId?: string; status: "sent" | "failed" | "received" | "queued"; error?: string }) {
  return DmMessage.create({ conversationId: conv._id, userId: conv.userId, textExpiresAt: new Date(Date.now() + TEXT_TTL_MS), ...data });
}

async function failConversation(conv: DmConversationDoc, account: InstagramAccountDoc, err: unknown) {
  const e = err as IgApiError;
  if (e instanceof IgApiError && e.tokenInvalid) await markExpired(account);
  conv.status = "failed";
  await conv.save();
  await notify(
    conv.userId,
    "dm_failed",
    `Não foi possível enviar a DM para ${conv.followerUsername ? `@${conv.followerUsername}` : "um seguidor"}: ${e?.message ?? "erro desconhecido"}`,
    String(conv.automationId)
  );
}

async function afterStepSent(conv: DmConversationDoc, step: Step, buttonsSent: boolean) {
  conv.currentStepId = step.id;
  if (!buttonsSent && hasNext(step)) conv.buttonsPending = true;
  else if (!hasNext(step)) {
    conv.status = "completed";
    conv.completedAt = new Date();
  }
  await conv.save();
}

export async function privateRepliesLastHour(accountId: Types.ObjectId, now = new Date()) {
  return DmConversation.countDocuments({ accountId, privateReplySentAt: { $gt: new Date(now.getTime() - HOUR) } });
}

async function sendPrivateReply(conv: DmConversationDoc, account: InstagramAccountDoc, now: Date) {
  const step = findStep(conv, conv.flow!.startStepId)!;
  const withButtons = limits.firstStepButtons;
  const message = buildMessage(conv, step, withButtons);
  const queued = await DmMessage.findOne({ conversationId: conv._id, status: "queued" });
  try {
    const mid = await igApi.sendPrivateReply(account.igUserId, accessToken(account), conv.commentId!, message);
    if (queued) {
      queued.status = "sent";
      queued.igMessageId = mid;
      queued.text = message.text;
      await queued.save();
    } else {
      await record(conv, { direction: "out", text: message.text, stepId: step.id, igMessageId: mid, status: "sent" });
    }
    conv.privateReplySentAt = now;
    conv.queued = false;
    await afterStepSent(conv, step, withButtons);
  } catch (err) {
    if (queued) {
      queued.status = "failed";
      queued.error = (err as Error).message;
      await queued.save();
    } else {
      await record(conv, { direction: "out", text: message.text, stepId: step.id, status: "failed", error: (err as Error).message });
    }
    await failConversation(conv, account, err);
  }
}

async function checkHourlyLimit(account: InstagramAccountDoc, now: Date) {
  const used = await privateRepliesLastHour(account._id, now);
  const limit = limits.privateRepliesPerHour;
  if (used >= Math.floor(limit * limits.nearRatio)) {
    await notify(
      account.userId,
      "limit_near",
      `@${account.username} está perto do limite de ${limit} respostas privadas por hora. As próximas entram na fila.`,
      `dm:${account.id}`,
      { dedupe: true }
    );
  }
  return used < limit;
}

const LIVE_ACCOUNT = { status: "connected" as const, disconnectedAt: { $exists: false } };

// O entry.id do webhook nem sempre é o user_id do /me: se não casar, confirma na API
// qual conta conectada é a dona do id e guarda como alternativo.
export async function findAccountForWebhook(webhookId: string): Promise<InstagramAccountDoc | null> {
  const direct = await InstagramAccount.findOne({ ...LIVE_ACCOUNT, $or: [{ igUserId: webhookId }, { altIgUserIds: webhookId }] });
  if (direct) return direct;
  for (const candidate of await InstagramAccount.find(LIVE_ACCOUNT).sort({ connectedAt: -1 })) {
    try {
      if (await igApi.ownsId(webhookId, accessToken(candidate), candidate.username)) {
        candidate.altIgUserIds.push(webhookId);
        await candidate.save();
        console.log(`webhook: id ${webhookId} vinculado à conta @${candidate.username} (${candidate.igUserId})`);
        return candidate;
      }
    } catch {
      // token inválido ou id de outra conta: tenta a próxima
    }
  }
  console.warn(`webhook: id ${webhookId} não pertence a nenhuma conta conectada`);
  return null;
}

function isOwnId(account: InstagramAccountDoc, id: string) {
  return id === account.igUserId || account.altIgUserIds.includes(id);
}

export type CommentEvent = { igUserId: string; commentId: string; mediaId?: string; fromId: string; fromUsername?: string; text: string; timestamp?: Date };

export async function handleComment(ev: CommentEvent, now = new Date()) {
  if (ev.fromId === ev.igUserId) return null;
  const account = await findAccountForWebhook(ev.igUserId);
  if (!account || isOwnId(account, ev.fromId)) return null;
  if (ev.timestamp && now.getTime() - ev.timestamp.getTime() > PRIVATE_REPLY_WINDOW_MS) return null;
  const automations = await DmAutomation.find({ accountId: account._id, active: true }).sort({ createdAt: 1 });
  const automation = automations.find(
    (a) => (a.target === "any_post" || a.igMediaId === ev.mediaId) && keywordMatches(ev.text, a.keywords, a.matchMode as "contains" | "exact")
  );
  if (!automation) return null;
  if (await DmConversation.exists({ automationId: automation._id, igScopedUserId: ev.fromId })) return null;
  let conv: DmConversationDoc;
  try {
    conv = await DmConversation.create({
      userId: automation.userId,
      accountId: account._id,
      automationId: automation._id,
      igScopedUserId: ev.fromId,
      followerUsername: ev.fromUsername,
      commentId: ev.commentId,
      currentStepId: automation.startStepId,
      windowExpiresAt: new Date((ev.timestamp ?? now).getTime() + PRIVATE_REPLY_WINDOW_MS),
      flow: { startStepId: automation.startStepId, steps: automation.steps },
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return null;
    throw err;
  }
  if (!(await checkHourlyLimit(account, now))) {
    conv.queued = true;
    await conv.save();
    const step = findStep(conv, conv.flow!.startStepId)!;
    await record(conv, { direction: "out", text: step.text, stepId: step.id, status: "queued" });
    return conv;
  }
  await sendPrivateReply(conv, account, now);
  return conv;
}

async function sendStep(conv: DmConversationDoc, account: InstagramAccountDoc, step: Step) {
  const message = buildMessage(conv, step, true);
  try {
    const mid = await igApi.sendMessage(account.igUserId, accessToken(account), conv.igScopedUserId, message);
    await record(conv, { direction: "out", text: message.text, stepId: step.id, igMessageId: mid, status: "sent" });
    conv.buttonsPending = false;
    await afterStepSent(conv, step, true);
  } catch (err) {
    await record(conv, { direction: "out", text: message.text, stepId: step.id, status: "failed", error: (err as Error).message });
    await failConversation(conv, account, err);
  }
}

export type MessageEvent = { igUserId: string; senderId: string; mid: string; text?: string; postback?: { title?: string; payload?: string } };

export async function handleMessage(ev: MessageEvent, now = new Date()) {
  if (ev.senderId === ev.igUserId) return null;
  const account = await findAccountForWebhook(ev.igUserId);
  if (!account || isOwnId(account, ev.senderId)) return null;

  if (ev.postback?.payload?.startsWith("c:")) {
    const [, convId, nextStepId] = ev.postback.payload.split(":");
    if (!Types.ObjectId.isValid(convId)) return null;
    const conv = await DmConversation.findOne({ _id: convId, accountId: account._id, igScopedUserId: ev.senderId });
    if (!conv) return null;
    await record(conv, { direction: "in", text: ev.postback.title, buttonPayload: ev.postback.payload, igMessageId: ev.mid, status: "received" });
    if (conv.status !== "active") return conv;
    conv.windowExpiresAt = new Date(now.getTime() + MESSAGING_WINDOW_MS);
    const next = nextStepId ? findStep(conv, nextStepId) : undefined;
    if (!next) {
      conv.status = "completed";
      conv.completedAt = now;
      await conv.save();
      return conv;
    }
    await conv.save();
    await sendStep(conv, account, next);
    return conv;
  }

  const conv = await DmConversation.findOne({ accountId: account._id, igScopedUserId: ev.senderId, status: "active" }).sort({ startedAt: -1 });
  if (!conv) return null;
  await record(conv, { direction: "in", text: ev.text, igMessageId: ev.mid, status: "received" });
  conv.windowExpiresAt = new Date(now.getTime() + MESSAGING_WINDOW_MS);
  await conv.save();
  if (conv.buttonsPending) {
    const step = findStep(conv, conv.currentStepId);
    if (step) await sendStep(conv, account, step);
  }
  return conv;
}

export async function processQueuedReplies(now = new Date()) {
  const queued = await DmConversation.find({ queued: true, status: "active" }).sort({ startedAt: 1 }).limit(500);
  for (const conv of queued) {
    const account = await InstagramAccount.findById(conv.accountId);
    if (!account || account.status !== "connected" || account.disconnectedAt) continue;
    if (conv.windowExpiresAt <= now) continue;
    if ((await privateRepliesLastHour(account._id, now)) >= limits.privateRepliesPerHour) continue;
    await sendPrivateReply(conv, account, now);
  }
}

export async function expireConversations(now = new Date()) {
  const r = await DmConversation.updateMany({ status: "active", windowExpiresAt: { $lte: now } }, { $set: { status: "expired", queued: false } });
  await DmMessage.updateMany(
    { status: "queued", conversationId: { $in: await DmConversation.find({ status: "expired" }).distinct("_id") } },
    { $set: { status: "failed", error: "Fora da janela de resposta." } }
  );
  return r.modifiedCount;
}

export async function purgeOldDmText(now = new Date()) {
  const r = await DmMessage.updateMany({ textExpiresAt: { $lte: now }, text: { $exists: true } }, { $unset: { text: 1 } });
  return r.modifiedCount;
}

export async function deactivateAutomationsOf(account: InstagramAccountDoc) {
  await DmAutomation.updateMany({ accountId: account._id }, { $set: { active: false } });
}

export type { DmAutomationDoc };

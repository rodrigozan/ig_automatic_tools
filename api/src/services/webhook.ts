import crypto from "crypto";
import { config } from "../config";
import { WebhookEvent } from "../models/WebhookEvent";
import { handleComment, handleMessage } from "./dm";

export function verifySignature(raw: Buffer, header: string | undefined) {
  return signatureSource(raw, header) !== null;
}

export function signatureSource(raw: Buffer, header: string | undefined): "instagram" | "facebook" | null {
  if (!header) return null;
  const candidates = [
    ["instagram", config.instagramAppSecret],
    ["facebook", config.facebookAppSecret],
  ] as const;
  for (const [source, secret] of candidates) {
    if (!secret) continue;
    const expected = `sha256=${crypto.createHmac("sha256", secret).update(raw).digest("hex")}`;
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return source;
  }
  return null;
}

type Job = { key: string; run: () => Promise<unknown> };

type Payload = {
  object?: string;
  entry?: {
    id?: string;
    changes?: { field?: string; value?: Record<string, any> }[];
    messaging?: { sender?: { id?: string }; recipient?: { id?: string }; timestamp?: number; message?: { mid?: string; text?: string; is_echo?: boolean; is_deleted?: boolean }; postback?: { mid?: string; title?: string; payload?: string } }[];
  }[];
};

export function extractJobs(payload: Payload): Job[] {
  const jobs: Job[] = [];
  for (const entry of payload.entry ?? []) {
    const igUserId = String(entry.id ?? "");
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      if (change.field !== "comments" || !v.id || !v.from?.id || typeof v.text !== "string") continue;
      jobs.push({
        key: `comment:${v.id}`,
        run: () =>
          handleComment({
            igUserId,
            commentId: String(v.id),
            mediaId: v.media?.id ? String(v.media.id) : undefined,
            fromId: String(v.from.id),
            fromUsername: v.from.username,
            text: v.text,
          }),
      });
    }
    for (const m of entry.messaging ?? []) {
      const senderId = m.sender?.id;
      if (!senderId) continue;
      if (m.postback?.mid) {
        jobs.push({ key: `postback:${m.postback.mid}`, run: () => handleMessage({ igUserId, senderId, mid: m.postback!.mid!, postback: m.postback }) });
      } else if (m.message?.mid && !m.message.is_echo && !m.message.is_deleted) {
        jobs.push({ key: `message:${m.message.mid}`, run: () => handleMessage({ igUserId, senderId, mid: m.message!.mid!, text: m.message!.text }) });
      }
    }
  }
  return jobs;
}

const inflight = new Set<Promise<void>>();

export function webhookIdle() {
  return Promise.all([...inflight]);
}

export async function acceptWebhook(payload: Payload) {
  const accepted: Job[] = [];
  for (const job of extractJobs(payload)) {
    try {
      await WebhookEvent.create({ eventKey: job.key, status: "received" });
      accepted.push(job);
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }
  const p = (async () => {
    for (const job of accepted) {
      try {
        await job.run();
        await WebhookEvent.updateOne({ eventKey: job.key }, { $set: { status: "processed" } });
      } catch (err) {
        console.error("falha ao processar webhook", job.key, (err as Error).message);
        await WebhookEvent.updateOne({ eventKey: job.key }, { $set: { status: "failed", error: (err as Error).message } }).catch(() => {});
      }
    }
  })();
  inflight.add(p);
  p.finally(() => inflight.delete(p));
  return accepted.length;
}

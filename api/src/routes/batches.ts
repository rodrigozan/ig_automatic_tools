import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { requireAuth, currentUser } from "../middleware/auth";
import { HttpError, badRequest, notFound, parse } from "../lib/errors";
import { objectId, timeString } from "../lib/validation";
import { Batch, BatchDoc } from "../models/Batch";
import { Media } from "../models/Media";
import { ScheduledPost, publicPost, PENDING_STATUSES } from "../models/ScheduledPost";
import { UserDoc } from "../models/User";
import { findUserAccount } from "../services/accounts";
import { CAPTION_MAX, MIN_LEAD_MS } from "../services/posts";
import { assignSlots, todayIn } from "../services/batchSchedule";
import { publishUsage } from "../services/limits";

export const batchesRouter = Router();

const inputSchema = z
  .object({
    accountId: objectId,
    name: z.string().trim().max(100).optional(),
    mode: z.enum(["daily", "selected_days"]),
    days: z.array(z.number().int().min(0).max(6)).default([]),
    times: z.array(timeString).min(1, "Escolha ao menos um horário."),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    items: z
      .array(
        z.object({
          mediaId: objectId,
          caption: z.string().default(""),
          scheduledAt: z.coerce.date().optional().nullable(),
        })
      )
      .min(1, "Envie ao menos um vídeo.")
      .max(200, "No máximo 200 vídeos por lote."),
  })
  .strict();

type Input = z.infer<typeof inputSchema>;

async function plan(user: UserDoc, input: Input, now = new Date()) {
  const fields: Record<string, string> = {};
  const account = await findUserAccount(user._id, input.accountId);
  if (!account) fields.accountId = "Escolha uma conta conectada.";
  else if (account.status !== "connected") fields.accountId = `Reconecte @${account.username} antes de agendar.`;
  if (input.mode === "selected_days" && input.days.length === 0) fields.days = "Escolha ao menos um dia.";
  if (input.startDate < todayIn(user.timezone, now)) fields.startDate = "A data inicial precisa ser hoje ou depois.";
  const ids = input.items.map((i) => i.mediaId);
  if (new Set(ids).size !== ids.length) fields.items = "Vídeo repetido no lote.";
  else {
    const media = await Media.find({ _id: { $in: ids }, userId: user._id, deletedAt: { $exists: false } });
    if (media.length !== ids.length) fields.items = "Vídeo não encontrado.";
    else if (media.some((m) => m.kind !== "video")) fields.items = "O lote aceita só vídeos (reels).";
    else if (media.some((m) => m.conversionStatus === "failed")) fields.items = "Um dos vídeos não pôde ser convertido. Tire-o do lote.";
  }
  input.items.forEach((item, i) => {
    if (item.caption.length > CAPTION_MAX) fields[`items.${i}.caption`] = `A legenda passa de ${CAPTION_MAX} caracteres.`;
    if (item.scheduledAt && item.scheduledAt.getTime() < now.getTime() + MIN_LEAD_MS) {
      fields[`items.${i}.scheduledAt`] = "Escolha um horário com pelo menos 5 minutos de antecedência.";
    }
  });
  if (Object.keys(fields).length) throw badRequest("Confira os campos destacados.", fields);
  const items = assignSlots(
    input.items.map((i) => ({ mediaId: i.mediaId, caption: i.caption, scheduledAt: i.scheduledAt ?? undefined })),
    { mode: input.mode, days: input.days, times: input.times, startDate: input.startDate, timezone: user.timezone, now, minLeadMs: MIN_LEAD_MS }
  );
  if (items.some((i) => !i.scheduledAt)) throw badRequest("Não foi possível calcular os horários.");
  const usage = await publishUsage(account!, now);
  return { account: account!, items, usage };
}

function summary(items: { scheduledAt: Date }[]) {
  const sorted = items.map((i) => i.scheduledAt.getTime()).sort((a, b) => a - b);
  return { total: items.length, first: new Date(sorted[0]), last: new Date(sorted[sorted.length - 1]) };
}

batchesRouter.post("/batches/preview", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const input = parse(inputSchema, req.body);
  const { items, usage } = await plan(user, input);
  res.json({ items, summary: summary(items), usage: { used: usage.used, limit: usage.limit, near: usage.near, full: usage.full } });
});

async function batchView(b: BatchDoc) {
  const posts = await ScheduledPost.find({ batchId: b._id }).sort({ scheduledAt: 1 });
  const counts: Record<string, number> = {};
  for (const p of posts) counts[p.status] = (counts[p.status] ?? 0) + 1;
  return {
    id: b.id as string,
    accountId: String(b.accountId),
    name: b.name,
    mode: b.mode,
    days: b.days,
    times: b.times,
    startDate: b.startDate,
    status: b.status,
    totalItems: b.totalItems,
    counts,
    first: posts[0]?.scheduledAt,
    last: posts[posts.length - 1]?.scheduledAt,
    createdAt: b.createdAt,
    posts: posts.map(publicPost),
  };
}

batchesRouter.post("/batches", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const input = parse(inputSchema, req.body);
  const { account, items } = await plan(user, input);
  const batch = await Batch.create({
    userId: user._id,
    accountId: account._id,
    name: input.name,
    mode: input.mode,
    days: input.mode === "daily" ? [] : [...new Set(input.days)].sort(),
    times: [...new Set(input.times)].sort(),
    startDate: new Date(`${input.startDate}T00:00:00Z`),
    status: "scheduled",
    totalItems: items.length,
  });
  await ScheduledPost.insertMany(
    items.map((i) => ({
      userId: user._id,
      accountId: account._id,
      batchId: batch._id,
      type: "reel",
      mediaIds: [new Types.ObjectId(i.mediaId)],
      caption: i.caption,
      scheduledAt: i.scheduledAt,
      status: "scheduled",
    }))
  );
  res.status(201).json({ ...(await batchView(batch)), summary: summary(items) });
});

batchesRouter.get("/batches", requireAuth, async (req, res) => {
  const batches = await Batch.find({ userId: currentUser(req)._id }).sort({ createdAt: -1 }).limit(200);
  const views = await Promise.all(batches.map(batchView));
  res.json(views.map(({ posts: _p, ...v }) => v));
});

batchesRouter.get("/batches/:id", requireAuth, async (req, res) => {
  const b = await Batch.findOne({ _id: req.params.id, userId: currentUser(req)._id });
  if (!b) throw notFound("Lote não encontrado.");
  res.json(await batchView(b));
});

batchesRouter.delete("/batches/:id", requireAuth, async (req, res) => {
  const b = await Batch.findOne({ _id: req.params.id, userId: currentUser(req)._id });
  if (!b) throw notFound("Lote não encontrado.");
  if (b.status === "completed") throw new HttpError(409, "conflict", "Lote já concluído.");
  const r = await ScheduledPost.updateMany({ batchId: b._id, status: { $in: PENDING_STATUSES } }, { $set: { status: "cancelled" } });
  b.status = "cancelled";
  await b.save();
  res.json({ cancelled: r.modifiedCount });
});

export async function completeBatchIfDone(batchId: Types.ObjectId) {
  const open = await ScheduledPost.exists({ batchId, status: { $in: ["draft", "scheduled", "publishing"] } });
  if (!open) await Batch.updateOne({ _id: batchId, status: "scheduled" }, { $set: { status: "completed" } });
}

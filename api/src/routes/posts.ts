import { Router } from "express";
import { z } from "zod";
import { requireAuth, currentUser } from "../middleware/auth";
import { requireAuthOrAgent } from "../middleware/agentAuth";
import { HttpError, notFound, parse } from "../lib/errors";
import { objectId } from "../lib/validation";
import { ScheduledPost, publicPost, EDITABLE_STATUSES } from "../models/ScheduledPost";
import { validatePost } from "../services/posts";
import { completeBatchIfDone } from "./batches";
import { runPublisherTick } from "../services/publisher";

export const postsRouter = Router();

const statuses = ["draft", "scheduled", "publishing", "published", "failed", "cancelled"] as const;

const createSchema = z
  .object({
    accountId: objectId,
    type: z.enum(["post", "reel", "carousel"]),
    mediaIds: z.array(objectId),
    caption: z.string().default(""),
    scheduledAt: z.coerce.date().optional(),
    status: z.enum(["draft", "scheduled"]).default("scheduled"),
    publishNow: z.boolean().default(false),
  })
  .strict()
  .refine((b) => b.publishNow || b.scheduledAt, { message: "Informe scheduledAt ou publishNow.", path: ["scheduledAt"] })
  .refine((b) => !(b.publishNow && b.status === "draft"), { message: "Rascunho não pode ser publicado na hora.", path: ["publishNow"] });

// Publicar agora = agendar para este instante, sem a antecedência mínima; o publisher pega já.
function kickPublisher() {
  runPublisherTick().catch((err) => console.error("falha ao publicar agora", err instanceof Error ? err.stack : err));
}

const patchSchema = z
  .object({
    accountId: objectId.optional(),
    type: z.enum(["post", "reel", "carousel"]).optional(),
    mediaIds: z.array(objectId).optional(),
    caption: z.string().optional(),
    scheduledAt: z.coerce.date().optional(),
    status: z.enum(["draft", "scheduled"]).optional(),
    publishNow: z.boolean().optional(),
  })
  .strict();

postsRouter.get("/posts", requireAuthOrAgent, async (req, res) => {
  const user = currentUser(req);
  const filter: Record<string, unknown> = { userId: user._id };
  const status = typeof req.query.status === "string" ? req.query.status.split(",").filter((s) => (statuses as readonly string[]).includes(s)) : [];
  if (status.length) filter.status = { $in: status };
  if (typeof req.query.accountId === "string" && req.query.accountId) filter.accountId = req.query.accountId;
  if (typeof req.query.batchId === "string" && req.query.batchId) filter.batchId = req.query.batchId;
  const range: Record<string, Date> = {};
  if (typeof req.query.from === "string" && !Number.isNaN(Date.parse(req.query.from))) range.$gte = new Date(req.query.from);
  if (typeof req.query.to === "string" && !Number.isNaN(Date.parse(req.query.to))) range.$lt = new Date(req.query.to);
  if (Object.keys(range).length) filter.scheduledAt = range;
  const order = req.query.order === "desc" ? -1 : 1;
  const limit = Math.min(Number(req.query.limit) || 500, 1000);
  const posts = await ScheduledPost.find(filter).sort({ scheduledAt: order }).limit(limit);
  res.json(posts.map(publicPost));
});

postsRouter.post("/posts", requireAuthOrAgent, async (req, res) => {
  const user = currentUser(req);
  const { publishNow, ...body } = parse(createSchema, req.body);
  const scheduledAt = publishNow ? new Date() : body.scheduledAt!;
  await validatePost(user._id, { ...body, scheduledAt, checkTime: body.status === "scheduled" && !publishNow });
  const post = await ScheduledPost.create({ ...body, scheduledAt, userId: user._id });
  if (publishNow) kickPublisher();
  res.status(201).json(publicPost(post));
});

postsRouter.get("/posts/:id", requireAuthOrAgent, async (req, res) => {
  const post = await ScheduledPost.findOne({ _id: req.params.id, userId: currentUser(req)._id });
  if (!post) throw notFound("Publicação não encontrada.");
  res.json(publicPost(post));
});

postsRouter.patch("/posts/:id", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const { publishNow, ...parsed } = parse(patchSchema, req.body);
  const body = publishNow ? { ...parsed, scheduledAt: new Date(), status: "scheduled" as const } : parsed;
  const post = await ScheduledPost.findOne({ _id: req.params.id, userId: user._id });
  if (!post) throw notFound("Publicação não encontrada.");
  if (!(EDITABLE_STATUSES as readonly string[]).includes(post.status)) {
    throw new HttpError(409, "conflict", post.status === "published" ? "Já publicada, não dá para editar." : "Já em publicação, não dá para editar.");
  }
  const next = {
    accountId: body.accountId ?? String(post.accountId),
    type: body.type ?? post.type,
    mediaIds: body.mediaIds ?? post.mediaIds.map(String),
    caption: body.caption ?? post.caption ?? "",
    scheduledAt: body.scheduledAt ?? post.scheduledAt,
  };
  const wasFailed = post.status === "failed";
  const timeChanged = body.scheduledAt !== undefined && body.scheduledAt.getTime() !== post.scheduledAt.getTime();
  let status: "draft" | "scheduled" | "failed" = body.status ?? (post.status as "draft" | "scheduled" | "failed");
  if (wasFailed && timeChanged && !body.status) status = "scheduled";
  const checkTime = !publishNow && status === "scheduled" && (timeChanged || post.status !== "scheduled");
  await validatePost(user._id, { ...next, checkTime });
  post.set({ ...next });
  if (status === "scheduled" && post.status !== "scheduled") {
    post.attempts = 0;
    post.set("nextAttemptAt", undefined);
    post.set("lastError", undefined);
  }
  if (timeChanged && status === "scheduled") post.set("nextAttemptAt", undefined);
  post.status = status;
  await post.save();
  if (publishNow) kickPublisher();
  res.json(publicPost(post));
});

postsRouter.delete("/posts/:id", requireAuth, async (req, res) => {
  const post = await ScheduledPost.findOne({ _id: req.params.id, userId: currentUser(req)._id });
  if (!post) throw notFound("Publicação não encontrada.");
  if (post.status === "cancelled") {
    res.sendStatus(204);
    return;
  }
  if (!(EDITABLE_STATUSES as readonly string[]).includes(post.status)) {
    throw new HttpError(409, "conflict", post.status === "published" ? "Já publicada, não dá para cancelar." : "Já em publicação, não dá para cancelar.");
  }
  post.status = "cancelled";
  post.set("nextAttemptAt", undefined);
  await post.save();
  if (post.batchId) await completeBatchIfDone(post.batchId);
  res.sendStatus(204);
});

import { Router } from "express";
import { z } from "zod";
import { requireAuth, currentUser } from "../middleware/auth";
import { HttpError, notFound, parse } from "../lib/errors";
import { objectId } from "../lib/validation";
import { ScheduledPost, publicPost, EDITABLE_STATUSES } from "../models/ScheduledPost";
import { validatePost } from "../services/posts";

export const postsRouter = Router();

const statuses = ["draft", "scheduled", "publishing", "published", "failed", "cancelled"] as const;

const createSchema = z
  .object({
    accountId: objectId,
    type: z.enum(["post", "reel", "carousel"]),
    mediaIds: z.array(objectId),
    caption: z.string().default(""),
    scheduledAt: z.coerce.date(),
    status: z.enum(["draft", "scheduled"]).default("scheduled"),
  })
  .strict();

const patchSchema = z
  .object({
    accountId: objectId.optional(),
    type: z.enum(["post", "reel", "carousel"]).optional(),
    mediaIds: z.array(objectId).optional(),
    caption: z.string().optional(),
    scheduledAt: z.coerce.date().optional(),
    status: z.enum(["draft", "scheduled"]).optional(),
  })
  .strict();

postsRouter.get("/posts", requireAuth, async (req, res) => {
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

postsRouter.post("/posts", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const body = parse(createSchema, req.body);
  await validatePost(user._id, { ...body, checkTime: body.status === "scheduled" });
  const post = await ScheduledPost.create({ ...body, userId: user._id });
  res.status(201).json(publicPost(post));
});

postsRouter.get("/posts/:id", requireAuth, async (req, res) => {
  const post = await ScheduledPost.findOne({ _id: req.params.id, userId: currentUser(req)._id });
  if (!post) throw notFound("Publicação não encontrada.");
  res.json(publicPost(post));
});

postsRouter.patch("/posts/:id", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const body = parse(patchSchema, req.body);
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
  const checkTime = status === "scheduled" && (timeChanged || post.status !== "scheduled");
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
  res.sendStatus(204);
});

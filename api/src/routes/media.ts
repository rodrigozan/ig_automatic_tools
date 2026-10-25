import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { config, limits } from "../config";
import { requireAuth, currentUser } from "../middleware/auth";
import { requireAuthOrAgent } from "../middleware/agentAuth";
import { HttpError, badRequest, notFound } from "../lib/errors";
import { randomToken } from "../lib/crypto";
import { Media, publicMedia } from "../models/Media";
import { ScheduledPost } from "../models/ScheduledPost";
import { enqueueMedia } from "../services/mediaProcessing";

export const mediaRouter = Router();

const allowedExt = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(config.mediaDir, "uploads", String(req.user!._id));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${randomToken(9)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: limits.maxUploadMb * 1024 * 1024, files: 50 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const okType = file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
    if (!okType || !allowedExt.has(ext)) {
      cb(new HttpError(400, "invalid", `Formato não aceito: ${file.originalname}. Envie imagens ou vídeos.`));
      return;
    }
    cb(null, true);
  },
});

mediaRouter.post("/media", requireAuthOrAgent, upload.array("files", 50), async (req, res) => {
  const user = currentUser(req);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw badRequest("Envie ao menos um arquivo.", { files: "Envie ao menos um arquivo." });
  const created = [];
  for (const f of files) {
    const m = await Media.create({
      userId: user._id,
      kind: f.mimetype.startsWith("video/") ? "video" : "image",
      originalName: Buffer.from(f.originalname, "latin1").toString("utf8"),
      storagePath: f.path,
      publicToken: randomToken(24),
      mimeType: f.mimetype,
      sizeBytes: f.size,
      conversionStatus: "pending",
    });
    enqueueMedia(m.id);
    created.push(publicMedia(m));
  }
  res.status(201).json(created);
});

mediaRouter.get("/media", requireAuthOrAgent, async (req, res) => {
  const user = currentUser(req);
  const status = String(req.query.status ?? "");
  const filter: Record<string, unknown> = { userId: user._id, deletedAt: { $exists: false } };
  if (status === "ready") filter.conversionStatus = { $in: ["done", "not_needed"] };
  if (status === "processing") filter.conversionStatus = { $in: ["pending", "converting"] };
  if (status === "failed") filter.conversionStatus = "failed";
  if (req.query.kind === "video" || req.query.kind === "image") filter.kind = req.query.kind;
  if (typeof req.query.ids === "string") filter._id = { $in: req.query.ids.split(",").filter(Boolean) };
  const items = await Media.find(filter).sort({ createdAt: -1 }).limit(500);
  const used = await ScheduledPost.find(
    { mediaIds: { $in: items.map((m) => m._id) }, status: { $in: ["draft", "scheduled", "publishing", "failed"] } },
    { mediaIds: 1 }
  );
  const usedSet = new Set(used.flatMap((p) => p.mediaIds.map(String)));
  res.json(items.map((m) => ({ ...publicMedia(m), inUse: usedSet.has(m.id) })));
});

mediaRouter.delete("/media/:id", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const m = await Media.findOne({ _id: req.params.id, userId: user._id });
  if (!m) throw notFound("Mídia não encontrada.");
  const pending = await ScheduledPost.exists({ mediaIds: m._id, status: { $in: ["draft", "scheduled", "publishing"] } });
  if (pending) throw new HttpError(409, "conflict", "Esta mídia está em uma publicação agendada. Cancele a publicação antes.");
  await fs.promises.rm(m.storagePath, { force: true });
  const history = await ScheduledPost.exists({ mediaIds: m._id });
  if (history) {
    m.deletedAt = new Date();
    await m.save();
  } else {
    await m.deleteOne();
  }
  res.sendStatus(204);
});

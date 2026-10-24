import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { requireAuth, currentUser } from "../middleware/auth";
import { badRequest, notFound, parse } from "../lib/errors";
import { objectId } from "../lib/validation";
import { DmAutomation, publicAutomation } from "../models/DmAutomation";
import { DmConversation } from "../models/DmConversation";
import { DmMessage } from "../models/DmMessage";
import { findUserAccount } from "../services/accounts";
import { normalize } from "../services/dm";

export const automationsRouter = Router();

const buttonSchema = z.object({
  label: z.string().trim().min(1, "Escreva o texto do botão.").max(20, "Botão com até 20 caracteres."),
  type: z.enum(["postback", "url"]),
  url: z.string().trim().optional(),
  nextStepId: z.string().optional().nullable(),
});

const stepSchema = z.object({
  id: z.string().trim().min(1).max(40),
  text: z.string().trim().min(1, "Escreva a mensagem.").max(640, "Mensagem com até 640 caracteres."),
  buttons: z.array(buttonSchema).max(3, "No máximo 3 botões por mensagem.").default([]),
});

const baseSchema = z.object({
  accountId: objectId,
  name: z.string().trim().min(1, "Dê um nome à automação.").max(100),
  target: z.enum(["specific_post", "any_post"]),
  igMediaId: z.string().trim().optional().nullable(),
  keywords: z.array(z.string()).max(20, "No máximo 20 palavras-chave."),
  matchMode: z.enum(["contains", "exact"]).default("contains"),
  startStepId: z.string(),
  steps: z.array(stepSchema).min(1, "Escreva a primeira mensagem.").max(20, "No máximo 20 passos."),
  active: z.boolean().default(true),
});

type Body = z.infer<typeof baseSchema>;

async function validateAutomation(userId: Types.ObjectId, body: Body) {
  const fields: Record<string, string> = {};
  const account = await findUserAccount(userId, body.accountId);
  if (!account) fields.accountId = "Escolha uma conta conectada.";
  else if (account.status !== "connected") fields.accountId = `Reconecte @${account.username}.`;
  if (body.target === "specific_post" && !body.igMediaId) fields.igMediaId = "Escolha o post.";
  const keywords = [...new Set(body.keywords.map(normalize).filter(Boolean))];
  if (keywords.length === 0) fields.keywords = "Informe ao menos uma palavra-chave.";
  if (keywords.some((k) => k.length > 50)) fields.keywords = "Palavra-chave com até 50 caracteres.";
  const ids = body.steps.map((s) => s.id);
  if (new Set(ids).size !== ids.length) fields.steps = "Passos repetidos.";
  if (!ids.includes(body.startStepId)) fields.startStepId = "O primeiro passo não existe.";
  body.steps.forEach((s, i) => {
    s.buttons.forEach((b, j) => {
      const key = `steps.${i}.buttons.${j}`;
      if (b.type === "url") {
        try {
          const u = new URL(b.url ?? "");
          if (u.protocol !== "https:") fields[key] = "Use um link https.";
        } catch {
          fields[key] = "Link inválido.";
        }
      } else if (b.nextStepId && (!ids.includes(b.nextStepId) || b.nextStepId === s.id)) {
        fields[key] = "Destino do botão inválido.";
      }
    });
  });
  if (Object.keys(fields).length) throw badRequest("Confira os campos destacados.", fields);
  return {
    ...body,
    igMediaId: body.target === "specific_post" ? body.igMediaId ?? undefined : undefined,
    keywords,
    steps: body.steps.map((s) => ({
      id: s.id,
      text: s.text,
      buttons: s.buttons.map((b) => (b.type === "url" ? { label: b.label, type: b.type, url: b.url } : { label: b.label, type: b.type, nextStepId: b.nextStepId ?? undefined })),
    })),
  };
}

async function stats(ids: Types.ObjectId[]) {
  const rows = await DmConversation.aggregate<{ _id: { a: Types.ObjectId; s: string }; n: number }>([
    { $match: { automationId: { $in: ids } } },
    { $group: { _id: { a: "$automationId", s: "$status" }, n: { $sum: 1 } } },
  ]);
  const map = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const k = String(r._id.a);
    const cur = map.get(k) ?? {};
    cur[r._id.s] = r.n;
    cur.total = (cur.total ?? 0) + r.n;
    map.set(k, cur);
  }
  return map;
}

automationsRouter.get("/automations", requireAuth, async (req, res) => {
  const items = await DmAutomation.find({ userId: currentUser(req)._id }).sort({ createdAt: -1 });
  const s = await stats(items.map((a) => a._id));
  res.json(items.map((a) => ({ ...publicAutomation(a), stats: s.get(a.id) ?? { total: 0 } })));
});

automationsRouter.post("/automations", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const body = await validateAutomation(user._id, parse(baseSchema.strict(), req.body));
  const a = await DmAutomation.create({ ...body, userId: user._id });
  res.status(201).json(publicAutomation(a));
});

automationsRouter.get("/automations/:id", requireAuth, async (req, res) => {
  const a = await DmAutomation.findOne({ _id: req.params.id, userId: currentUser(req)._id });
  if (!a) throw notFound("Automação não encontrada.");
  const s = await stats([a._id]);
  res.json({ ...publicAutomation(a), stats: s.get(a.id) ?? { total: 0 } });
});

automationsRouter.patch("/automations/:id", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const a = await DmAutomation.findOne({ _id: req.params.id, userId: user._id });
  if (!a) throw notFound("Automação não encontrada.");
  const patch = parse(baseSchema.partial().strict(), req.body);
  const current = publicAutomation(a);
  const merged = { ...current, ...patch, igMediaId: patch.igMediaId ?? current.igMediaId } as Body;
  const body = await validateAutomation(user._id, merged);
  a.set(body);
  if (body.target === "any_post") a.set("igMediaId", undefined);
  await a.save();
  res.json(publicAutomation(a));
});

automationsRouter.patch("/automations/:id/active", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const { active } = parse(z.object({ active: z.boolean() }).strict(), req.body);
  const a = await DmAutomation.findOne({ _id: req.params.id, userId: user._id });
  if (!a) throw notFound("Automação não encontrada.");
  if (active) {
    const account = await findUserAccount(user._id, a.accountId);
    if (!account || account.status !== "connected") throw badRequest("Reconecte a conta antes de ativar.", { active: "Reconecte a conta antes de ativar." });
  }
  a.active = active;
  await a.save();
  res.json(publicAutomation(a));
});

automationsRouter.delete("/automations/:id", requireAuth, async (req, res) => {
  const a = await DmAutomation.findOne({ _id: req.params.id, userId: currentUser(req)._id });
  if (!a) throw notFound("Automação não encontrada.");
  const convIds = await DmConversation.find({ automationId: a._id }).distinct("_id");
  await DmMessage.deleteMany({ conversationId: { $in: convIds } });
  await DmConversation.deleteMany({ automationId: a._id });
  await a.deleteOne();
  res.sendStatus(204);
});

automationsRouter.get("/automations/:id/conversations", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const a = await DmAutomation.findOne({ _id: req.params.id, userId: user._id });
  if (!a) throw notFound("Automação não encontrada.");
  const filter: Record<string, unknown> = { automationId: a._id, userId: user._id };
  if (typeof req.query.status === "string" && ["active", "completed", "expired", "failed"].includes(req.query.status)) filter.status = req.query.status;
  const convs = await DmConversation.find(filter).sort({ startedAt: -1 }).limit(500);
  const counts = await DmMessage.aggregate<{ _id: { c: Types.ObjectId; d: string }; n: number }>([
    { $match: { conversationId: { $in: convs.map((c) => c._id) } } },
    { $group: { _id: { c: "$conversationId", d: "$direction" }, n: { $sum: 1 } } },
  ]);
  const by = new Map<string, { in: number; out: number }>();
  for (const r of counts) {
    const k = String(r._id.c);
    const cur = by.get(k) ?? { in: 0, out: 0 };
    cur[r._id.d as "in" | "out"] = r.n;
    by.set(k, cur);
  }
  res.json(
    convs.map((c) => ({
      id: c.id as string,
      followerUsername: c.followerUsername,
      igScopedUserId: c.igScopedUserId,
      currentStepId: c.currentStepId,
      status: c.status,
      queued: c.queued,
      buttonsPending: c.buttonsPending,
      windowExpiresAt: c.windowExpiresAt,
      startedAt: c.startedAt,
      completedAt: c.completedAt,
      replied: (by.get(c.id)?.in ?? 0) > 0,
      messages: by.get(c.id) ?? { in: 0, out: 0 },
    }))
  );
});

automationsRouter.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const c = await DmConversation.findOne({ _id: req.params.id, userId: user._id });
  if (!c) throw notFound("Conversa não encontrada.");
  const msgs = await DmMessage.find({ conversationId: c._id, userId: user._id }).sort({ createdAt: 1 });
  res.json(
    msgs.map((m) => ({
      id: m.id as string,
      direction: m.direction,
      text: m.text ?? null,
      textExpired: !m.text && m.textExpiresAt <= new Date(),
      stepId: m.stepId,
      status: m.status,
      error: m.error,
      createdAt: m.createdAt,
    }))
  );
});

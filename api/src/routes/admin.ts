import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin, currentUser } from "../middleware/auth";
import { HttpError, notFound, parse } from "../lib/errors";
import { email } from "../lib/validation";
import { User, publicUser } from "../models/User";
import { Invite } from "../models/Invite";
import { countsByUser } from "../services/adminStats";

export const adminRouter = Router();

adminRouter.use("/admin", requireAuth, requireAdmin);

adminRouter.get("/admin/users", async (_req, res) => {
  const users = await User.find().sort({ createdAt: 1 });
  const counts = await countsByUser(users.map((u) => u._id));
  res.json(users.map((u) => ({ ...publicUser(u), counts: counts.get(u.id) ?? {} })));
});

adminRouter.patch("/admin/users/:id", async (req, res) => {
  const body = parse(z.object({ active: z.boolean() }).strict(), req.body);
  const user = await User.findById(req.params.id);
  if (!user) throw notFound("Usuário não encontrado.");
  if (user.id === currentUser(req).id && !body.active) {
    throw new HttpError(400, "invalid", "Você não pode desativar a própria conta.");
  }
  user.active = body.active;
  await user.save();
  res.json(publicUser(user));
});

adminRouter.get("/admin/invites", async (_req, res) => {
  const invites = await Invite.find().sort({ createdAt: -1 });
  res.json(invites.map((i) => ({ id: i.id, email: i.email, usedAt: i.usedAt, createdAt: i.createdAt })));
});

adminRouter.post("/admin/invites", async (req, res) => {
  const body = parse(z.object({ email }).strict(), req.body);
  if (await Invite.exists({ email: body.email })) {
    throw new HttpError(409, "conflict", "Este e-mail já tem convite.", { email: "Este e-mail já tem convite." });
  }
  const invite = await Invite.create({ email: body.email, invitedBy: currentUser(req)._id });
  res.status(201).json({ id: invite.id, email: invite.email, usedAt: invite.usedAt, createdAt: invite.createdAt });
});

adminRouter.delete("/admin/invites/:id", async (req, res) => {
  const r = await Invite.deleteOne({ _id: req.params.id });
  if (r.deletedCount === 0) throw notFound("Convite não encontrado.");
  res.sendStatus(204);
});

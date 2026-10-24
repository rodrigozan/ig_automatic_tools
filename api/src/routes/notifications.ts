import { Router } from "express";
import { requireAuth, currentUser } from "../middleware/auth";
import { notFound } from "../lib/errors";
import { Notification, publicNotification } from "../models/Notification";

export const notificationsRouter = Router();

notificationsRouter.get("/notifications", requireAuth, async (req, res) => {
  const items = await Notification.find({ userId: currentUser(req)._id }).sort({ createdAt: -1 }).limit(200);
  res.json(items.map(publicNotification));
});

notificationsRouter.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  const n = await Notification.findOne({ _id: req.params.id, userId: currentUser(req)._id });
  if (!n) throw notFound("Aviso não encontrado.");
  if (!n.readAt) {
    n.readAt = new Date();
    await n.save();
  }
  res.json(publicNotification(n));
});

notificationsRouter.delete("/notifications/:id", requireAuth, async (req, res) => {
  const r = await Notification.deleteOne({ _id: req.params.id, userId: currentUser(req)._id });
  if (r.deletedCount === 0) throw notFound("Aviso não encontrado.");
  res.sendStatus(204);
});

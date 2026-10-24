import { Router } from "express";
import mongoose from "mongoose";

export const healthRouter = Router();

const startedAt = new Date();

healthRouter.get("/health", (_req, res) => {
  const db = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({ status: "ok", db, startedAt: startedAt.toISOString(), now: new Date().toISOString() });
});

import express, { Router } from "express";
import { config } from "../config";
import { acceptWebhook, verifySignature } from "../services/webhook";

export const webhooksRouter = Router();

webhooksRouter.get("/webhooks/instagram", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && config.metaWebhookVerifyToken && token === config.metaWebhookVerifyToken) {
    res.status(200).type("text/plain").send(String(challenge ?? ""));
    return;
  }
  res.sendStatus(403);
});

webhooksRouter.post("/webhooks/instagram", express.raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!verifySignature(raw, req.header("x-hub-signature-256"))) {
    res.sendStatus(401);
    return;
  }
  let payload;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    res.sendStatus(400);
    return;
  }
  try {
    await acceptWebhook(payload);
    res.sendStatus(200);
  } catch (err) {
    console.error("falha ao registrar webhook", (err as Error).message);
    res.sendStatus(500);
  }
});

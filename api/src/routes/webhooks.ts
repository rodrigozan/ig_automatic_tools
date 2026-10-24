import express, { Router } from "express";
import { config } from "../config";

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

webhooksRouter.post("/webhooks/instagram", express.raw({ type: "*/*", limit: "1mb" }), (req, res) => {
  console.log("webhook instagram", req.headers["x-hub-signature-256"], (req.body as Buffer).toString("utf8"));
  res.sendStatus(200);
});

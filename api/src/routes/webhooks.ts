import express, { Router } from "express";
import { config } from "../config";
import { acceptWebhook, signatureSource } from "../services/webhook";

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
  const source = signatureSource(raw, req.header("x-hub-signature-256"));
  const signed = source !== null;
  console.log(`webhook instagram recebido: ${raw.length} bytes, assinatura ${signed ? `ok (segredo ${source})` : "inválida"}`);
  if (!signed) {
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
  const summary = (payload.entry ?? []).map((e: { id?: string; changes?: { field?: string }[]; messaging?: unknown[] }) =>
    `${e.id}[${[...(e.changes ?? []).map((c) => c.field), ...(e.messaging?.length ? ["messaging"] : [])].join(",")}]`
  );
  console.log(`webhook instagram payload: object=${payload.object} entry=${summary.join(" ")}`);
  try {
    await acceptWebhook(payload);
    res.sendStatus(200);
  } catch (err) {
    console.error("falha ao registrar webhook", (err as Error).message);
    res.sendStatus(500);
  }
});

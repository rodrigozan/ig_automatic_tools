import fs from "fs";
import path from "path";
import express, { Router } from "express";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { healthRouter } from "./routes/health";
import { webhooksRouter } from "./routes/webhooks";
import { publicMediaRouter } from "./routes/publicMedia";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { adminRouter } from "./routes/admin";
import { instagramRouter } from "./routes/instagram";
import { mediaRouter } from "./routes/media";
import { postsRouter } from "./routes/posts";
import { notificationsRouter } from "./routes/notifications";
import { batchesRouter, completeBatchIfDone } from "./routes/batches";
import { postFinalHooks } from "./services/publisher";
import { automationsRouter } from "./routes/automations";
import { disconnectHooks } from "./services/accounts";
import { deactivateAutomationsOf, expireConversations, processQueuedReplies, purgeOldDmText } from "./services/dm";
import { minuteTasks } from "./services/scheduler";
import { cleanupTasks } from "./services/cleanup";
import { dashboardRouter } from "./routes/dashboard";
import { analysisRouter } from "./routes/analysis";
import { errorHandler } from "./lib/errors";
import { securityHeaders, loginLimiter, writeLimiter, uploadLimiter, webhookLimiter } from "./middleware/security";

postFinalHooks.push(async (post) => {
  if (post.batchId) await completeBatchIfDone(post.batchId);
});

disconnectHooks.push(deactivateAutomationsOf);
minuteTasks.push(async (now) => {
  await expireConversations(now);
  await processQueuedReplies(now);
});
cleanupTasks.push(async (now) => {
  await purgeOldDmText(now);
});

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");

  app.use(securityHeaders);

  const api = Router();
  api.use("/webhooks", webhookLimiter);
  api.use(webhooksRouter);
  api.use(express.json({ limit: "1mb" }));
  api.use(cookieParser());
  api.use(["/auth/google", "/auth/facebook", "/instagram/connect", "/instagram/callback"], loginLimiter);
  api.use("/media", uploadLimiter);
  api.use(writeLimiter);
  api.use(healthRouter);
  api.use(authRouter);
  api.use(usersRouter);
  api.use(adminRouter);
  api.use(instagramRouter);
  api.use(mediaRouter);
  api.use(postsRouter);
  api.use(batchesRouter);
  api.use(automationsRouter);
  api.use(dashboardRouter);
  api.use(analysisRouter);
  api.use(notificationsRouter);
  api.use((_req, res) => {
    res.status(404).json({ error: "not_found", message: "Rota não encontrada." });
  });
  api.use(errorHandler);

  const root = Router();
  root.use("/api", api);
  root.use(publicMediaRouter);

  if (fs.existsSync(config.webDist)) {
    root.use(express.static(config.webDist, { index: false, dotfiles: "deny" }));
    root.get(/^\/(?!(ig\/)?(api|public)(\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(config.webDist, "index.html"));
    });
  }

  app.use("/ig", root);
  app.use("/", root);

  return app;
}

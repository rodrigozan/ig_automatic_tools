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
import { errorHandler } from "./lib/errors";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");

  const api = Router();
  api.use(webhooksRouter);
  api.use(express.json({ limit: "1mb" }));
  api.use(cookieParser());
  api.use(healthRouter);
  api.use(authRouter);
  api.use(usersRouter);
  api.use(adminRouter);
  api.use((_req, res) => {
    res.status(404).json({ error: "not_found", message: "Rota não encontrada." });
  });
  api.use(errorHandler);

  const root = Router();
  root.use("/api", api);
  root.use(publicMediaRouter);

  if (fs.existsSync(config.webDist)) {
    root.use(express.static(config.webDist, { index: false, dotfiles: "deny" }));
    root.get(/^\/(?!api\/|public\/).*/, (_req, res) => {
      res.sendFile(path.join(config.webDist, "index.html"));
    });
  }

  app.use("/ig", root);
  app.use("/", root);

  return app;
}

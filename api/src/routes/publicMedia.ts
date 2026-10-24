import path from "path";
import fs from "fs";
import { Router } from "express";
import { config } from "../config";

export const publicMediaRouter = Router();

publicMediaRouter.get("/public/media/:publicToken", (req, res) => {
  const token = path.basename(req.params.publicToken);
  const file = path.join(config.mediaDir, "verificacao", token);
  if (!/^[\w.-]+$/.test(token) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.sendStatus(404);
    return;
  }
  res.sendFile(file, { dotfiles: "deny" });
});

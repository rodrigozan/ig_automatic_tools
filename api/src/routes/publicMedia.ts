import path from "path";
import fs from "fs";
import { Router } from "express";
import { config } from "../config";
import { Media } from "../models/Media";

export const publicMediaRouter = Router();

publicMediaRouter.get("/public/media/:publicToken", async (req, res) => {
  const token = path.basename(req.params.publicToken);
  if (!/^[\w.-]+$/.test(token)) {
    res.sendStatus(404);
    return;
  }
  const m = await Media.findOne({ publicToken: token, deletedAt: { $exists: false } }).catch(() => null);
  let file = m?.storagePath;
  if (!file) {
    const test = path.join(config.mediaDir, "verificacao", token);
    if (fs.existsSync(test)) file = test;
  }
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.sendStatus(404);
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  if (m) res.type(m.mimeType);
  res.sendFile(file, { dotfiles: "allow" });
});

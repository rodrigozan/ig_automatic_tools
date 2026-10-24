import fs from "fs";
import { Media } from "../models/Media";
import { ScheduledPost } from "../models/ScheduledPost";
import { Notification } from "../models/Notification";
import { DAY } from "../lib/time";

export const cleanupTasks: ((now: Date) => Promise<void>)[] = [];

export async function cleanupMedia(now = new Date()) {
  const cutoff = new Date(now.getTime() - 7 * DAY);
  const old = await Media.find({ createdAt: { $lt: cutoff }, deletedAt: { $exists: false } });
  for (const m of old) {
    const posts = await ScheduledPost.find({ mediaIds: m._id }, { status: 1, updatedAt: 1 });
    if (posts.length === 0) {
      await fs.promises.rm(m.storagePath, { force: true });
      await m.deleteOne();
      continue;
    }
    const allClosed = posts.every((p) => ["cancelled", "failed"].includes(p.status) && p.updatedAt < cutoff);
    if (allClosed) {
      await fs.promises.rm(m.storagePath, { force: true });
      m.deletedAt = now;
      await m.save();
    }
  }
}

export async function cleanupNotifications(now = new Date()) {
  await Notification.deleteMany({ readAt: { $lt: new Date(now.getTime() - 30 * DAY) } });
}

export async function runDailyCleanup(now = new Date()) {
  await cleanupMedia(now);
  await cleanupNotifications(now);
  for (const task of cleanupTasks) await task(now);
}

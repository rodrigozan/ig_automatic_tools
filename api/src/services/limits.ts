import { Types } from "mongoose";
import { limits } from "../config";
import { ScheduledPost } from "../models/ScheduledPost";
import { InstagramAccountDoc } from "../models/InstagramAccount";

const DAY = 24 * 60 * 60 * 1000;

export async function publishUsage(account: Pick<InstagramAccountDoc, "_id" | "publishLimit">, now = new Date()) {
  const since = new Date(now.getTime() - DAY);
  const published = await ScheduledPost.find(
    { accountId: account._id as Types.ObjectId, status: "published", publishedAt: { $gt: since } },
    { publishedAt: 1 }
  ).sort({ publishedAt: 1 });
  const limit = account.publishLimit ?? limits.publishPer24h;
  const used = published.length;
  const freeAt = used >= limit && published[0]?.publishedAt ? new Date(published[0].publishedAt.getTime() + DAY) : undefined;
  return { used, limit, near: used >= Math.floor(limit * limits.nearRatio), full: used >= limit, freeAt };
}

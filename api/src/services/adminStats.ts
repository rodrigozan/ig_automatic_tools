import { Types, Model } from "mongoose";
import { InstagramAccount } from "../models/InstagramAccount";
import { ScheduledPost } from "../models/ScheduledPost";
import { DmAutomation } from "../models/DmAutomation";
import { DmConversation } from "../models/DmConversation";

async function countBy(model: Model<any>, ids: Types.ObjectId[], extra: Record<string, unknown> = {}) {
  const rows = await model.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { userId: { $in: ids }, ...extra } },
    { $group: { _id: "$userId", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export async function countsByUser(ids: Types.ObjectId[]): Promise<Map<string, Record<string, number>>> {
  const [accounts, posts, published, automations, conversations] = await Promise.all([
    countBy(InstagramAccount, ids, { disconnectedAt: { $exists: false } }),
    countBy(ScheduledPost, ids),
    countBy(ScheduledPost, ids, { status: "published" }),
    countBy(DmAutomation, ids),
    countBy(DmConversation, ids),
  ]);
  const out = new Map<string, Record<string, number>>();
  for (const id of ids) {
    const k = String(id);
    out.set(k, {
      accounts: accounts.get(k) ?? 0,
      posts: posts.get(k) ?? 0,
      published: published.get(k) ?? 0,
      automations: automations.get(k) ?? 0,
      conversations: conversations.get(k) ?? 0,
    });
  }
  return out;
}

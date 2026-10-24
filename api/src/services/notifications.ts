import { Types } from "mongoose";
import { Notification } from "../models/Notification";

type NotificationType = "publish_failed" | "token_expiring" | "limit_near" | "dm_failed";

export async function notify(
  userId: Types.ObjectId | string,
  type: NotificationType,
  message: string,
  refId?: string,
  opts: { dedupe?: boolean } = {}
) {
  if (opts.dedupe && (await Notification.exists({ userId, type, refId, readAt: { $exists: false } }))) return null;
  return Notification.create({ userId, type, message, refId });
}

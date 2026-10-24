import fs from "fs";
import path from "path";
import { config } from "../config";
import { User } from "../models/User";
import { InstagramAccount } from "../models/InstagramAccount";
import { Media } from "../models/Media";
import { ScheduledPost } from "../models/ScheduledPost";
import { Batch } from "../models/Batch";
import { DmAutomation } from "../models/DmAutomation";
import { DmConversation } from "../models/DmConversation";
import { DmMessage } from "../models/DmMessage";
import { Notification } from "../models/Notification";
import { igApi } from "./instagramApi";
import { accessToken } from "./accounts";

export async function deleteUserData(userId: string) {
  const accounts = await InstagramAccount.find({ userId });
  for (const a of accounts) {
    if (!a.accessTokenEnc) continue;
    try {
      await igApi.unsubscribeWebhooks(a.igUserId, accessToken(a));
    } catch (err) {
      console.warn("falha ao cancelar a inscrição do webhook", (err as Error).message);
    }
  }
  const media = await Media.find({ userId });
  for (const m of media) await fs.promises.rm(m.storagePath, { force: true });
  await fs.promises.rm(path.join(config.mediaDir, "uploads", String(userId)), { recursive: true, force: true });
  await Promise.all([
    DmMessage.deleteMany({ userId }),
    DmConversation.deleteMany({ userId }),
    DmAutomation.deleteMany({ userId }),
    ScheduledPost.deleteMany({ userId }),
    Batch.deleteMany({ userId }),
    Media.deleteMany({ userId }),
    Notification.deleteMany({ userId }),
    InstagramAccount.deleteMany({ userId }),
  ]);
  await User.deleteOne({ _id: userId });
}

import { Types } from "mongoose";
import { InstagramAccount, InstagramAccountDoc } from "../models/InstagramAccount";
import { ScheduledPost, PENDING_STATUSES } from "../models/ScheduledPost";
import { decrypt } from "../lib/crypto";
import { igApi, IgApiError } from "./instagramApi";
import { notify } from "./notifications";

export function accessToken(account: InstagramAccountDoc): string {
  if (!account.accessTokenEnc) throw new IgApiError("Conta sem token. Reconecte a conta.", 190);
  return decrypt(account.accessTokenEnc as { data: string; iv: string; tag: string });
}

export async function markExpired(account: InstagramAccountDoc) {
  if (account.status === "expired") return;
  account.status = "expired";
  await account.save();
  await notify(account.userId, "token_expiring", `Reconecte @${account.username}: o acesso ao Instagram expirou.`, account.id, { dedupe: true });
}

export const disconnectHooks: ((account: InstagramAccountDoc) => Promise<void>)[] = [];

export async function disconnectAccount(account: InstagramAccountDoc) {
  if (account.accessTokenEnc) {
    try {
      await igApi.unsubscribeWebhooks(account.igUserId, accessToken(account));
    } catch (err) {
      console.warn("falha ao cancelar a inscrição do webhook", (err as Error).message);
    }
  }
  account.set("accessTokenEnc", undefined);
  account.status = "revoked";
  account.set("disconnectedAt", new Date());
  await account.save();
  await ScheduledPost.updateMany(
    { accountId: account._id, status: { $in: PENDING_STATUSES } },
    { $set: { status: "cancelled" } }
  );
  for (const hook of disconnectHooks) await hook(account);
}

type Id = Types.ObjectId | string;

export function activeAccountsFilter(userId: Id) {
  return { userId, disconnectedAt: { $exists: false } };
}

export async function findUserAccount(userId: Id, accountId: Id) {
  return InstagramAccount.findOne({ _id: accountId, ...activeAccountsFilter(userId) });
}

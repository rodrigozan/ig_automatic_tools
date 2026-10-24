import { InstagramAccount } from "../models/InstagramAccount";
import { encrypt } from "../lib/crypto";
import { DAY } from "../lib/time";
import { igApi } from "./instagramApi";
import { accessToken, markExpired } from "./accounts";
import { notify } from "./notifications";

export const REFRESH_BEFORE_MS = 10 * DAY;
export const WARN_BEFORE_MS = 3 * DAY;

export async function refreshTokens(now = new Date()) {
  const accounts = await InstagramAccount.find({
    status: "connected",
    disconnectedAt: { $exists: false },
    tokenExpiresAt: { $lt: new Date(now.getTime() + REFRESH_BEFORE_MS) },
  });
  for (const account of accounts) {
    if (account.tokenExpiresAt <= now) {
      await markExpired(account);
      continue;
    }
    try {
      const r = await igApi.refreshToken(accessToken(account));
      account.set("accessTokenEnc", encrypt(r.accessToken));
      account.tokenExpiresAt = new Date(now.getTime() + r.expiresIn * 1000);
      await account.save();
    } catch (err) {
      console.warn("falha ao renovar token", account.username, (err as Error).message);
      if (account.tokenExpiresAt.getTime() - now.getTime() < WARN_BEFORE_MS) {
        await notify(
          account.userId,
          "token_expiring",
          `O acesso a @${account.username} vence em breve e não foi renovado. Reconecte a conta.`,
          account.id,
          { dedupe: true }
        );
      }
    }
  }
}

export async function refreshPublishLimits() {
  const accounts = await InstagramAccount.find({ status: "connected", disconnectedAt: { $exists: false } });
  for (const account of accounts) {
    try {
      const r = await igApi.publishingLimit(account.igUserId, accessToken(account));
      if (r.quotaTotal && r.quotaTotal !== account.publishLimit) {
        account.publishLimit = r.quotaTotal;
        await account.save();
      }
    } catch (err) {
      console.warn("falha ao ler o limite de publicação", account.username, (err as Error).message);
    }
  }
}

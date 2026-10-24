import { Router } from "express";
import { config } from "../config";
import { requireAuth, currentUser } from "../middleware/auth";
import { cookieOptions, signTemp, verifyTemp } from "../lib/session";
import { encrypt, randomToken } from "../lib/crypto";
import { notFound } from "../lib/errors";
import { InstagramAccount, InstagramAccountDoc } from "../models/InstagramAccount";
import { igApi } from "../services/instagramApi";
import { accessToken, activeAccountsFilter, disconnectAccount, findUserAccount, markExpired } from "../services/accounts";
import { publishUsage } from "../services/limits";
import { limits } from "../config";

export const instagramRouter = Router();

const STATE_COOKIE = "ig_connect";

export async function publicAccount(a: InstagramAccountDoc) {
  const usage = await publishUsage(a);
  return {
    id: a.id as string,
    igUserId: a.igUserId,
    username: a.username,
    accountType: a.accountType,
    profilePictureUrl: a.profilePictureUrl,
    status: a.status,
    tokenExpiresAt: a.tokenExpiresAt,
    connectedAt: a.connectedAt,
    usage: { used: usage.used, limit: usage.limit, near: usage.near, full: usage.full },
    firstStepButtons: limits.firstStepButtons,
  };
}

function back(res: import("express").Response, query: string) {
  res.redirect(`${config.publicBaseUrl}/contas?${query}`);
}

instagramRouter.get("/instagram/connect", requireAuth, (req, res) => {
  const state = randomToken(16);
  res.cookie(STATE_COOKIE, signTemp({ state, userId: currentUser(req).id }, 600), cookieOptions(600_000));
  res.redirect(igApi.authUrl(state));
});

instagramRouter.get("/instagram/callback", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const saved = verifyTemp<{ state: string; userId: string }>(req.cookies?.[STATE_COOKIE]);
  const { maxAge: _m, ...opts } = cookieOptions(0);
  res.clearCookie(STATE_COOKIE, opts);
  if (req.query.error) return back(res, "erro=cancelado");
  if (!saved || saved.userId !== user.id || saved.state !== req.query.state || typeof req.query.code !== "string") {
    return back(res, "erro=falha");
  }
  try {
    const { accessToken: token, expiresIn } = await igApi.exchangeCode(req.query.code);
    const profile = await igApi.profile(token);
    const type = profile.accountType?.toUpperCase();
    if (type !== "CREATOR" && type !== "BUSINESS") return back(res, "erro=nao_profissional");
    const existing = await InstagramAccount.findOne({ igUserId: profile.igUserId });
    if (existing && String(existing.userId) !== user.id && !existing.disconnectedAt) return back(res, "erro=outra_pessoa");
    const account = existing ?? new InstagramAccount({ igUserId: profile.igUserId });
    account.userId = user._id;
    account.username = profile.username;
    account.accountType = type;
    account.profilePictureUrl = profile.profilePictureUrl;
    account.set("accessTokenEnc", encrypt(token));
    account.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    account.status = "connected";
    account.connectedAt = new Date();
    account.set("disconnectedAt", undefined);
    try {
      const lim = await igApi.publishingLimit(profile.igUserId, token);
      if (lim.quotaTotal) account.publishLimit = lim.quotaTotal;
    } catch (err) {
      console.warn("limite de publicação indisponível", (err as Error).message);
    }
    await account.save();
    await igApi.subscribeWebhooks(profile.igUserId, token);
    back(res, `conectada=${encodeURIComponent(profile.username)}`);
  } catch (err) {
    console.error("falha ao conectar o Instagram", (err as Error).message);
    back(res, "erro=falha");
  }
});

instagramRouter.get("/instagram/accounts", requireAuth, async (req, res) => {
  const accounts = await InstagramAccount.find(activeAccountsFilter(currentUser(req)._id)).sort({ connectedAt: 1 });
  res.json(await Promise.all(accounts.map(publicAccount)));
});

instagramRouter.get("/instagram/accounts/:id/media", requireAuth, async (req, res) => {
  const account = await findUserAccount(currentUser(req)._id, req.params.id as string);
  if (!account) throw notFound("Conta não encontrada.");
  try {
    res.json(await igApi.listMedia(account.igUserId, accessToken(account)));
  } catch (err) {
    const e = err as { tokenInvalid?: boolean };
    if (e.tokenInvalid) await markExpired(account);
    res.status(502).json({ error: "instagram_error", message: "Não foi possível carregar os posts do Instagram." });
  }
});

instagramRouter.delete("/instagram/accounts/:id", requireAuth, async (req, res) => {
  const account = await findUserAccount(currentUser(req)._id, req.params.id as string);
  if (!account) throw notFound("Conta não encontrada.");
  await disconnectAccount(account);
  res.sendStatus(204);
});

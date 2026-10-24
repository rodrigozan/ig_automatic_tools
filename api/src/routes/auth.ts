import { Router, Request, Response } from "express";
import { config } from "../config";
import { oauth, Provider } from "../services/oauth";
import { loginMessages, resolveLogin } from "../services/login";
import { clearSessionCookie, cookieOptions, setSessionCookie, signTemp, verifyTemp } from "../lib/session";
import { randomToken } from "../lib/crypto";
import { requireAuth, currentUser } from "../middleware/auth";
import { publicUser } from "../models/User";

export const authRouter = Router();

const STATE_COOKIE = "ig_oauth";
const providers: Provider[] = ["google", "facebook"];

function safeNext(v: unknown) {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/";
}

function loginRedirect(res: Response, code: keyof typeof loginMessages) {
  res.redirect(`${config.publicBaseUrl}/login?erro=${code}`);
}

for (const provider of providers) {
  authRouter.get(`/auth/${provider}`, (req: Request, res: Response) => {
    const state = randomToken(16);
    res.cookie(STATE_COOKIE, signTemp({ state, provider, next: safeNext(req.query.next) }, 600), cookieOptions(600_000));
    res.redirect(oauth.authUrl(provider, state));
  });

  authRouter.get(`/auth/${provider}/callback`, async (req: Request, res: Response) => {
    const saved = verifyTemp<{ state: string; provider: string; next: string }>(req.cookies?.[STATE_COOKIE]);
    const { maxAge: _m, ...opts } = cookieOptions(0);
    res.clearCookie(STATE_COOKIE, opts);
    if (!saved || saved.provider !== provider || saved.state !== req.query.state || typeof req.query.code !== "string") {
      loginRedirect(res, "failed");
      return;
    }
    let result;
    try {
      const profile = await oauth.profile(provider, req.query.code);
      result = await resolveLogin(profile);
    } catch (err) {
      console.error(`falha no login ${provider}`, err instanceof Error ? err.message : err);
      loginRedirect(res, "failed");
      return;
    }
    if ("error" in result) {
      loginRedirect(res, result.error);
      return;
    }
    setSessionCookie(res, result.user.id);
    res.redirect(`${config.publicBaseUrl}${saved.next === "/" ? "/" : saved.next}`);
  });
}

authRouter.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.sendStatus(204);
});

authRouter.get("/auth/me", requireAuth, (req, res) => {
  res.json(publicUser(currentUser(req)));
});

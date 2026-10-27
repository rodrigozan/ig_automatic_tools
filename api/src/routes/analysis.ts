import { Router } from "express";
import { z } from "zod";
import { config } from "../config";
import { requireAuth, currentUser } from "../middleware/auth";
import { requireAuthOrAnalysisAgent } from "../middleware/agentAuth";
import { analysisLimiter } from "../middleware/security";
import { cookieOptions, signTemp, verifyTemp } from "../lib/session";
import { encrypt, randomToken } from "../lib/crypto";
import { HttpError, notFound, parse, badRequest } from "../lib/errors";
import { objectId } from "../lib/validation";
import { InstagramAccount } from "../models/InstagramAccount";
import { ProfileAnalysis, publicAnalysis } from "../models/ProfileAnalysis";
import { igApi } from "../services/instagramApi";
import { activeAccountsFilter, findUserAccount } from "../services/accounts";
import { AnalysisError, LOOKUP_TTL_MS, REFRESH_MIN_MS, analyzeOther, analyzeOwn, fbAccountOf, normalizeUsername } from "../services/profileAnalysis";

export const analysisRouter = Router();

const STATE_COOKIE = "ig_fb_analysis";
const fbCallback = () => `${config.publicBaseUrl}/api/analysis/facebook/callback`;

const STATUS: Record<string, number> = { no_facebook: 409, profile_unavailable: 404, rate_limited: 429, token: 409, failed: 502 };

function asHttp(err: unknown): never {
  if (err instanceof AnalysisError) throw new HttpError(STATUS[err.kind] ?? 502, `analysis_${err.kind}`, err.message);
  throw err;
}

function back(res: import("express").Response, query: string) {
  res.redirect(`${config.publicBaseUrl}/analise?${query}`);
}

// Tudo que a tela precisa: contas, o estado da conexão com o Facebook, o perfil próprio de cada conta e os concorrentes.
analysisRouter.get("/analysis", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const accounts = await InstagramAccount.find(activeAccountsFilter(user._id)).sort({ connectedAt: 1 });
  const stored = await ProfileAnalysis.find({ userId: user._id, kind: { $in: ["own", "competitor"] } }).sort({ createdAt: 1 });
  const own = await Promise.all(
    accounts.map(async (a) => {
      let doc = stored.find((s) => s.kind === "own" && s.username === a.username.toLowerCase());
      let error: string | null = null;
      if (!doc && a.status === "connected") {
        try {
          doc = await analyzeOwn(a);
        } catch (err) {
          error = err instanceof AnalysisError ? err.message : "Não foi possível analisar este perfil agora.";
        }
      }
      return { accountId: a.id as string, username: a.username, analysis: doc ? publicAnalysis(doc) : null, error };
    })
  );
  res.json({
    facebook: { configured: Boolean(config.facebookAppId && config.facebookAppSecret), connected: Boolean(fbAccountOf(accounts)) },
    own,
    competitors: stored.filter((s) => s.kind === "competitor").map(publicAnalysis),
  });
});

analysisRouter.get("/analysis/facebook/connect", requireAuth, (req, res) => {
  if (!config.facebookAppId || !config.facebookAppSecret) throw new HttpError(503, "not_configured", "Login do Facebook não configurado no servidor.");
  const state = randomToken(16);
  res.cookie(STATE_COOKIE, signTemp({ state, userId: currentUser(req).id }, 600), cookieOptions(600_000));
  res.redirect(igApi.fbAuthUrl(state, fbCallback()));
});

analysisRouter.get("/analysis/facebook/callback", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const saved = verifyTemp<{ state: string; userId: string }>(req.cookies?.[STATE_COOKIE]);
  const { maxAge: _m, ...opts } = cookieOptions(0);
  res.clearCookie(STATE_COOKIE, opts);
  if (req.query.error) return back(res, "erro=cancelado");
  if (!saved || saved.userId !== user.id || saved.state !== req.query.state || typeof req.query.code !== "string") return back(res, "erro=falha");
  try {
    const pages = await igApi.fbPages(req.query.code, fbCallback());
    const accounts = await InstagramAccount.find(activeAccountsFilter(user._id));
    let linked = 0;
    for (const account of accounts) {
      const page = pages.find(
        (p) => p.igUserId && (p.igUserId === account.igUserId || account.altIgUserIds.includes(p.igUserId) || p.igUsername?.toLowerCase() === account.username.toLowerCase())
      );
      if (!page?.igUserId) continue;
      account.set("fbPageTokenEnc", encrypt(page.pageToken));
      account.fbIgUserId = page.igUserId;
      account.fbPageName = page.pageName;
      account.fbConnectedAt = new Date();
      await account.save();
      linked += 1;
    }
    back(res, linked ? "conectado=1" : "erro=sem_pagina");
  } catch (err) {
    console.error("falha ao conectar o Facebook para a análise", (err as Error).message);
    back(res, "erro=falha");
  }
});

analysisRouter.post("/analysis/own/:accountId/refresh", requireAuth, async (req, res) => {
  const account = await findUserAccount(currentUser(req)._id, req.params.accountId as string);
  if (!account) throw notFound("Conta não encontrada.");
  try {
    res.json(publicAnalysis(await analyzeOwn(account)));
  } catch (err) {
    asHttp(err);
  }
});

const addSchema = z.object({ username: z.string().min(1, "Informe o perfil.") }).strict();

analysisRouter.post("/analysis/competitors", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const body = parse(addSchema, req.body);
  const username = normalizeUsername(body.username);
  if (!username) throw badRequest("Perfil inválido.", { username: "Use o @ do perfil ou o endereço dele no Instagram." });
  const accounts = await InstagramAccount.find(activeAccountsFilter(user._id));
  if (accounts.some((a) => a.username.toLowerCase() === username)) throw badRequest("Esse é o seu próprio perfil.", { username: "Seu perfil já aparece como referência." });
  try {
    const { doc } = await analyzeOther(user._id, username, "competitor", { maxAgeMs: REFRESH_MIN_MS });
    res.status(201).json(publicAnalysis(doc));
  } catch (err) {
    asHttp(err);
  }
});

analysisRouter.post("/analysis/competitors/:id/refresh", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const doc = await ProfileAnalysis.findOne({ _id: parse(objectId, req.params.id), userId: user._id, kind: "competitor" });
  if (!doc) throw notFound("Perfil não encontrado.");
  try {
    const { doc: fresh } = await analyzeOther(user._id, doc.username, "competitor", { maxAgeMs: REFRESH_MIN_MS });
    res.json(publicAnalysis(fresh));
  } catch (err) {
    asHttp(err);
  }
});

analysisRouter.delete("/analysis/competitors/:id", requireAuth, async (req, res) => {
  const r = await ProfileAnalysis.deleteOne({ _id: parse(objectId, req.params.id), userId: currentUser(req)._id, kind: "competitor" });
  if (!r.deletedCount) throw notFound("Perfil não encontrado.");
  res.sendStatus(204);
});

// Consulta avulsa de um perfil (a prospecção do Harvey): não entra no comparativo e fica em cache por 24 h.
analysisRouter.get("/analysis/lookup", analysisLimiter, requireAuthOrAnalysisAgent, async (req, res) => {
  const user = currentUser(req);
  const username = normalizeUsername(String(req.query.username ?? ""));
  if (!username) throw badRequest("Perfil inválido.", { username: "Use o @ do perfil ou o endereço dele no Instagram." });
  try {
    const { doc, cached } = await analyzeOther(user._id, username, "lookup", { maxAgeMs: LOOKUP_TTL_MS });
    res.json({ ...publicAnalysis(doc), cached });
  } catch (err) {
    asHttp(err);
  }
});

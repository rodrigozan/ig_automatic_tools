import { Types } from "mongoose";
import { InstagramAccount, InstagramAccountDoc } from "../models/InstagramAccount";
import { ProfileAnalysis, ProfileAnalysisDoc } from "../models/ProfileAnalysis";
import { decrypt } from "../lib/crypto";
import { igApi, IgApiError, AnalysisSource } from "./instagramApi";
import { accessToken, activeAccountsFilter, markExpired } from "./accounts";
import { computeMetrics } from "./profileMetrics";

export type AnalysisErrorKind = "no_facebook" | "profile_unavailable" | "rate_limited" | "token" | "failed";

export class AnalysisError extends Error {
  constructor(public kind: AnalysisErrorKind, message: string) {
    super(message);
  }
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80002]);

export const LOOKUP_TTL_MS = 24 * 3_600_000;
export const REFRESH_MIN_MS = 10 * 60_000;

// "@Nome", "nome" ou o endereço do perfil -> "nome". Null quando não é um usuário válido do Instagram.
export function normalizeUsername(raw: string): string | null {
  let v = (raw ?? "").trim();
  const url = v.match(/instagram\.com\/([^/?#\s]+)/i);
  if (url) v = url[1];
  v = v.replace(/^@/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(v) && !/^\.|\.$/.test(v) ? v : null;
}

export function translateError(err: unknown): AnalysisError {
  if (err instanceof AnalysisError) return err;
  const e = err as IgApiError;
  if (e instanceof IgApiError) {
    if (e.tokenInvalid) return new AnalysisError("token", "O acesso do Facebook expirou. Conecte de novo.");
    if (e.code !== undefined && RATE_LIMIT_CODES.has(e.code)) return new AnalysisError("rate_limited", "Limite de consultas do Instagram atingido. Tente mais tarde.");
    if (e.code === 110 || e.code === 100 || e.subcode === 2207013) {
      return new AnalysisError("profile_unavailable", "Perfil não encontrado ou não é uma conta profissional (business ou creator).");
    }
  }
  return new AnalysisError("failed", "Não foi possível consultar o Instagram agora.");
}

export function fbAccountOf(accounts: InstagramAccountDoc[]) {
  return accounts.find((a) => a.fbPageTokenEnc && a.fbIgUserId && !a.disconnectedAt);
}

async function save(userId: Types.ObjectId | string, username: string, kind: "own" | "competitor" | "lookup", src: AnalysisSource): Promise<ProfileAnalysisDoc> {
  const metrics = computeMetrics(src.profile, src.posts);
  const profile = {
    name: src.profile.name,
    biography: src.profile.biography,
    website: src.profile.website,
    profilePictureUrl: src.profile.profilePictureUrl,
  };
  const existing = await ProfileAnalysis.findOne({ userId, username });
  const nextKind = existing && existing.kind !== "lookup" ? existing.kind : kind;
  const doc =
    existing ?? new ProfileAnalysis({ userId, username, kind: nextKind });
  doc.kind = nextKind;
  doc.set("profile", profile);
  doc.set("metrics", metrics);
  doc.set("error", undefined);
  doc.fetchedAt = new Date();
  await doc.save();
  return doc;
}

// Perfil próprio: API do login do Instagram, a mesma token da publicação.
export async function analyzeOwn(account: InstagramAccountDoc): Promise<ProfileAnalysisDoc> {
  try {
    const src = await igApi.ownAnalysisData(account.igUserId, accessToken(account));
    return await save(account.userId, account.username.toLowerCase(), "own", src);
  } catch (err) {
    if ((err as IgApiError).tokenInvalid) await markExpired(account);
    throw translateError(err);
  }
}

// Outro perfil: business_discovery, com o token da Página ligada a uma das contas do usuário.
export async function analyzeOther(
  userId: Types.ObjectId | string,
  username: string,
  kind: "competitor" | "lookup",
  opts: { maxAgeMs?: number } = {}
): Promise<{ doc: ProfileAnalysisDoc; cached: boolean }> {
  if (opts.maxAgeMs) {
    const cached = await ProfileAnalysis.findOne({ userId, username });
    if (cached?.metrics && !cached.error && Date.now() - cached.fetchedAt.getTime() < opts.maxAgeMs) {
      if (kind === "competitor" && cached.kind === "lookup") {
        cached.kind = "competitor";
        await cached.save();
      }
      return { doc: cached, cached: true };
    }
  }
  const accounts = await InstagramAccount.find(activeAccountsFilter(userId));
  const account = fbAccountOf(accounts);
  if (!account) throw new AnalysisError("no_facebook", "Conecte o Facebook para consultar outros perfis.");
  try {
    const token = decrypt(account.fbPageTokenEnc as { data: string; iv: string; tag: string });
    const src = await igApi.businessDiscovery(account.fbIgUserId as string, token, username);
    return { doc: await save(userId, username, kind, src), cached: false };
  } catch (err) {
    throw translateError(err);
  }
}

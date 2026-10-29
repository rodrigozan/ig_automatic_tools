import { Types } from "mongoose";
import { decrypt } from "../lib/crypto";
import { FacebookPage, FacebookPageDoc } from "../models/FacebookPage";
import { PageAnalysis, PageAnalysisDoc } from "../models/PageAnalysis";
import { igApi, IgApiError, PageSource } from "./instagramApi";
import { AnalysisError } from "./profileAnalysis";
import { computeMetrics } from "./profileMetrics";

// Código 10/200/299: falta a permissão de acesso público a Páginas (só vem com revisão do app na Meta).
const NO_PUBLIC_ACCESS = new Set([10, 200, 299]);

function translate(err: unknown, other: boolean): AnalysisError {
  if (err instanceof AnalysisError) return err;
  if (err instanceof IgApiError) {
    if (err.tokenInvalid) return new AnalysisError("token", "O acesso do Facebook expirou. Conecte de novo.");
    if (err.code === 4 || err.code === 17 || err.code === 32 || err.code === 613) return new AnalysisError("rate_limited", "Limite de consultas do Facebook atingido. Tente mais tarde.");
    if (other && err.code !== undefined && NO_PUBLIC_ACCESS.has(err.code)) {
      return new AnalysisError("profile_unavailable", "A Meta só libera ler Páginas de terceiros com a permissão “Page Public Content Access”, que exige revisão do app.");
    }
    if (err.code === 100 || err.code === 803) return new AnalysisError("profile_unavailable", "Página não encontrada.");
  }
  return new AnalysisError("failed", "Não foi possível consultar o Facebook agora.");
}

// Endereço da Página, "facebook.com/nome", ou só o nome de usuário / ID numérico.
export function normalizePageRef(raw: string): string | null {
  let v = (raw ?? "").trim();
  const url = v.match(/facebook\.com\/(?:profile\.php\?id=)?(?:pages\/[^/]+\/)?([^/?#&\s]+)/i);
  if (url) v = url[1];
  v = v.replace(/^@/, "");
  return /^[A-Za-z0-9.\-]{1,100}$/.test(v) ? v : null;
}

function metricsOf(src: PageSource) {
  return { ...computeMetrics(src.profile, src.posts), avgShares: src.avgShares };
}

async function save(userId: Types.ObjectId | string, kind: "own" | "competitor", src: PageSource): Promise<PageAnalysisDoc> {
  const doc = (await PageAnalysis.findOne({ userId, pageId: src.pageId })) ?? new PageAnalysis({ userId, pageId: src.pageId, kind });
  if (doc.kind !== "own") doc.kind = kind;
  doc.username = src.profile.username;
  doc.set("profile", {
    name: src.profile.name,
    biography: src.profile.biography,
    website: src.profile.website,
    profilePictureUrl: src.profile.profilePictureUrl,
  });
  doc.set("metrics", metricsOf(src));
  doc.fetchedAt = new Date();
  await doc.save();
  return doc;
}

export async function analyzeOwnPage(userId: Types.ObjectId | string, page: FacebookPageDoc): Promise<PageAnalysisDoc> {
  try {
    const src = await igApi.pageAnalysisData(page.pageId, decrypt(page.tokenEnc as { data: string; iv: string; tag: string }));
    return await save(userId, "own", src);
  } catch (err) {
    throw translate(err, false);
  }
}

// Outra Página: lida com o token de uma Página do próprio usuário.
export async function analyzePageCompetitor(userId: Types.ObjectId | string, ref: string): Promise<PageAnalysisDoc> {
  const page = await FacebookPage.findOne({ userId }).sort({ connectedAt: 1 });
  if (!page) throw new AnalysisError("no_facebook", "Conecte o Facebook para consultar outras Páginas.");
  try {
    const src = await igApi.pageAnalysisData(ref, decrypt(page.tokenEnc as { data: string; iv: string; tag: string }));
    if (await PageAnalysis.exists({ userId, pageId: src.pageId, kind: "own" })) {
      throw new AnalysisError("failed", "Essa é uma das suas Páginas.");
    }
    return await save(userId, "competitor", src);
  } catch (err) {
    throw translate(err, true);
  }
}

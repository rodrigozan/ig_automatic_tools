import { Types } from "mongoose";
import { badRequest } from "../lib/errors";
import { MINUTE } from "../lib/time";
import { FacebookPage } from "../models/FacebookPage";
import { Media } from "../models/Media";
import { findUserAccount } from "./accounts";

export const MIN_LEAD_MS = 5 * MINUTE;
export const CAPTION_MAX = 2200;

export type PostType = "post" | "reel" | "carousel";

export function mediaCountError(type: PostType, count: number) {
  if ((type === "post" || type === "reel") && count !== 1) return "Escolha exatamente 1 mídia.";
  if (type === "carousel" && (count < 2 || count > 10)) return "O carrossel precisa de 2 a 10 mídias.";
  return null;
}

export function scheduleTimeError(scheduledAt: Date, now = new Date()) {
  if (Number.isNaN(scheduledAt.getTime())) return "Data inválida.";
  if (scheduledAt.getTime() < now.getTime() + MIN_LEAD_MS) return "Escolha um horário com pelo menos 5 minutos de antecedência.";
  return null;
}

export async function validatePost(
  userId: Types.ObjectId,
  input: { accountId?: string; destination?: "instagram" | "facebook" | "both"; facebookPageId?: string; type: PostType; mediaIds: string[]; caption?: string; scheduledAt: Date; checkTime: boolean },
  now = new Date()
) {
  const fields: Record<string, string> = {};
  const needsInstagram = input.destination !== "facebook";
  const account = input.accountId ? await findUserAccount(userId, input.accountId) : null;
  if (needsInstagram) {
    if (!account) fields.accountId = "Escolha uma conta conectada.";
    else if (account.status !== "connected") fields.accountId = `Reconecte @${account.username} antes de agendar.`;
  }
  if (input.destination === "facebook" || input.destination === "both") {
    const page = input.facebookPageId && await FacebookPage.findOne({ userId, pageId: input.facebookPageId });
    if (!page) fields.facebookPageId = "Escolha uma Página do Facebook conectada.";
  }

  const countErr = mediaCountError(input.type, input.mediaIds.length);
  if (countErr) fields.mediaIds = countErr;
  else if (new Set(input.mediaIds).size !== input.mediaIds.length) fields.mediaIds = "Mídia repetida.";
  else {
    const media = await Media.find({ _id: { $in: input.mediaIds }, userId, deletedAt: { $exists: false } });
    if (media.length !== input.mediaIds.length) fields.mediaIds = "Mídia não encontrada.";
    else if (media.some((m) => m.conversionStatus === "failed")) fields.mediaIds = "Uma das mídias não pôde ser convertida. Troque o arquivo.";
    else if (input.destination !== undefined && input.destination !== "instagram" && input.type === "carousel" && media.some((m) => m.kind !== "image")) fields.mediaIds = "No Facebook, o carrossel aceita apenas imagens.";
    else if (input.type === "post" && media[0].kind !== "image") fields.mediaIds = "Post usa uma imagem. Para vídeo, escolha reel.";
    else if (input.type === "reel" && media[0].kind !== "video") fields.mediaIds = "Reel usa um vídeo.";
  }

  if ((input.caption ?? "").length > CAPTION_MAX) fields.caption = `A legenda passa de ${CAPTION_MAX} caracteres.`;
  if (input.checkTime) {
    const t = scheduleTimeError(input.scheduledAt, now);
    if (t) fields.scheduledAt = t;
  }
  if (Object.keys(fields).length) throw badRequest("Confira os campos destacados.", fields);
  return account!;
}

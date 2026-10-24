import { z } from "zod";
import { ptBR } from "zod/locales";

z.config(ptBR());
import { Types } from "mongoose";

export const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:mm.");

export const timezone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Fuso horário inválido.");

export const weekdayTimes = z
  .array(
    z.object({
      weekday: z.number().int().min(0, "Dia inválido.").max(6, "Dia inválido."),
      times: z.array(timeString).min(1, "Escolha ao menos um horário."),
    })
  )
  .refine((v) => new Set(v.map((d) => d.weekday)).size === v.length, "Dia repetido na agenda.")
  .transform((v) =>
    v
      .map((d) => ({ weekday: d.weekday, times: [...new Set(d.times)].sort() }))
      .sort((a, b) => a.weekday - b.weekday)
  );

export const objectId = z.string().refine((v) => Types.ObjectId.isValid(v), "Identificador inválido.");

export const email = z.string().trim().toLowerCase().pipe(z.email("E-mail inválido."));

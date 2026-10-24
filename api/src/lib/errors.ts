import { NextFunction, Request, Response } from "express";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message);
  }
}

export const notFound = (message = "Não encontrado.") => new HttpError(404, "not_found", message);
export const badRequest = (message: string, fields?: Record<string, string>) =>
  new HttpError(400, "invalid", message, fields);

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  throw badRequest("Confira os campos destacados.", fields);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message, fields: err.fields });
    return;
  }
  const e = err as { name?: string; status?: number; type?: string; code?: string };
  if (e?.name === "CastError") {
    res.status(404).json({ error: "not_found", message: "Não encontrado." });
    return;
  }
  if (e?.type === "entity.parse.failed" || e?.type === "entity.too.large") {
    res.status(e.status ?? 400).json({ error: "invalid", message: "Corpo da requisição inválido." });
    return;
  }
  if (e?.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "too_large", message: "Arquivo grande demais." });
    return;
  }
  console.error("erro não tratado", err instanceof Error ? err.stack : err);
  res.status(500).json({ error: "server_error", message: "Algo deu errado. Tente de novo." });
}

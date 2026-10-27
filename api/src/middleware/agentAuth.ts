import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { User } from "../models/User";
import { HttpError } from "../lib/errors";
import { requireAuth } from "./auth";

export interface InstagramAgentClaims extends jwt.JwtPayload {
  agentId: string;
  scope: "instagram:publish";
}

declare global {
  namespace Express {
    interface Request {
      igAgent?: InstagramAgentClaims;
    }
  }
}

// Aceita o token de agente do PhanterClaw (Bearer, HS256, escopo instagram:publish) ou, sem Bearer,
// a sessão normal em cookie. Só vale nas rotas que usam este middleware (envio de mídia, criação e
// leitura de publicações, listagem de contas): editar, cancelar e apagar continuam só com login humano.
export async function requireAuthOrAgent(req: Request, res: Response, next: NextFunction) {
  const bearer = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) {
    await requireAuth(req, res, next);
    return;
  }
  try {
    const secret = config.agentJwtSecret;
    if (!secret) throw new HttpError(503, "agent_disabled", "Publicação por agente não configurada no servidor.");
    let claims: InstagramAgentClaims;
    try {
      claims = jwt.verify(bearer, secret, { algorithms: ["HS256"], issuer: "phanterclaw", audience: "ig-automatic-tools" }) as InstagramAgentClaims;
    } catch {
      throw new HttpError(401, "unauthorized", "Credencial de agente inválida ou expirada.");
    }
    if (claims.scope !== "instagram:publish" || !config.agentIds.includes(claims.agentId)) {
      throw new HttpError(403, "forbidden", "Agente sem autorização para publicar no Instagram.");
    }
    const email = config.agentUserEmail;
    const user = email ? await User.findOne({ email }).catch(() => null) : null;
    if (!user || !user.active) {
      throw new HttpError(403, "forbidden", "Usuário dono das publicações do agente não encontrado ou desativado.");
    }
    req.user = user;
    req.igAgent = claims;
    next();
  } catch (err) {
    next(err);
  }
}

export interface AnalysisAgentClaims extends jwt.JwtPayload {
  agentId: string;
  scope: "instagram:analyze";
}

// Como acima, mas para a consulta de perfis: segredo e escopo próprios (instagram:analyze), que não servem
// para publicar. Quem consulta (o Harvey) não consegue gerar um token de publicação com isto.
export async function requireAuthOrAnalysisAgent(req: Request, res: Response, next: NextFunction) {
  const bearer = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) {
    await requireAuth(req, res, next);
    return;
  }
  try {
    const secret = config.analysisJwtSecret;
    if (!secret) throw new HttpError(503, "agent_disabled", "Consulta de perfis por agente não configurada no servidor.");
    let claims: AnalysisAgentClaims;
    try {
      claims = jwt.verify(bearer, secret, { algorithms: ["HS256"], audience: "ig-automatic-tools" }) as AnalysisAgentClaims;
    } catch {
      throw new HttpError(401, "unauthorized", "Credencial de agente inválida ou expirada.");
    }
    if (claims.scope !== "instagram:analyze" || !config.analysisAgentIds.includes(claims.agentId)) {
      throw new HttpError(403, "forbidden", "Agente sem autorização para consultar perfis.");
    }
    const email = config.agentUserEmail;
    const user = email ? await User.findOne({ email }).catch(() => null) : null;
    if (!user || !user.active) {
      throw new HttpError(403, "forbidden", "Usuário dono das consultas do agente não encontrado ou desativado.");
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

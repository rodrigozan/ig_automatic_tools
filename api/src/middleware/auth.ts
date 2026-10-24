import { NextFunction, Request, Response } from "express";
import { User, UserDoc } from "../models/User";
import { SESSION_COOKIE, clearSessionCookie, setSessionCookie, verifySession } from "../lib/session";
import { HttpError } from "../lib/errors";

declare global {
  namespace Express {
    interface Request {
      user?: UserDoc;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  const userId = token ? verifySession(token) : null;
  const user = userId ? await User.findById(userId).catch(() => null) : null;
  if (!user || !user.active) {
    clearSessionCookie(res);
    next(new HttpError(401, "unauthorized", "Sua sessão expirou. Entre de novo."));
    return;
  }
  setSessionCookie(res, user.id);
  req.user = user;
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    next(new HttpError(403, "forbidden", "Você não tem acesso a esta página."));
    return;
  }
  next();
}

export function currentUser(req: Request): UserDoc {
  if (!req.user) throw new HttpError(401, "unauthorized", "Sua sessão expirou. Entre de novo.");
  return req.user;
}

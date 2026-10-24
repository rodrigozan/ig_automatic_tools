import { Response } from "express";
import jwt from "jsonwebtoken";
import { config, isProduction } from "../config";

export const SESSION_COOKIE = "ig_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  if (!config.jwtSecret) throw new Error("JWT_SECRET não definido");
  return config.jwtSecret;
}

export function signSession(userId: string) {
  return jwt.sign({ sub: userId }, secret(), { expiresIn: Math.floor(SESSION_TTL_MS / 1000) });
}

export function verifySession(token: string): string | null {
  try {
    const p = jwt.verify(token, secret()) as jwt.JwtPayload;
    return typeof p.sub === "string" ? p.sub : null;
  } catch {
    return null;
  }
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction || config.publicBaseUrl.startsWith("https://"),
    path: "/ig",
    maxAge,
  };
}

export function setSessionCookie(res: Response, userId: string) {
  res.cookie(SESSION_COOKIE, signSession(userId), cookieOptions(SESSION_TTL_MS));
}

export function clearSessionCookie(res: Response) {
  const { maxAge: _m, ...opts } = cookieOptions(0);
  res.clearCookie(SESSION_COOKIE, opts);
}

export function signTemp(payload: object, ttlSec: number) {
  return jwt.sign(payload, secret(), { expiresIn: ttlSec });
}

export function verifyTemp<T>(token: string | undefined): T | null {
  if (!token) return null;
  try {
    return jwt.verify(token, secret()) as T;
  } catch {
    return null;
  }
}

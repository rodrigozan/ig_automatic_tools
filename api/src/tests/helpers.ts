import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { AddressInfo } from "net";
import { Server } from "http";
import mongoose from "mongoose";
import { config } from "../config";
import { createApp } from "../app";
import { connectDb } from "../db";
import { signSession } from "../lib/session";
import { User } from "../models/User";

config.jwtSecret = "segredo-de-teste";
config.tokenEncKey = crypto.createHash("sha256").update("chave-de-teste").digest("base64");
config.adminEmail = "rod@example.com";
config.instagramAppSecret = "segredo-app-teste";
config.metaWebhookVerifyToken = "tok-teste";
config.publicBaseUrl = "https://exemplo.test/ig";
config.mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), "ig-media-"));

export async function setupDb() {
  if (!config.dbUriTest.includes("test")) throw new Error("DB_URI_TEST precisa apontar para o banco de testes");
  await connectDb(config.dbUriTest);
  await mongoose.connection.dropDatabase().catch(clearDb);
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

export async function clearDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

export async function teardownDb() {
  await mongoose.disconnect();
}

export async function startServer() {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

let seq = 0;

export async function createUser(attrs: Partial<{ email: string; role: "admin" | "creator"; active: boolean; timezone: string }> = {}) {
  seq += 1;
  return User.create({
    name: `Pessoa ${seq}`,
    email: attrs.email ?? `pessoa${seq}@example.com`,
    providers: [{ provider: "google", providerId: `g-${seq}-${Date.now()}` }],
    role: attrs.role ?? "creator",
    active: attrs.active ?? true,
    timezone: attrs.timezone ?? "America/Sao_Paulo",
  });
}

export function sessionCookie(userId: string) {
  return `ig_session=${signSession(userId)}`;
}

export function client(baseUrl: string, cookie?: string) {
  const call = async (method: string, p: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(`${baseUrl}/ig/api${p}`, {
      method,
      redirect: "manual",
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: any = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    return { status: res.status, body: json, headers: res.headers };
  };
  return {
    get: (p: string) => call("GET", p),
    post: (p: string, body?: unknown) => call("POST", p, body ?? {}),
    patch: (p: string, body?: unknown) => call("PATCH", p, body ?? {}),
    del: (p: string) => call("DELETE", p),
  };
}

import { execFileSync } from "child_process";
import { igApi } from "../services/instagramApi";
import { InstagramAccount } from "../models/InstagramAccount";
import { Media } from "../models/Media";
import { encrypt, randomToken } from "../lib/crypto";
import { Types } from "mongoose";

type IgApi = typeof igApi;
const originalIg = { ...igApi };

export function stubIg(over: Partial<IgApi>) {
  Object.assign(igApi, over);
}

export function restoreIg() {
  Object.assign(igApi, originalIg);
}

export const fixturesDir = fs.mkdtempSync(path.join(os.tmpdir(), "ig-fixtures-"));

export function makeFixture(name: string, args: string[]) {
  const out = path.join(fixturesDir, name);
  if (!fs.existsSync(out)) execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args, out]);
  return out;
}

export function jpgFixture() {
  return makeFixture("quadrado.jpg", ["-f", "lavfi", "-i", "color=c=red:s=1080x1080", "-frames:v", "1"]);
}

export function pngFixture() {
  return makeFixture("alto.png", ["-f", "lavfi", "-i", "color=c=blue:s=600x1200", "-frames:v", "1"]);
}

export function mp4Fixture() {
  return makeFixture("ok.mp4", [
    "-f", "lavfi", "-i", "testsrc=s=540x960:r=30:d=4",
    "-f", "lavfi", "-i", "sine=f=440:d=4",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
  ]);
}

export function aviFixture() {
  return makeFixture("fora.avi", ["-f", "lavfi", "-i", "testsrc=s=320x568:r=25:d=4", "-c:v", "mpeg4"]);
}

export async function createAccount(userId: Types.ObjectId, attrs: Partial<{ username: string; status: "connected" | "expired" | "revoked"; tokenExpiresAt: Date; publishLimit: number }> = {}) {
  return InstagramAccount.create({
    userId,
    igUserId: `ig-${randomToken(6)}`,
    username: attrs.username ?? "rod.creator",
    accountType: "CREATOR",
    accessTokenEnc: encrypt("token-ig"),
    tokenExpiresAt: attrs.tokenExpiresAt ?? new Date(Date.now() + 50 * 86400000),
    status: attrs.status ?? "connected",
    publishLimit: attrs.publishLimit,
  });
}

export async function createMedia(userId: Types.ObjectId, kind: "image" | "video" = "image", attrs: Partial<{ conversionStatus: "pending" | "converting" | "done" | "not_needed" | "failed"; createdAt: Date }> = {}) {
  const dir = path.join(config.mediaDir, "uploads", String(userId));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${randomToken(6)}.${kind === "image" ? "jpg" : "mp4"}`);
  fs.copyFileSync(kind === "image" ? jpgFixture() : mp4Fixture(), file);
  const m = await Media.create({
    userId,
    kind,
    originalName: path.basename(file),
    storagePath: file,
    publicToken: randomToken(24),
    mimeType: kind === "image" ? "image/jpeg" : "video/mp4",
    sizeBytes: fs.statSync(file).size,
    conversionStatus: attrs.conversionStatus ?? "not_needed",
  });
  if (attrs.createdAt) {
    await Media.collection.updateOne({ _id: m._id }, { $set: { createdAt: attrs.createdAt } });
    m.createdAt = attrs.createdAt;
  }
  return m;
}

export async function upload(baseUrl: string, cookie: string, files: string[]) {
  const form = new FormData();
  for (const f of files) form.append("files", new Blob([fs.readFileSync(f)], { type: mimeOf(f) }), path.basename(f));
  const res = await fetch(`${baseUrl}/ig/api/media`, { method: "POST", headers: { cookie }, body: form });
  return { status: res.status, body: await res.json() };
}

function mimeOf(f: string) {
  const ext = path.extname(f).toLowerCase();
  return ({ ".jpg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4", ".avi": "video/x-msvideo" } as Record<string, string>)[ext] ?? "application/octet-stream";
}

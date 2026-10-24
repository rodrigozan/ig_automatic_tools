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
  await mongoose.connection.dropDatabase();
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

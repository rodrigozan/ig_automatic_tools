import crypto from "crypto";
import { config } from "../config";

export type Encrypted = { data: string; iv: string; tag: string };

function key() {
  const k = Buffer.from(config.tokenEncKey, "base64");
  if (k.length !== 32) throw new Error("TOKEN_ENC_KEY precisa ter 32 bytes em base64");
  return k;
}

export function encrypt(plain: string): Encrypted {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { data: data.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

export function decrypt(enc: Encrypted): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(enc.iv, "base64"));
  decipher.setAuthTag(Buffer.from(enc.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(enc.data, "base64")), decipher.final()]).toString("utf8");
}

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}

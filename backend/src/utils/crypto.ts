import crypto from "node:crypto";
import { env } from "../config/env.js";

function key() {
  const secret = env.APP_ENCRYPTION_KEY ?? env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret) return null;
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string | undefined | null) {
  if (!value) return null;
  const encryptionKey = key();
  if (!encryptionKey) {
    const err = new Error("Falta APP_ENCRYPTION_KEY o GOOGLE_TOKEN_ENCRYPTION_KEY para guardar credenciales") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return null;
  const encryptionKey = key();
  if (!encryptionKey) {
    const err = new Error("Falta APP_ENCRYPTION_KEY o GOOGLE_TOKEN_ENCRYPTION_KEY para leer credenciales") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const [iv, tag, encrypted] = value.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

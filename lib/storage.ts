import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { env } from "@/lib/env";

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

export function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base || "attachment.bin";
}

export function createStorageKey(bookingId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  const unique = crypto.randomBytes(8).toString("hex");
  return `${bookingId}/${unique}-${safeName}`;
}

export function signStorageAccess(
  storageKey: string,
  expiresAtMs: number
): string {
  return crypto
    .createHmac("sha256", env.storageSigningSecret)
    .update(`${storageKey}:${expiresAtMs}`)
    .digest("hex");
}

export function verifyStorageAccess(
  storageKey: string,
  expiresAtMs: number,
  signature: string
): boolean {
  if (Date.now() > expiresAtMs) return false;
  const expected = signStorageAccess(storageKey, expiresAtMs);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

export async function writePrivateFile(
  storageKey: string,
  buffer: Buffer
): Promise<string> {
  const targetPath = path.resolve(UPLOADS_ROOT, storageKey);
  if (!targetPath.startsWith(UPLOADS_ROOT + path.sep)) {
    throw new Error("INVALID_STORAGE_PATH");
  }
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, buffer);
  return targetPath;
}

export async function readPrivateFile(storageKey: string): Promise<Buffer> {
  const targetPath = path.resolve(UPLOADS_ROOT, storageKey);
  if (!targetPath.startsWith(UPLOADS_ROOT + path.sep)) {
    throw new Error("INVALID_STORAGE_PATH");
  }
  return fs.readFile(targetPath);
}

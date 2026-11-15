import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MediaAssetPurpose } from "@prisma/client";
import { env, hasR2Config } from "@/lib/env";

export { MAX_BROWSER_UPLOAD_BYTES } from "./upload-constants";

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
const PUBLIC_LOCAL_ROOT = path.resolve(UPLOADS_ROOT, "_public");

export type StorageProvider = "R2" | "LOCAL";
export type MediaStorageFolder =
  | "avatars"
  | "portfolios"
  | "editorial"
  | "general";

export interface StoredObjectResult {
  storageKey: string;
  storageProvider: StorageProvider;
  bucket: string | null;
  etag: string | null;
  sizeBytes: number;
}

const ALLOWED_MEDIA_FOLDERS = new Set<MediaStorageFolder>([
  "avatars",
  "portfolios",
  "editorial",
  "general",
]);

const BLOCKED_ACTIVE_MIMES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/javascript",
  "text/javascript",
  "application/x-javascript",
  "application/ecmascript",
  "text/ecmascript",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-sh",
  "application/x-shellscript",
  "application/x-httpd-php",
  "text/x-php",
  "application/x-bat",
  "application/x-csh",
  "application/x-python",
  "text/xml",
  "application/xml",
]);

const BLOCKED_ACTIVE_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".xhtml",
  ".svg",
  ".svgz",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".exe",
  ".dll",
  ".msi",
  ".bat",
  ".cmd",
  ".sh",
  ".bash",
  ".zsh",
  ".ps1",
  ".psm1",
  ".php",
  ".phtml",
  ".py",
  ".rb",
  ".pl",
  ".cgi",
  ".jar",
  ".com",
  ".scr",
  ".vbs",
  ".vbe",
  ".wsf",
  ".hta",
]);

const ALLOWED_BOOKING_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "text/csv",
  "application/csv",
  "application/rtf",
  "text/rtf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);

const IMAGE_BASIC_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_BASIC_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const MEDIA_PURPOSE_RULES: Record<
  MediaAssetPurpose,
  { mimes: Set<string>; extensions: Set<string> }
> = {
  [MediaAssetPurpose.USER_AVATAR]: {
    mimes: IMAGE_BASIC_MIMES,
    extensions: IMAGE_BASIC_EXTENSIONS,
  },
  [MediaAssetPurpose.CREATOR_PORTFOLIO_IMAGE]: {
    mimes: IMAGE_BASIC_MIMES,
    extensions: IMAGE_BASIC_EXTENSIONS,
  },
  [MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT]: {
    mimes: new Set([
      ...IMAGE_BASIC_MIMES,
      "application/pdf",
      "text/plain",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]),
    extensions: new Set([...IMAGE_BASIC_EXTENSIONS, ".pdf", ".txt", ".docx"]),
  },
  [MediaAssetPurpose.EDITORIAL_ASSET]: {
    mimes: new Set([...IMAGE_BASIC_MIMES, "image/avif"]),
    extensions: new Set([...IMAGE_BASIC_EXTENSIONS, ".avif"]),
  },
  [MediaAssetPurpose.GENERAL]: {
    mimes: new Set([
      ...IMAGE_BASIC_MIMES,
      "image/avif",
      "application/pdf",
      "text/plain",
      "text/markdown",
      "text/x-markdown",
      "text/csv",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]),
    extensions: new Set([
      ...IMAGE_BASIC_EXTENSIONS,
      ".avif",
      ".pdf",
      ".txt",
      ".md",
      ".markdown",
      ".csv",
      ".doc",
      ".docx",
      ".xlsx",
    ]),
  },
};

let r2ClientSingleton: S3Client | null = null;

function resolveR2Endpoint(): string {
  if (env.r2Endpoint) return env.r2Endpoint;
  if (env.r2AccountId) {
    return `https://${env.r2AccountId}.r2.cloudflarestorage.com`;
  }
  return "";
}

function getR2Client(): S3Client {
  if (r2ClientSingleton) return r2ClientSingleton;
  const endpoint = resolveR2Endpoint();
  if (!hasR2Config() || !endpoint || !env.r2BucketName) {
    throw new Error("R2_NOT_CONFIGURED");
  }
  r2ClientSingleton = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
    },
    // R2 rejects AWS SDK v3 default flexible checksum headers on presigned & certain PutObject calls unless WHEN_REQUIRED
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return r2ClientSingleton;
}

export function sanitizePathSegment(
  segment: string,
  fallback = "item"
): string {
  const cleaned = String(segment ?? "")
    .replace(/\0/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");
  return cleaned || fallback;
}

export function sanitizeFileName(name: string): string {
  const raw = String(name ?? "").replace(/\0/g, "").trim();
  const baseSegment = raw.split(/[/\\]+/).filter(Boolean).pop() ?? "";
  const cleaned = baseSegment
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+/, "");
  if (!cleaned || /^[._-]+$/.test(cleaned)) {
    return "attachment.bin";
  }
  return cleaned;
}

export function getR2KeyPrefix(): string {
  const raw = (env.r2KeyPrefix || "tovolana_writers").replace(
    /^\/+|\/+$/g,
    ""
  );
  const segments = raw
    .split(/[/\\]+/)
    .map((seg) => sanitizePathSegment(seg, ""))
    .filter(Boolean);
  return segments.length > 0 ? segments.join("/") : "tovolana_writers";
}

function hasUnsafeKeySyntax(candidate: string): boolean {
  if (!candidate || /[\x00-\x1f\x7f]/.test(candidate)) return true;
  if (
    candidate.startsWith("/") ||
    candidate.endsWith("/") ||
    candidate.includes("\\")
  ) {
    return true;
  }
  if (/(?:^|\/)(?:%2e|\.)(?:%2e|\.)?(?:$|\/)/i.test(candidate)) {
    return true;
  }
  const segments = candidate.split("/");
  return segments.some((seg) => seg === "" || seg === "." || seg === "..");
}

export function assertScopedStorageKey(
  storageKey: string,
  options?: { allowLegacyLocal?: boolean }
): string {
  if (typeof storageKey !== "string" || storageKey.trim().length === 0) {
    throw new Error("INVALID_STORAGE_PATH");
  }
  if (storageKey !== storageKey.trim() || hasUnsafeKeySyntax(storageKey)) {
    throw new Error("INVALID_STORAGE_PATH");
  }

  try {
    const decoded = decodeURIComponent(storageKey);
    if (hasUnsafeKeySyntax(decoded)) {
      throw new Error("INVALID_STORAGE_PATH");
    }
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_STORAGE_PATH") {
      throw err;
    }
    // Literal '%' characters that are not percent-encodings stay valid if raw segment checks passed.
  }

  if (!options?.allowLegacyLocal) {
    const prefix = getR2KeyPrefix();
    if (!storageKey.startsWith(`${prefix}/`)) {
      throw new Error("INVALID_STORAGE_PATH");
    }
  }

  return storageKey;
}

export function createStorageKey(bookingId: string, fileName: string): string {
  const prefix = getR2KeyPrefix();
  const safeBookingId = sanitizePathSegment(bookingId, "booking");
  const safeName = sanitizeFileName(fileName);
  const unique = crypto.randomBytes(8).toString("hex");
  return `${prefix}/bookings/${safeBookingId}/${unique}-${safeName}`;
}

export function createMediaStorageKey(
  folder: MediaStorageFolder,
  ownerSegment: string,
  fileName: string
): string {
  if (!ALLOWED_MEDIA_FOLDERS.has(folder)) {
    throw new Error("INVALID_MEDIA_FOLDER");
  }
  const prefix = getR2KeyPrefix();
  const safeOwner = sanitizePathSegment(ownerSegment, "shared");
  const safeName = sanitizeFileName(fileName);
  const unique = crypto.randomBytes(4).toString("hex");
  return `${prefix}/media/${folder}/${safeOwner}/${unique}-${safeName}`;
}

export function buildPublicR2Url(storageKey: string): string | null {
  const scopedKey = assertScopedStorageKey(storageKey);
  const baseUrl = (env.nextPublicR2PublicUrl || env.r2PublicUrl || "")
    .trim()
    .replace(/\/+$/, "");
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
    return null;
  }
  const encodedPath = scopedKey.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/${encodedPath}`;
}

function normalizeMime(mimeType: string): string {
  return String(mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

function getFileExtension(fileName?: string): string {
  if (!fileName) return "";
  const trimmed = String(fileName).replace(/\0/g, "").trim();
  const base = trimmed.split(/[/\\]+/).filter(Boolean).pop() ?? "";
  const dotIndex = base.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex >= base.length - 1) {
    return "";
  }
  return base.slice(dotIndex).toLowerCase();
}

function isBlockedActiveContent(normalizedMime: string, ext: string): boolean {
  if (BLOCKED_ACTIVE_MIMES.has(normalizedMime)) return true;
  if (ext && BLOCKED_ACTIVE_EXTENSIONS.has(ext)) return true;
  return false;
}

export function validateBookingUploadMime(
  mimeType: string,
  fileName?: string
): boolean {
  const normalized = normalizeMime(mimeType);
  const ext = getFileExtension(fileName);
  if (!normalized || isBlockedActiveContent(normalized, ext)) {
    return false;
  }
  return ALLOWED_BOOKING_MIMES.has(normalized);
}

export function validateMediaUploadMime(
  mimeType: string,
  purpose: MediaAssetPurpose,
  fileName?: string
): boolean {
  const normalized = normalizeMime(mimeType);
  const ext = getFileExtension(fileName);
  if (!normalized || isBlockedActiveContent(normalized, ext)) {
    return false;
  }
  const rule = MEDIA_PURPOSE_RULES[purpose];
  if (!rule || !rule.mimes.has(normalized)) {
    return false;
  }
  if (ext && !rule.extensions.has(ext)) {
    return false;
  }
  return true;
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
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) return false;
  if (!signature || typeof signature !== "string") return false;
  const expected = signStorageAccess(storageKey, expiresAtMs);
  const sigBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

function resolveContainedPath(root: string, relativeKey: string): string {
  const resolvedRoot = path.resolve(root);
  const targetPath = path.resolve(resolvedRoot, relativeKey);
  if (!targetPath.startsWith(resolvedRoot + path.sep)) {
    throw new Error("INVALID_STORAGE_PATH");
  }
  return targetPath;
}

function resolveStorageProvider(
  storageProvider?: string | null
): StorageProvider {
  if (storageProvider === "LOCAL") return "LOCAL";
  if (storageProvider === "R2") return "R2";
  if (storageProvider == null || storageProvider === "") {
    return hasR2Config() ? "R2" : "LOCAL";
  }
  throw new Error(`UNSUPPORTED_STORAGE_PROVIDER: ${storageProvider}`);
}

function cleanETag(rawEtag?: string): string | null {
  if (!rawEtag) return null;
  const cleaned = rawEtag.replace(/^"+|"+$/g, "").trim();
  return cleaned || null;
}

async function streamBodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    throw new Error("EMPTY_R2_OBJECT_BODY");
  }
  if (
    typeof (body as { transformToByteArray?: unknown }).transformToByteArray ===
    "function"
  ) {
    const bytes = await (
      body as { transformToByteArray(): Promise<Uint8Array> }
    ).transformToByteArray();
    return Buffer.from(bytes);
  }
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (Symbol.asyncIterator in (body as object)) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error("UNSUPPORTED_R2_BODY_STREAM");
}

async function putObjectR2(
  scopedKey: string,
  buffer: Buffer,
  contentType: string,
  cacheControl?: string
): Promise<StoredObjectResult> {
  const client = getR2Client();
  const res = await client.send(
    new PutObjectCommand({
      Bucket: env.r2BucketName,
      Key: scopedKey,
      Body: buffer,
      ContentType: contentType,
      ...(cacheControl ? { CacheControl: cacheControl } : {}),
    })
  );
  return {
    storageKey: scopedKey,
    storageProvider: "R2",
    bucket: env.r2BucketName,
    etag: cleanETag(res.ETag),
    sizeBytes: buffer.byteLength,
  };
}

async function writeLocalObject(
  root: string,
  scopedKey: string,
  buffer: Buffer
): Promise<StoredObjectResult> {
  const targetPath = resolveContainedPath(root, scopedKey);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, buffer);
  return {
    storageKey: scopedKey,
    storageProvider: "LOCAL",
    bucket: null,
    etag: null,
    sizeBytes: buffer.byteLength,
  };
}

export async function writePrivateFile(
  storageKey: string,
  buffer: Buffer,
  contentType = "application/octet-stream"
): Promise<StoredObjectResult> {
  const scopedKey = assertScopedStorageKey(storageKey);
  if (hasR2Config()) {
    return putObjectR2(scopedKey, buffer, contentType);
  }
  return writeLocalObject(UPLOADS_ROOT, scopedKey, buffer);
}

export async function readPrivateFile(
  storageKey: string,
  storageProvider?: string | null
): Promise<Buffer> {
  const provider = resolveStorageProvider(storageProvider);
  if (provider === "LOCAL") {
    const scopedKey = assertScopedStorageKey(storageKey, {
      allowLegacyLocal: true,
    });
    const targetPath = resolveContainedPath(UPLOADS_ROOT, scopedKey);
    return fs.readFile(targetPath);
  }

  const scopedKey = assertScopedStorageKey(storageKey);
  const client = getR2Client();
  const res = await client.send(
    new GetObjectCommand({
      Bucket: env.r2BucketName,
      Key: scopedKey,
    })
  );
  return streamBodyToBuffer(res.Body);
}

export async function writePublicMedia(
  storageKey: string,
  buffer: Buffer,
  contentType: string
): Promise<StoredObjectResult & { publicUrl: string | null }> {
  const scopedKey = assertScopedStorageKey(storageKey);
  if (hasR2Config()) {
    const stored = await putObjectR2(
      scopedKey,
      buffer,
      contentType,
      "public, max-age=31536000, immutable"
    );
    return {
      ...stored,
      publicUrl: buildPublicR2Url(scopedKey),
    };
  }

  const stored = await writeLocalObject(PUBLIC_LOCAL_ROOT, scopedKey, buffer);
  return {
    ...stored,
    publicUrl: null,
  };
}

export async function readPublicLocalMedia(storageKey: string): Promise<Buffer> {
  const scopedKey = assertScopedStorageKey(storageKey);
  const targetPath = resolveContainedPath(PUBLIC_LOCAL_ROOT, scopedKey);
  return fs.readFile(targetPath);
}

async function unlinkIfPresent(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
      throw err;
    }
  }
}

export async function deleteStoredObject(
  storageKey: string,
  storageProvider?: string | null
): Promise<void> {
  const provider = resolveStorageProvider(storageProvider);
  if (provider === "LOCAL") {
    const scopedKey = assertScopedStorageKey(storageKey, {
      allowLegacyLocal: true,
    });
    await unlinkIfPresent(resolveContainedPath(UPLOADS_ROOT, scopedKey));
    await unlinkIfPresent(resolveContainedPath(PUBLIC_LOCAL_ROOT, scopedKey));
    return;
  }

  const scopedKey = assertScopedStorageKey(storageKey);
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: env.r2BucketName,
      Key: scopedKey,
    })
  );
}

function clampPresignExpiry(expiresInSec: number): number {
  if (!Number.isFinite(expiresInSec)) return 300;
  return Math.max(1, Math.min(3600, Math.floor(expiresInSec)));
}

export async function createPresignedUploadUrl(
  storageKey: string,
  contentType: string,
  expiresInSec = 300
): Promise<string> {
  const scopedKey = assertScopedStorageKey(storageKey);
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: env.r2BucketName,
    Key: scopedKey,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, {
    expiresIn: clampPresignExpiry(expiresInSec),
  });
}

export async function createPresignedDownloadUrl(
  storageKey: string,
  expiresInSec = 300
): Promise<string> {
  const scopedKey = assertScopedStorageKey(storageKey);
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: env.r2BucketName,
    Key: scopedKey,
  });
  return getSignedUrl(client, command, {
    expiresIn: clampPresignExpiry(expiresInSec),
  });
}

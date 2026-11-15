/**
 * Pure TypeScript client-safe upload constants.
 * This file MUST NOT import any server modules, fs, AWS SDK, or secrets,
 * allowing safe usage in "use client" components as well as server runtimes.
 */

export const MAX_BROWSER_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB
export const MAX_BROWSER_UPLOAD_LABEL = "4 MB";

export const BOOKING_FILE_LOCKED_STATUSES = new Set([
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
  "REFUNDED",
]);

export const BOOKING_FILE_DELETE_WINDOW_MS = 24 * 60 * 60 * 1000;

const BLOCKED_ACTIVE_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".xhtml",
  ".svg",
  ".svgz",
  ".xml",
  ".xsl",
  ".xslt",
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

const AVATAR_MIME_BY_EXT: Record<string, string[]> = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
};

const PORTFOLIO_DOC_MIME_BY_EXT: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".txt": ["text/plain"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

const BOOKING_MIME_BY_EXT: Record<string, string[]> = {
  ".jpg": ["image/jpeg", "image/jpg"],
  ".jpeg": ["image/jpeg", "image/jpg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".avif": ["image/avif"],
  ".pdf": ["application/pdf"],
  ".txt": ["text/plain"],
  ".md": ["text/markdown", "text/x-markdown", "text/plain"],
  ".markdown": ["text/markdown", "text/x-markdown", "text/plain"],
  ".csv": ["text/csv", "application/csv", "text/plain"],
  ".rtf": ["application/rtf", "text/rtf"],
  ".doc": ["application/msword"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ".ppt": ["application/vnd.ms-powerpoint"],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  ".zip": ["application/zip", "application/x-zip-compressed"],
};

function getClientExtension(fileName: string): string {
  const base = String(fileName ?? "")
    .split(/[/\\]+/)
    .filter(Boolean)
    .pop()
    ?.trim() ?? "";
  if (!base || base.endsWith(".")) return "";
  const idx = base.lastIndexOf(".");
  if (idx <= 0 || idx >= base.length - 1) return "";
  return base.slice(idx).toLowerCase();
}

function normalizeClientMime(rawMime: string): string {
  return String(rawMime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

export function validateClientAvatarFile(file: File): string | null {
  if (file.size <= 0) {
    return "Selected image file cannot be empty.";
  }
  if (file.size > MAX_BROWSER_UPLOAD_BYTES) {
    return `Maximum file size is ${MAX_BROWSER_UPLOAD_LABEL}.`;
  }
  const ext = getClientExtension(file.name);
  const mime = normalizeClientMime(file.type);
  const allowedMimes = AVATAR_MIME_BY_EXT[ext];
  if (
    !allowedMimes ||
    BLOCKED_ACTIVE_EXTENSIONS.has(ext) ||
    BLOCKED_ACTIVE_MIMES.has(mime)
  ) {
    return "Please choose a JPG, PNG, or WEBP image (max 4 MB).";
  }
  if (mime && !allowedMimes.includes(mime)) {
    return "File extension does not match its image MIME type (JPG, PNG, or WEBP required).";
  }
  return null;
}

export function validateClientPortfolioFile(file: File): {
  error: string | null;
  purpose: "CREATOR_PORTFOLIO_IMAGE" | "CREATOR_PORTFOLIO_DOCUMENT" | null;
  inferredMimeType: string | null;
} {
  if (file.size <= 0) {
    return {
      error: "Selected file cannot be empty.",
      purpose: null,
      inferredMimeType: null,
    };
  }
  if (file.size > MAX_BROWSER_UPLOAD_BYTES) {
    return {
      error: `Maximum file size is ${MAX_BROWSER_UPLOAD_LABEL}.`,
      purpose: null,
      inferredMimeType: null,
    };
  }
  const ext = getClientExtension(file.name);
  const mime = normalizeClientMime(file.type);
  if (BLOCKED_ACTIVE_EXTENSIONS.has(ext) || BLOCKED_ACTIVE_MIMES.has(mime)) {
    return {
      error: "Active or executable file types are not permitted.",
      purpose: null,
      inferredMimeType: null,
    };
  }
  const imageMimes = AVATAR_MIME_BY_EXT[ext];
  if (imageMimes) {
    if (mime && !imageMimes.includes(mime)) {
      return {
        error: "Image extension does not match its MIME type.",
        purpose: null,
        inferredMimeType: null,
      };
    }
    return {
      error: null,
      purpose: "CREATOR_PORTFOLIO_IMAGE",
      inferredMimeType: mime || imageMimes[0],
    };
  }
  const docMimes = PORTFOLIO_DOC_MIME_BY_EXT[ext];
  if (docMimes) {
    if (mime && !docMimes.includes(mime)) {
      return {
        error: "Document extension does not match its MIME type.",
        purpose: null,
        inferredMimeType: null,
      };
    }
    return {
      error: null,
      purpose: "CREATOR_PORTFOLIO_DOCUMENT",
      inferredMimeType: mime || docMimes[0],
    };
  }
  return {
    error:
      "Allowed portfolio attachments: JPG, PNG, WEBP, PDF, DOCX, or TXT (max 4 MB).",
    purpose: null,
    inferredMimeType: null,
  };
}

export function validateClientBookingFile(file: File): string | null {
  if (file.size <= 0) {
    return "Selected file cannot be empty.";
  }
  if (file.size > MAX_BROWSER_UPLOAD_BYTES) {
    return `Maximum file size is ${MAX_BROWSER_UPLOAD_LABEL}.`;
  }
  const ext = getClientExtension(file.name);
  const mime = normalizeClientMime(file.type);
  if (
    !ext ||
    BLOCKED_ACTIVE_EXTENSIONS.has(ext) ||
    BLOCKED_ACTIVE_MIMES.has(mime)
  ) {
    return "This file type is blocked for security reasons. Upload PDF, Office docs, TXT/MD, CSV, ZIP, or raster images.";
  }
  const allowedMimes = BOOKING_MIME_BY_EXT[ext];
  if (!allowedMimes) {
    return "Unsupported file extension. Upload PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, MD, CSV, RTF, ZIP, or JPG/PNG/WEBP/AVIF (max 4 MB).";
  }
  if (
    mime &&
    mime !== "application/octet-stream" &&
    !allowedMimes.includes(mime)
  ) {
    return "File extension does not match the detected file content type.";
  }
  return null;
}

export function canDeleteBookingFile(
  file: {
    uploaderId?: string | null;
    fileCategory: string;
    createdAt: string | Date;
    revisionId?: string | null;
    disputeId?: string | null;
  },
  bookingStatus: string,
  currentUser: { id: string; roles: string[] } | null | undefined
): boolean {
  if (!currentUser) return false;
  if (currentUser.roles.includes("ADMIN")) return true;
  if (!file.uploaderId || file.uploaderId !== currentUser.id) return false;
  if (BOOKING_FILE_LOCKED_STATUSES.has(bookingStatus)) return false;
  if (
    file.fileCategory === "CREATOR_DELIVERABLE" &&
    bookingStatus === "DELIVERED"
  ) {
    return false;
  }
  if (file.revisionId || file.disputeId) return false;
  const createdMs = new Date(file.createdAt).getTime();
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs <= BOOKING_FILE_DELETE_WINDOW_MS;
}

const SAFE_RASTER_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const SAFE_RASTER_IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp|avif)$/i;

const ALLOWED_NEXT_IMAGE_EXACT_HOSTS = new Set([
  "lh3.googleusercontent.com",
  "images.unsplash.com",
  "pub-cc07856d657b4a7197710051042b3eda.r2.dev",
]);

function getConfiguredPublicR2Hostname(): string | null {
  const raw = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").trim();
  if (!raw) return null;
  try {
    const normalized =
      raw.startsWith("https://") || raw.startsWith("http://")
        ? raw
        : `https://${raw}`;
    const parsed = new URL(normalized);
    return parsed.hostname ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function isSafeRasterImageMimeOrExt(
  mimeType?: string | null,
  urlOrName?: string | null
): boolean {
  const normalizedMime = normalizeClientMime(mimeType ?? "");
  if (normalizedMime) {
    return SAFE_RASTER_IMAGE_MIMES.has(normalizedMime);
  }
  const candidate = String(urlOrName ?? "").trim();
  if (!candidate) return false;
  let pathname = candidate;
  try {
    if (candidate.startsWith("https://") || candidate.startsWith("http://")) {
      pathname = new URL(candidate).pathname;
    } else {
      pathname = candidate.split(/[?#]/)[0] ?? "";
    }
  } catch {
    pathname = candidate.split(/[?#]/)[0] ?? "";
  }
  return SAFE_RASTER_IMAGE_EXT_RE.test(pathname);
}

export function isAllowedNextImageSrc(url?: string | null): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (
    !trimmed ||
    /[\x00-\x1f\x7f\s\\]/.test(trimmed) ||
    trimmed.includes("..")
  ) {
    return false;
  }
  if (trimmed.startsWith("//")) return false;
  if (trimmed.startsWith("/api/media/")) {
    return true;
  }
  if (trimmed.startsWith("/images/")) {
    return !/[?#]/.test(trimmed);
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (!host) return false;
    if (ALLOWED_NEXT_IMAGE_EXACT_HOSTS.has(host)) return true;
    const configuredHost = getConfiguredPublicR2Hostname();
    if (configuredHost && host === configuredHost) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isSafeMediaDisplayUrl(url?: string | null): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (
    !trimmed ||
    /[\x00-\x1f\x7f\s\\]/.test(trimmed) ||
    trimmed.includes("..")
  ) {
    return false;
  }
  if (trimmed.startsWith("/api/media/")) {
    return !trimmed.startsWith("//");
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export type BookingUploadCategory =
  | "CUSTOMER_BRIEF"
  | "CREATOR_DELIVERABLE"
  | "REVISION_ATTACHMENT"
  | "DISPUTE_EVIDENCE";

export interface UploadedBookingFileMeta {
  id: string;
  fileName: string;
  sizeBytes: number;
  fileCategory: string;
}

export async function uploadBookingFile(
  bookingRef: string,
  file: File,
  fileCategory: BookingUploadCategory
): Promise<UploadedBookingFileMeta> {
  const validationError = validateClientBookingFile(file);
  if (validationError) {
    throw new Error(validationError);
  }
  const fd = new FormData();
  fd.append("file", file);
  fd.append("fileCategory", fileCategory);
  const res = await fetch(
    `/api/bookings/${encodeURIComponent(bookingRef)}/files/presign`,
    {
      method: "POST",
      body: fd,
    }
  );
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      j?.error?.message || `File upload failed (${res.status}).`
    );
  }
  const uploaded = j?.data?.file;
  if (!uploaded?.id) {
    throw new Error("Server returned an invalid file upload response.");
  }
  return {
    id: uploaded.id,
    fileName: uploaded.fileName || file.name,
    sizeBytes: uploaded.sizeBytes ?? file.size,
    fileCategory: uploaded.fileCategory || fileCategory,
  };
}

export async function deleteBookingFileById(fileId: string): Promise<void> {
  const res = await fetch(`/api/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      j?.error?.message || `Could not delete file (${res.status}).`
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readPrivateFile, readPublicLocalMedia } from "@/lib/storage";
import { fail, handleApiError } from "@/lib/http";

const SAFE_INLINE_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
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

function resolveSafeMediaMimeType(rawMime: string): {
  contentType: string;
  inline: boolean;
} {
  const cleaned = String(rawMime ?? "").replace(/[\r\n\0]/g, "").trim();
  if (!cleaned || !/^[\x20-\x7e]+$/.test(cleaned)) {
    return { contentType: "application/octet-stream", inline: false };
  }
  const baseMime = cleaned.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!baseMime || BLOCKED_ACTIVE_MIMES.has(baseMime)) {
    return { contentType: "application/octet-stream", inline: false };
  }
  if (SAFE_INLINE_IMAGE_MIMES.has(baseMime)) {
    return { contentType: baseMime, inline: true };
  }
  return { contentType: cleaned, inline: false };
}

function buildSafeMediaDisposition(
  rawFileName: string,
  inline: boolean
): string {
  const cleanedUtf8 =
    String(rawFileName ?? "")
      .replace(/[\x00-\x1f\x7f-\x9f/\\]/g, "")
      .trim() || "attachment.bin";
  const asciiSafe =
    cleanedUtf8
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\;]/g, "_")
      .trim() || "attachment.bin";
  const rfc5987 = encodeURIComponent(cleanedUtf8).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  const dispositionType = inline ? "inline" : "attachment";
  return `${dispositionType}; filename="${asciiSafe}"; filename*=UTF-8''${rfc5987}`;
}

function isMissingStorageObjectError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const candidate = err as {
    code?: string;
    Code?: string;
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.code === "ENOENT" ||
    candidate.name === "NoSuchKey" ||
    candidate.Code === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const asset = await db.mediaAsset.findUnique({
      where: { id },
    });

    if (!asset) {
      return fail("MEDIA_NOT_FOUND", "Media asset not found.", 404);
    }

    if (
      asset.storageProvider === "R2" &&
      asset.publicUrl &&
      /^https?:\/\//i.test(asset.publicUrl)
    ) {
      return NextResponse.redirect(asset.publicUrl, 307);
    }

    let data: Buffer;
    try {
      data =
        asset.storageProvider === "LOCAL"
          ? await readPublicLocalMedia(asset.storageKey)
          : await readPrivateFile(asset.storageKey, asset.storageProvider);
    } catch (err) {
      if (isMissingStorageObjectError(err)) {
        return fail("MEDIA_NOT_FOUND", "Media object not found.", 404);
      }
      throw err;
    }

    const { contentType, inline } = resolveSafeMediaMimeType(asset.mimeType);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": buildSafeMediaDisposition(asset.fileName, inline),
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

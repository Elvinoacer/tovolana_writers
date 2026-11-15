import { NextRequest } from "next/server";
import { MediaAssetPurpose } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedUser } from "@/lib/auth";
import {
  MAX_BROWSER_UPLOAD_BYTES,
  createMediaStorageKey,
  deleteStoredObject,
  validateMediaUploadMime,
  writePublicMedia,
  type MediaStorageFolder,
} from "@/lib/storage";
import { fail, handleApiError, ok } from "@/lib/http";

const MAX_MEDIA_BODY_BYTES = MAX_BROWSER_UPLOAD_BYTES + 2 * 1024 * 1024;

const mediaPurposeSchema = z.nativeEnum(MediaAssetPurpose);

const jsonUploadSchema = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120),
  purpose: mediaPurposeSchema.default(MediaAssetPurpose.GENERAL),
  contentBase64: z.string(),
});

const PURPOSE_TO_FOLDER: Record<MediaAssetPurpose, MediaStorageFolder> = {
  [MediaAssetPurpose.USER_AVATAR]: "avatars",
  [MediaAssetPurpose.CREATOR_PORTFOLIO_IMAGE]: "portfolios",
  [MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT]: "portfolios",
  [MediaAssetPurpose.EDITORIAL_ASSET]: "editorial",
  [MediaAssetPurpose.GENERAL]: "general",
};

function estimateBase64DecodedBytes(rawBase64: string): number {
  if (rawBase64.length > MAX_BROWSER_UPLOAD_BYTES * 2) {
    return MAX_BROWSER_UPLOAD_BYTES + 1;
  }
  const cleaned = rawBase64.replace(/\s+/g, "");
  const padding = cleaned.endsWith("==")
    ? 2
    : cleaned.endsWith("=")
      ? 1
      : 0;
  return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);
}

function sanitizeDisplayFileName(rawFileName: string): string {
  const base = rawFileName
    .replace(/[\x00-\x1f\x7f]/g, "")
    .split(/[/\\]+/)
    .filter(Boolean)
    .pop()
    ?.trim();
  return base && base.length > 0 ? base.slice(0, 200) : "attachment.bin";
}

function isPermittedMediaUpload(
  rawMimeType: string,
  purpose: MediaAssetPurpose,
  rawFileName: string
): boolean {
  return (
    /^[\x20-\x7e]+$/.test(rawMimeType) &&
    validateMediaUploadMime(rawMimeType, purpose, rawFileName)
  );
}

function normalizeMimeType(rawMimeType: string): string {
  return (
    rawMimeType.split(";")[0]?.trim().toLowerCase() ||
    "application/octet-stream"
  );
}

function fileTooLargeError() {
  return fail("FILE_TOO_LARGE", "Maximum file size is 4MB.", 400);
}

function unsupportedFileTypeError() {
  return fail(
    "UNSUPPORTED_FILE_TYPE",
    "This file type or extension is not permitted for this media purpose.",
    400
  );
}

function authorizeMediaPurpose(
  user: AuthenticatedUser,
  purpose: MediaAssetPurpose
) {
  if (
    purpose === MediaAssetPurpose.EDITORIAL_ASSET &&
    !user.roles.includes("ADMIN")
  ) {
    return fail(
      "FORBIDDEN",
      "Only administrators can upload editorial assets.",
      403
    );
  }

  if (
    (purpose === MediaAssetPurpose.CREATOR_PORTFOLIO_IMAGE ||
      purpose === MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT) &&
    !user.roles.includes("CREATOR") &&
    !user.roles.includes("ADMIN")
  ) {
    return fail(
      "FORBIDDEN",
      "Only approved creators or administrators can upload portfolio media.",
      403
    );
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (
        Number.isFinite(contentLength) &&
        contentLength > MAX_MEDIA_BODY_BYTES
      ) {
        return fileTooLargeError();
      }
    }

    const contentType = request.headers.get("content-type") || "";
    let rawFileName: string;
    let rawMimeType: string;
    let purpose: MediaAssetPurpose;
    let buffer: Buffer;

    if (contentType.toLowerCase().includes("multipart/form-data")) {
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return fail("BAD_REQUEST", "Malformed multipart/form-data request.", 400);
      }

      const file = form.get("file");
      const rawPurpose = form.get("purpose");

      if (!(file instanceof File)) {
        return fail("MISSING_FILE", "Multipart form file is required.", 400);
      }
      if (file.size > MAX_BROWSER_UPLOAD_BYTES) {
        return fileTooLargeError();
      }
      if (rawPurpose !== null && typeof rawPurpose !== "string") {
        return fail("VALIDATION_ERROR", "Invalid purpose field.", 400);
      }

      purpose =
        typeof rawPurpose === "string" && rawPurpose.trim().length > 0
          ? mediaPurposeSchema.parse(rawPurpose.trim())
          : MediaAssetPurpose.GENERAL;

      const authError = authorizeMediaPurpose(user, purpose);
      if (authError) return authError;

      rawFileName = file.name;
      rawMimeType = (file.type || "application/octet-stream").trim();

      if (!isPermittedMediaUpload(rawMimeType, purpose, rawFileName)) {
        return unsupportedFileTypeError();
      }

      buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.byteLength > MAX_BROWSER_UPLOAD_BYTES) {
        return fileTooLargeError();
      }
      if (buffer.byteLength === 0) {
        return fail("VALIDATION_ERROR", "Uploaded file cannot be empty.", 400);
      }
    } else {
      let rawJson: unknown;
      try {
        rawJson = await request.json();
      } catch {
        return fail("BAD_REQUEST", "Malformed JSON request body.", 400);
      }

      const body = jsonUploadSchema.parse(rawJson);
      purpose = body.purpose;

      const authError = authorizeMediaPurpose(user, purpose);
      if (authError) return authError;

      rawFileName = body.fileName;
      rawMimeType = body.mimeType.trim();

      if (!isPermittedMediaUpload(rawMimeType, purpose, rawFileName)) {
        return unsupportedFileTypeError();
      }

      const cleanedBase64 = body.contentBase64.replace(/\s+/g, "");
      if (
        cleanedBase64.length === 0 ||
        cleanedBase64.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(cleanedBase64)
      ) {
        return fail(
          "VALIDATION_ERROR",
          "contentBase64 must be valid non-empty base64.",
          400
        );
      }
      if (
        estimateBase64DecodedBytes(body.contentBase64) > MAX_BROWSER_UPLOAD_BYTES
      ) {
        return fileTooLargeError();
      }

      buffer = Buffer.from(cleanedBase64, "base64");
      if (buffer.byteLength > MAX_BROWSER_UPLOAD_BYTES) {
        return fileTooLargeError();
      }
      if (buffer.byteLength === 0) {
        return fail(
          "VALIDATION_ERROR",
          "contentBase64 cannot decode to empty bytes.",
          400
        );
      }
    }

    const mimeType = normalizeMimeType(rawMimeType);
    const folder = PURPOSE_TO_FOLDER[purpose];
    const storageKey = createMediaStorageKey(folder, user.id, rawFileName);
    const stored = await writePublicMedia(storageKey, buffer, mimeType);

    let priorAvatars: Array<{
      id: string;
      storageKey: string;
      storageProvider: string;
    }> = [];
    let asset;

    try {
      asset = await db.$transaction(async (tx) => {
        priorAvatars =
          purpose === MediaAssetPurpose.USER_AVATAR
            ? await tx.mediaAsset.findMany({
                where: {
                  ownerId: user.id,
                  purpose: MediaAssetPurpose.USER_AVATAR,
                },
                select: { id: true, storageKey: true, storageProvider: true },
              })
            : [];

        const created = await tx.mediaAsset.create({
          data: {
            ownerId: user.id,
            purpose,
            fileName: sanitizeDisplayFileName(rawFileName),
            mimeType,
            sizeBytes: stored.sizeBytes,
            storageProvider: stored.storageProvider,
            bucket: stored.bucket,
            storageKey: stored.storageKey,
            publicUrl: stored.publicUrl,
            etag: stored.etag,
          },
        });

        const finalAsset =
          created.publicUrl && created.publicUrl.trim().length > 0
            ? created
            : await tx.mediaAsset.update({
                where: { id: created.id },
                data: { publicUrl: `/api/media/${created.id}/raw` },
              });

        if (purpose === MediaAssetPurpose.USER_AVATAR) {
          await tx.user.update({
            where: { id: user.id },
            data: { avatarUrl: finalAsset.publicUrl },
          });

          if (priorAvatars.length > 0) {
            await tx.mediaAsset.deleteMany({
              where: { id: { in: priorAvatars.map((item) => item.id) } },
            });
          }
        }

        return finalAsset;
      });
    } catch (dbErr) {
      await deleteStoredObject(stored.storageKey, stored.storageProvider).catch(
        () => undefined
      );
      throw dbErr;
    }

    if (priorAvatars.length > 0) {
      await Promise.all(
        priorAvatars.map((prev) =>
          deleteStoredObject(prev.storageKey, prev.storageProvider).catch(
            () => undefined
          )
        )
      );
    }

    return ok({ asset, publicUrl: asset.publicUrl }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

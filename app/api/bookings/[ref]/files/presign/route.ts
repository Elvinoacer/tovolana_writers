import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  MAX_BROWSER_UPLOAD_BYTES,
  createStorageKey,
  deleteStoredObject,
  signStorageAccess,
  validateBookingUploadMime,
  writePrivateFile,
} from "@/lib/storage";
import { fail, handleApiError, ok } from "@/lib/http";

const fileCategorySchema = z.enum([
  "CUSTOMER_BRIEF",
  "CREATOR_DELIVERABLE",
  "REVISION_ATTACHMENT",
  "DISPUTE_EVIDENCE",
]);

const fileUploadSchema = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120).default("text/plain"),
  fileCategory: fileCategorySchema.default("CUSTOMER_BRIEF"),
  contentBase64: z.string().optional(),
  contentText: z.string().optional(),
  revisionId: z.string().min(1).optional(),
  disputeId: z.string().min(1).optional(),
});

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

function isPermittedBookingUpload(mimeType: string, rawFileName: string): boolean {
  return (
    !/[\x00-\x1f\x7f]/.test(mimeType) &&
    validateBookingUploadMime(mimeType, rawFileName)
  );
}

function fileTooLargeError() {
  return fail("FILE_TOO_LARGE", "Maximum file size is 4MB.", 400);
}

function unsupportedFileTypeError() {
  return fail(
    "UNSUPPORTED_FILE_TYPE",
    "This file type or extension is not permitted for booking uploads.",
    400
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ref: string }> }
) {
  try {
    const { ref } = await context.params;
    const user = await requireAuth(request);

    const booking = await db.booking.findFirst({
      where: { OR: [{ bookingRef: ref }, { id: ref }] },
    });
    if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);

    const allowed =
      booking.customerId === user.id ||
      booking.creatorId === user.creatorProfile?.id ||
      user.roles.includes("ADMIN");
    if (!allowed) {
      return fail(
        "FORBIDDEN",
        "You are not a participant in this booking.",
        403
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let rawFileName = "attachment.txt";
    let mimeType = "text/plain";
    let fileCategory: z.infer<typeof fileCategorySchema> = "CUSTOMER_BRIEF";
    let revisionId: string | undefined;
    let disputeId: string | undefined;
    let buffer: Buffer;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const cat = form.get("fileCategory");
      const rawRevisionId = form.get("revisionId");
      const rawDisputeId = form.get("disputeId");

      if (!(file instanceof File)) {
        return fail("MISSING_FILE", "Multipart form file is required.", 400);
      }
      if (file.size > MAX_BROWSER_UPLOAD_BYTES) {
        return fileTooLargeError();
      }

      rawFileName = file.name;
      mimeType = (file.type || "application/octet-stream").trim();
      if (typeof cat === "string") {
        if (cat.trim().length > 0) {
          fileCategory = fileCategorySchema.parse(cat.trim());
        }
      } else if (cat !== null) {
        return fail("VALIDATION_ERROR", "Invalid fileCategory field.", 400);
      }

      if (typeof rawRevisionId === "string" && rawRevisionId.trim().length > 0) {
        revisionId = rawRevisionId.trim();
      }
      if (typeof rawDisputeId === "string" && rawDisputeId.trim().length > 0) {
        disputeId = rawDisputeId.trim();
      }

      if (!isPermittedBookingUpload(mimeType, rawFileName)) {
        return unsupportedFileTypeError();
      }

      buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.byteLength > MAX_BROWSER_UPLOAD_BYTES) {
        return fileTooLargeError();
      }
    } else {
      const body = fileUploadSchema.parse(await request.json());
      rawFileName = body.fileName;
      mimeType = body.mimeType.trim();
      fileCategory = body.fileCategory;
      revisionId = body.revisionId;
      disputeId = body.disputeId;

      if (!isPermittedBookingUpload(mimeType, rawFileName)) {
        return unsupportedFileTypeError();
      }

      if (body.contentBase64) {
        if (
          estimateBase64DecodedBytes(body.contentBase64) >
          MAX_BROWSER_UPLOAD_BYTES
        ) {
          return fileTooLargeError();
        }
        buffer = Buffer.from(
          body.contentBase64.replace(/\s+/g, ""),
          "base64"
        );
        if (buffer.byteLength > MAX_BROWSER_UPLOAD_BYTES) {
          return fileTooLargeError();
        }
      } else {
        const text =
          body.contentText ??
          `Uploaded file placeholder for ${sanitizeDisplayFileName(rawFileName)} on booking ${booking.bookingRef}`;
        if (
          text.length > MAX_BROWSER_UPLOAD_BYTES ||
          Buffer.byteLength(text, "utf8") > MAX_BROWSER_UPLOAD_BYTES
        ) {
          return fileTooLargeError();
        }
        buffer = Buffer.from(text, "utf8");
      }
    }

    if (revisionId) {
      const revision = await db.bookingRevision.findUnique({
        where: { id: revisionId },
        select: { id: true, bookingId: true },
      });
      if (!revision || revision.bookingId !== booking.id) {
        return fail(
          "INVALID_REVISION_REFERENCE",
          "Referenced revision does not belong to this booking.",
          400
        );
      }
    }

    if (disputeId) {
      const dispute = await db.dispute.findUnique({
        where: { id: disputeId },
        select: { id: true, bookingId: true },
      });
      if (!dispute || dispute.bookingId !== booking.id) {
        return fail(
          "INVALID_DISPUTE_REFERENCE",
          "Referenced dispute does not belong to this booking.",
          400
        );
      }
    }

    const storageKey = createStorageKey(booking.id, rawFileName);
    const stored = await writePrivateFile(storageKey, buffer, mimeType);

    let fileRecord;
    try {
      fileRecord = await db.bookingFile.create({
        data: {
          bookingId: booking.id,
          uploaderId: user.id,
          fileCategory,
          fileName: sanitizeDisplayFileName(rawFileName),
          mimeType,
          sizeBytes: stored.sizeBytes,
          storageKey: stored.storageKey,
          storageProvider: stored.storageProvider,
          bucket: stored.bucket,
          etag: stored.etag,
          revisionId: revisionId ?? null,
          disputeId: disputeId ?? null,
        },
      });
    } catch (dbErr) {
      await deleteStoredObject(stored.storageKey, stored.storageProvider).catch(
        () => undefined
      );
      throw dbErr;
    }

    const exp = Date.now() + 15 * 60 * 1000;
    const sig = signStorageAccess(stored.storageKey, exp);
    const downloadUrl = `/api/files/${fileRecord.id}?exp=${exp}&sig=${sig}`;

    return ok({ file: fileRecord, downloadUrl }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

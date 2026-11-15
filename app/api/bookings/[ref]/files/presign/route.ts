import { NextRequest } from "next/server";
import type { BookingStatus } from "@prisma/client";
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

const TERMINAL_UPLOAD_LOCKED_STATUSES = new Set<BookingStatus>([
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
]);

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

const MAX_PRESIGN_BODY_BYTES = MAX_BROWSER_UPLOAD_BYTES + 2 * 1024 * 1024;

function isPermittedBookingUpload(rawMimeType: string, rawFileName: string): boolean {
  return (
    /^[\x20-\x7e]+$/.test(rawMimeType) &&
    validateBookingUploadMime(rawMimeType, rawFileName)
  );
}

function normalizeMimeType(rawMimeType: string): string {
  return rawMimeType.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
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

function authorizeBookingFileUpload(params: {
  bookingStatus: BookingStatus;
  fileCategory: z.infer<typeof fileCategorySchema>;
  isAdmin: boolean;
  isCustomer: boolean;
  isCreator: boolean;
}) {
  if (params.isAdmin) return null;

  if (TERMINAL_UPLOAD_LOCKED_STATUSES.has(params.bookingStatus)) {
    return fail(
      "FILE_LOCKED_BY_BOOKING_STATUS",
      `Files cannot be uploaded because this booking is ${params.bookingStatus}.`,
      409
    );
  }

  if (
    params.bookingStatus === "DISPUTED" &&
    params.fileCategory !== "DISPUTE_EVIDENCE"
  ) {
    return fail(
      "FILE_LOCKED_BY_BOOKING_STATUS",
      "Only dispute evidence files can be uploaded while a booking is DISPUTED.",
      409
    );
  }

  switch (params.fileCategory) {
    case "CREATOR_DELIVERABLE":
      if (!params.isCreator) {
        return fail(
          "FORBIDDEN",
          "Only the assigned creator can upload deliverable files.",
          403
        );
      }
      break;
    case "CUSTOMER_BRIEF":
    case "REVISION_ATTACHMENT":
      if (!params.isCustomer) {
        return fail(
          "FORBIDDEN",
          `Only the booking customer can upload ${
            params.fileCategory === "CUSTOMER_BRIEF"
              ? "brief"
              : "revision attachment"
          } files.`,
          403
        );
      }
      break;
    case "DISPUTE_EVIDENCE":
      if (!params.isCustomer && !params.isCreator) {
        return fail(
          "FORBIDDEN",
          "Only booking participants can upload dispute evidence.",
          403
        );
      }
      break;
  }

  return null;
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

    const isCustomer = booking.customerId === user.id;
    const isCreator = Boolean(
      booking.creatorId &&
        user.creatorProfile?.id &&
        booking.creatorId === user.creatorProfile.id
    );
    const isAdmin = user.roles.includes("ADMIN");
    if (!isCustomer && !isCreator && !isAdmin) {
      return fail(
        "FORBIDDEN",
        "You are not a participant in this booking.",
        403
      );
    }

    if (!isAdmin && TERMINAL_UPLOAD_LOCKED_STATUSES.has(booking.status)) {
      return fail(
        "FILE_LOCKED_BY_BOOKING_STATUS",
        `Files cannot be uploaded because this booking is ${booking.status}.`,
        409
      );
    }

    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (Number.isFinite(contentLength) && contentLength > MAX_PRESIGN_BODY_BYTES) {
        return fileTooLargeError();
      }
    }

    const contentType = request.headers.get("content-type") || "";
    let rawFileName = "attachment.txt";
    let rawMimeType = "text/plain";
    let fileCategory: z.infer<typeof fileCategorySchema> = "CUSTOMER_BRIEF";
    let revisionId: string | undefined;
    let disputeId: string | undefined;
    let buffer: Buffer;

    if (contentType.toLowerCase().includes("multipart/form-data")) {
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return fail("BAD_REQUEST", "Malformed multipart/form-data request.", 400);
      }

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
      if (rawRevisionId !== null && typeof rawRevisionId !== "string") {
        return fail("VALIDATION_ERROR", "Invalid revisionId field.", 400);
      }
      if (rawDisputeId !== null && typeof rawDisputeId !== "string") {
        return fail("VALIDATION_ERROR", "Invalid disputeId field.", 400);
      }

      rawFileName = file.name;
      rawMimeType = (file.type || "application/octet-stream").trim();
      if (typeof cat === "string") {
        if (cat.trim().length > 0) {
          fileCategory = fileCategorySchema.parse(cat.trim());
        }
      } else if (cat !== null) {
        return fail("VALIDATION_ERROR", "Invalid fileCategory field.", 400);
      }

      const uploadAuthError = authorizeBookingFileUpload({
        bookingStatus: booking.status,
        fileCategory,
        isAdmin,
        isCustomer,
        isCreator,
      });
      if (uploadAuthError) return uploadAuthError;

      if (typeof rawRevisionId === "string" && rawRevisionId.trim().length > 0) {
        revisionId = rawRevisionId.trim();
      }
      if (typeof rawDisputeId === "string" && rawDisputeId.trim().length > 0) {
        disputeId = rawDisputeId.trim();
      }

      if (!isPermittedBookingUpload(rawMimeType, rawFileName)) {
        return unsupportedFileTypeError();
      }

      buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.byteLength > MAX_BROWSER_UPLOAD_BYTES) {
        return fileTooLargeError();
      }
    } else {
      let rawJson: unknown;
      try {
        rawJson = await request.json();
      } catch {
        return fail("BAD_REQUEST", "Malformed JSON request body.", 400);
      }

      const body = fileUploadSchema.parse(rawJson);
      rawFileName = body.fileName;
      rawMimeType = body.mimeType.trim();
      fileCategory = body.fileCategory;
      revisionId = body.revisionId;
      disputeId = body.disputeId;

      const uploadAuthError = authorizeBookingFileUpload({
        bookingStatus: booking.status,
        fileCategory,
        isAdmin,
        isCustomer,
        isCreator,
      });
      if (uploadAuthError) return uploadAuthError;

      if (!isPermittedBookingUpload(rawMimeType, rawFileName)) {
        return unsupportedFileTypeError();
      }

      if (body.contentBase64 !== undefined) {
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
          estimateBase64DecodedBytes(cleanedBase64) > MAX_BROWSER_UPLOAD_BYTES
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

    if (revisionId && disputeId) {
      return fail(
        "VALIDATION_ERROR",
        "A file cannot reference both revisionId and disputeId.",
        400
      );
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

    const mimeType = normalizeMimeType(rawMimeType);
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

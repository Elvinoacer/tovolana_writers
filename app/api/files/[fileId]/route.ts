import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import {
  deleteStoredObject,
  readPrivateFile,
  verifyStorageAccess,
} from "@/lib/storage";
import { fail, handleApiError, ok } from "@/lib/http";

const LOCKED_BOOKING_STATUSES = new Set([
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
  "REFUNDED",
]);

const DELETE_WINDOW_MS = 24 * 60 * 60 * 1000;

const BLOCKED_INLINE_MIMES = new Set([
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

function buildSafeContentDisposition(rawFileName: string): string {
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
  return `attachment; filename="${asciiSafe}"; filename*=UTF-8''${rfc5987}`;
}

function resolveSafeDownloadMimeType(rawMime: string): string {
  const cleaned = String(rawMime ?? "").replace(/[\r\n\0]/g, "").trim();
  if (!cleaned || !/^[\x20-\x7e]+$/.test(cleaned)) {
    return "application/octet-stream";
  }
  const baseMime = cleaned.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!baseMime || BLOCKED_INLINE_MIMES.has(baseMime)) {
    return "application/octet-stream";
  }
  return cleaned;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await context.params;
    const fileRecord = await db.bookingFile.findUnique({
      where: { id: fileId },
      include: { booking: true },
    });

    if (!fileRecord) {
      return fail("FILE_NOT_FOUND", "File not found.", 404);
    }

    const expParam = request.nextUrl.searchParams.get("exp");
    const sigParam = request.nextUrl.searchParams.get("sig");
    const hasValidSignedToken =
      Boolean(expParam && sigParam) &&
      verifyStorageAccess(
        fileRecord.storageKey,
        Number(expParam),
        sigParam!
      );

    // Always enforce RBAC unless caller holds a valid short-lived signature AND is authenticated (or signed token)
    const user = await getCurrentUser(request);
    if (!user && !hasValidSignedToken) {
      return fail("UNAUTHORIZED", "Authentication required.", 401);
    }

    if (user) {
      const allowed =
        fileRecord.booking.customerId === user.id ||
        fileRecord.booking.creatorId === user.creatorProfile?.id ||
        user.roles.includes("ADMIN");
      if (!allowed) {
        return fail(
          "FORBIDDEN",
          "You do not have permission to access this private file.",
          403
        );
      }
    }

    const data = await readPrivateFile(
      fileRecord.storageKey,
      fileRecord.storageProvider
    );
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": resolveSafeDownloadMimeType(fileRecord.mimeType),
        "Content-Disposition": buildSafeContentDisposition(fileRecord.fileName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { fileId } = await context.params;

    const fileRecord = await db.bookingFile.findUnique({
      where: { id: fileId },
      include: { booking: true },
    });

    if (!fileRecord) {
      return fail("FILE_NOT_FOUND", "File not found.", 404);
    }

    const isAdmin = user.roles.includes("ADMIN");
    if (!isAdmin && fileRecord.uploaderId !== user.id) {
      return fail(
        "FORBIDDEN",
        "Only the original uploader or an administrator can delete this file.",
        403
      );
    }

    if (!isAdmin) {
      const isLockedStatus = LOCKED_BOOKING_STATUSES.has(
        fileRecord.booking.status
      );
      const isDeliveredDeliverable =
        fileRecord.fileCategory === "CREATOR_DELIVERABLE" &&
        fileRecord.booking.status === "DELIVERED";
      const isLinkedEvidence = Boolean(
        fileRecord.revisionId || fileRecord.disputeId
      );
      const isWindowExpired =
        Date.now() - fileRecord.createdAt.getTime() > DELETE_WINDOW_MS;

      if (
        isLockedStatus ||
        isDeliveredDeliverable ||
        isLinkedEvidence ||
        isWindowExpired
      ) {
        return fail(
          "FILE_LOCKED_BY_BOOKING_STATUS",
          "This file is locked by the current booking lifecycle, linked evidence record, or retention window and can no longer be deleted.",
          409
        );
      }
    }

    await deleteStoredObject(fileRecord.storageKey, fileRecord.storageProvider);
    try {
      await db.bookingFile.delete({ where: { id: fileRecord.id } });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return fail("FILE_NOT_FOUND", "File not found.", 404);
      }
      throw err;
    }

    return ok({ deletedId: fileRecord.id });
  } catch (err) {
    return handleApiError(err);
  }
}

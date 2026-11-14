import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  createStorageKey,
  signStorageAccess,
  writePrivateFile,
} from "@/lib/storage";
import { fail, handleApiError, ok } from "@/lib/http";

const fileUploadSchema = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120).default("text/plain"),
  fileCategory: z
    .enum([
      "CUSTOMER_BRIEF",
      "CREATOR_DELIVERABLE",
      "REVISION_ATTACHMENT",
      "DISPUTE_EVIDENCE",
    ])
    .default("CUSTOMER_BRIEF"),
  contentBase64: z.string().optional(),
  contentText: z.string().optional(),
});

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
    let fileName = "attachment.txt";
    let mimeType = "text/plain";
    let fileCategory:
      | "CUSTOMER_BRIEF"
      | "CREATOR_DELIVERABLE"
      | "REVISION_ATTACHMENT"
      | "DISPUTE_EVIDENCE" = "CUSTOMER_BRIEF";
    let buffer: Buffer;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const cat = form.get("fileCategory");
      if (!(file instanceof File)) {
        return fail("MISSING_FILE", "Multipart form file is required.", 400);
      }
      if (file.size > 15 * 1024 * 1024) {
        return fail("FILE_TOO_LARGE", "Maximum file size is 15MB.", 400);
      }
      fileName = file.name;
      mimeType = file.type || "application/octet-stream";
      if (
        cat === "CUSTOMER_BRIEF" ||
        cat === "CREATOR_DELIVERABLE" ||
        cat === "REVISION_ATTACHMENT" ||
        cat === "DISPUTE_EVIDENCE"
      ) {
        fileCategory = cat;
      }
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = fileUploadSchema.parse(await request.json());
      fileName = body.fileName;
      mimeType = body.mimeType;
      fileCategory = body.fileCategory;
      if (body.contentBase64) {
        buffer = Buffer.from(body.contentBase64, "base64");
      } else {
        buffer = Buffer.from(
          body.contentText ??
            `Uploaded file placeholder for ${fileName} on booking ${booking.bookingRef}`,
          "utf8"
        );
      }
    }

    const storageKey = createStorageKey(booking.id, fileName);
    await writePrivateFile(storageKey, buffer);

    const fileRecord = await db.bookingFile.create({
      data: {
        bookingId: booking.id,
        uploaderId: user.id,
        fileCategory,
        fileName,
        mimeType,
        sizeBytes: buffer.byteLength,
        storageKey,
      },
    });

    const exp = Date.now() + 15 * 60 * 1000;
    const sig = signStorageAccess(storageKey, exp);
    const downloadUrl = `/api/files/${fileRecord.id}?exp=${exp}&sig=${sig}`;

    return ok({ file: fileRecord, downloadUrl }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

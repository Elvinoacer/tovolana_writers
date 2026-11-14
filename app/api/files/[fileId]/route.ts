import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readPrivateFile, verifyStorageAccess } from "@/lib/storage";
import { fail, handleApiError } from "@/lib/http";

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

    const data = await readPrivateFile(fileRecord.storageKey);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": fileRecord.mimeType,
        "Content-Disposition": `attachment; filename="${fileRecord.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

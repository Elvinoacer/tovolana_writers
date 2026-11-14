import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/auth";
import {
  computeArchiveExpiryDate,
  computeListingValidityDate,
} from "@/lib/state-machines";
import { invalidateCachePrefix } from "@/lib/redis";
import { fail, handleApiError, ok } from "@/lib/http";

const lifecycleSchema = z.object({
  action: z.enum(["EXPIRE", "ARCHIVE", "RESTORE", "SUSPEND", "SET_VALIDITY"]),
  validityType: z
    .enum(["STANDARD_30D", "SHORT_14D", "ADMIN_CUSTOM"])
    .default("STANDARD_30D"),
  customValidUntil: z.string().optional(),
  reason: z.string().min(3).max(500).default("Administrator lifecycle action"),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminScope("MODERATION_ADMIN", request);
    const { id } = await context.params;
    const body = lifecycleSchema.parse(await request.json());

    const listing = await db.taskListing.findUnique({ where: { id } });
    if (!listing) return fail("NOT_FOUND", "Listing not found.", 404);

    const now = new Date();
    const config = await db.platformConfig.findUnique({
      where: { id: "global" },
    });
    const archiveDays = config?.archiveRecoveryDays ?? 14;

    let updateData: Record<string, unknown> = {};
    if (body.action === "EXPIRE") {
      updateData = { status: "EXPIRED", validUntil: now };
    } else if (body.action === "ARCHIVE") {
      updateData = {
        status: "ARCHIVED",
        archiveExpiresAt: computeArchiveExpiryDate(archiveDays, now),
      };
    } else if (body.action === "SUSPEND") {
      updateData = { status: "SUSPENDED", moderationNote: body.reason };
    } else if (body.action === "RESTORE" || body.action === "SET_VALIDITY") {
      if (
        body.action === "RESTORE" &&
        listing.archiveExpiresAt &&
        listing.archiveExpiresAt.getTime() < now.getTime()
      ) {
        return fail(
          "ARCHIVE_RECOVERY_EXPIRED",
          "The 14-day archive recovery window has elapsed.",
          409
        );
      }
      const nextValidUntil = computeListingValidityDate({
        validityType: body.validityType,
        customValidUntil: body.customValidUntil,
        now,
      });
      updateData = {
        status: "PUBLISHED",
        validityType: body.validityType,
        validUntil: nextValidUntil,
        archiveExpiresAt: null,
        publishedAt: listing.publishedAt ?? now,
      };
    }

    const updated = await db.$transaction(async (tx) => {
      const saved = await tx.taskListing.update({
        where: { id: listing.id },
        data: updateData,
      });

      await tx.adminAuditLog.create({
        data: {
          actorAdminId: admin.id,
          action: `LISTING_LIFECYCLE_${body.action}`,
          targetType: "TaskListing",
          targetId: listing.id,
          reason: body.reason,
          metadata: { status: saved.status, validUntil: saved.validUntil },
        },
      });

      // Confirm active bookings remain untouched per PRD Section 2
      const untouchedConfirmedBookings = await tx.booking.count({
        where: {
          taskId: listing.id,
          status: {
            in: [
              "PAID_AWAITING_ACCEPTANCE",
              "IN_PROGRESS",
              "DELIVERED",
              "REVISION_REQUESTED",
              "DISPUTED",
            ],
          },
        },
      });

      return { saved, untouchedConfirmedBookings };
    });

    await invalidateCachePrefix("categories:");
    return ok({
      listing: updated.saved,
      confirmedBookingsPreserved: updated.untouchedConfirmedBookings,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

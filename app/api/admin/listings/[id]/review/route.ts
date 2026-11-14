import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/auth";
import { computeListingValidityDate } from "@/lib/state-machines";
import { enqueueNotificationInTx } from "@/lib/notifications";
import { invalidateCachePrefix } from "@/lib/redis";
import { fail, handleApiError, ok } from "@/lib/http";

const reviewSchema = z.object({
  decision: z.enum(["APPROVE", "REQUEST_CHANGES", "REJECT"]),
  note: z.string().max(1000).optional(),
  validityType: z
    .enum(["STANDARD_30D", "SHORT_14D", "ADMIN_CUSTOM"])
    .optional(),
  customValidUntil: z.string().optional(),
  proEarlyAccessHours: z.number().int().min(0).max(168).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminScope("MODERATION_ADMIN", request);
    const { id } = await context.params;
    const body = reviewSchema.parse(await request.json());

    const listing = await db.taskListing.findUnique({
      where: { id },
      include: { creator: true },
    });
    if (!listing) {
      return fail("NOT_FOUND", "Listing not found.", 404);
    }

    const now = new Date();
    const chosenValidity = body.validityType ?? listing.validityType;
    const validUntil =
      body.decision === "APPROVE"
        ? computeListingValidityDate({
            validityType: chosenValidity,
            customValidUntil: body.customValidUntil,
            now,
          })
        : listing.validUntil;

    const proEarlyAccessUntil =
      body.decision === "APPROVE" &&
      body.proEarlyAccessHours &&
      body.proEarlyAccessHours > 0
        ? new Date(now.getTime() + body.proEarlyAccessHours * 60 * 60 * 1000)
        : null;

    const nextStatus =
      body.decision === "APPROVE"
        ? "PUBLISHED"
        : body.decision === "REQUEST_CHANGES"
          ? "CHANGES_REQUESTED"
          : "ARCHIVED";

    const updated = await db.$transaction(async (tx) => {
      const saved = await tx.taskListing.update({
        where: { id: listing.id },
        data: {
          status: nextStatus,
          validityType: chosenValidity,
          validUntil,
          proEarlyAccessUntil,
          moderationNote: body.note?.trim() || null,
          publishedAt: body.decision === "APPROVE" ? now : listing.publishedAt,
          archiveExpiresAt:
            body.decision === "REJECT"
              ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
              : null,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          actorAdminId: admin.id,
          action: `LISTING_${body.decision}`,
          targetType: "TaskListing",
          targetId: listing.id,
          reason: body.note?.trim() || `Moderation decision: ${body.decision}`,
          metadata: { nextStatus, validUntil },
        },
      });

      if (listing.creator) {
        await enqueueNotificationInTx(tx, {
          userId: listing.creator.userId,
          eventType: `LISTING_${body.decision}`,
          title: `Listing Review Update: ${listing.title}`,
          body:
            body.decision === "APPROVE"
              ? `Your service listing "${listing.title}" is now live until ${validUntil?.toDateString()}.`
              : `Your service listing "${listing.title}" status changed to ${nextStatus.replace(/_/g, " ")}. Note: ${body.note || "See Creators Hub."}`,
          linkUrl: `/creators-hub/listings`,
        });
      }

      return saved;
    });

    await invalidateCachePrefix("categories:");
    return ok({ listing: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

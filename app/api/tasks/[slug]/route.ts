import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { calculateBookingPricing, isUserProActive } from "@/lib/pricing";
import { canTransitionListingStatus } from "@/lib/state-machines";
import { fail, handleApiError, ok } from "@/lib/http";

const updateTaskSchema = z.object({
  title: z.string().min(6).max(160).optional(),
  shortDescription: z.string().min(10).max(280).optional(),
  fullDescription: z.string().min(20).max(6000).optional(),
  basePrice: z.number().positive().optional(),
  deliveryTurnaroundDays: z.number().int().min(1).max(90).optional(),
  maxRevisions: z.number().int().min(0).max(10).optional(),
  validityType: z.enum(["STANDARD_30D", "SHORT_14D", "ADMIN_CUSTOM"]).optional(),
  deliverablesSummary: z.array(z.string().min(2)).min(1).optional(),
  requirementsConfig: z.array(z.record(z.string(), z.unknown())).optional(),
  revisionPolicy: z.string().min(5).max(1000).optional(),
  cancellationPolicy: z.string().min(5).max(1000).optional(),
  submitForReview: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const user = await getCurrentUser(request);
    const userIsPro = user
      ? isUserProActive(user.membershipTier, user.proExpiresAt)
      : false;

    const task = await db.taskListing.findFirst({
      where: {
        OR: [{ slug }, { id: slug }],
      },
      include: {
        category: true,
        creator: {
          include: {
            user: { select: { avatarUrl: true } },
            reviewsReceived: {
              where: { isPublic: true },
              orderBy: { createdAt: "desc" },
              take: 6,
              include: {
                customer: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
          },
        },
        reviews: {
          where: { isPublic: true },
          orderBy: { createdAt: "desc" },
          include: {
            customer: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!task) {
      return fail("NOT_FOUND", "Task listing not found.", 404);
    }

    const isOwner = Boolean(
      user?.creatorProfile && task.creatorId === user.creatorProfile.id
    );
    const isAdmin = user?.roles.includes("ADMIN") ?? false;

    if (task.status !== "PUBLISHED" && !isOwner && !isAdmin) {
      return fail(
        "LISTING_UNAVAILABLE",
        "This listing is no longer publicly available.",
        404
      );
    }

    const config = await db.platformConfig.findUnique({
      where: { id: "global" },
    });

    const freePricing = calculateBookingPricing({
      listedPrice: task.basePrice,
      standardServiceFeePct: config?.standardServiceFeePct ?? 10,
      proFeeDiscountPct: config?.proFeeDiscountPct ?? 50,
      serviceFeePctOverride: task.serviceFeePctOverride,
      userIsPro: false,
    });
    const proPricing = calculateBookingPricing({
      listedPrice: task.basePrice,
      standardServiceFeePct: config?.standardServiceFeePct ?? 10,
      proFeeDiscountPct: config?.proFeeDiscountPct ?? 50,
      serviceFeePctOverride: task.serviceFeePctOverride,
      userIsPro: true,
    });

    return ok({
      task,
      pricing: {
        active: userIsPro ? proPricing : freePricing,
        freePreview: freePricing,
        proPreview: proPricing,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const user = await requireAuth(request);
    const isAdmin = user.roles.includes("ADMIN");

    const task = await db.taskListing.findFirst({
      where: { OR: [{ id: slug }, { slug }] },
    });
    if (!task) {
      return fail("NOT_FOUND", "Listing not found.", 404);
    }

    const isOwner = Boolean(
      user.creatorProfile && task.creatorId === user.creatorProfile.id
    );
    if (!isOwner && !isAdmin) {
      return fail(
        "FORBIDDEN",
        "You can only modify your own listings.",
        403
      );
    }

    const body = updateTaskSchema.parse(await request.json());
    let nextStatus = task.status;
    if (body.submitForReview) {
      if (!canTransitionListingStatus(task.status, "PENDING_REVIEW")) {
        return fail(
          "INVALID_STATUS_TRANSITION",
          `Cannot submit listing from status ${task.status} for review.`,
          400
        );
      }
      nextStatus = "PENDING_REVIEW";
    }

    const updated = await db.taskListing.update({
      where: { id: task.id },
      data: {
        title: body.title?.trim(),
        shortDescription: body.shortDescription?.trim(),
        fullDescription: body.fullDescription?.trim(),
        basePrice: body.basePrice,
        deliveryTurnaroundDays: body.deliveryTurnaroundDays,
        maxRevisions: body.maxRevisions,
        validityType: body.validityType,
        deliverablesSummary: body.deliverablesSummary,
        requirementsConfig: body.requirementsConfig as
          | Prisma.InputJsonValue
          | undefined,
        revisionPolicy: body.revisionPolicy?.trim(),
        cancellationPolicy: body.cancellationPolicy?.trim(),
        status: nextStatus,
      },
    });

    return ok({ listing: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const user = await requireAuth(request);
    const isAdmin = user.roles.includes("ADMIN");

    const task = await db.taskListing.findFirst({
      where: { OR: [{ id: slug }, { slug }] },
      include: { _count: { select: { bookings: true } } },
    });
    if (!task) {
      return fail("NOT_FOUND", "Listing not found.", 404);
    }

    const isOwner = Boolean(
      user.creatorProfile && task.creatorId === user.creatorProfile.id
    );
    if (!isOwner && !isAdmin) {
      return fail("FORBIDDEN", "Permission denied.", 403);
    }

    if (task._count.bookings > 0) {
      const retained = await db.taskListing.update({
        where: { id: task.id },
        data: { status: "RETAINED_SOFT_DELETED" },
      });
      return ok({
        listing: retained,
        retentionMode: "SOFT_RETAINED_WITH_BOOKINGS",
      });
    }

    await db.taskListing.delete({ where: { id: task.id } });
    return ok({ deleted: true, id: task.id });
  } catch (err) {
    return handleApiError(err);
  }
}

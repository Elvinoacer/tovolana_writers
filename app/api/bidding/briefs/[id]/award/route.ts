import crypto from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  calculateAddOnsTotal,
  calculateBookingPricing,
  isFutureTimestamp,
  isUserProActive,
} from "@/lib/pricing";
import { enqueueNotificationInTx } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

const awardSchema = z.object({
  bidId: z.string().min(1),
  checkoutMode: z
    .enum(["FULL_ESCROW", "TRIPWIRE_OUTLINE", "MILESTONE_SPLIT"])
    .default("FULL_ESCROW"),
  selectedAddOns: z.array(z.string()).default([]),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await requireAuth(request);
    const body = awardSchema.parse(await request.json());

    const brief = await db.openBrief.findFirst({
      where: { OR: [{ id }, { briefRef: id }] },
      include: { category: true },
    });
    if (!brief) {
      return fail("BRIEF_NOT_FOUND", "Open brief not found.", 404);
    }
    if (brief.customerId !== user.id && !user.roles.includes("ADMIN")) {
      return fail(
        "FORBIDDEN",
        "Only the brief client can award a winning bid.",
        403
      );
    }
    if (brief.status !== "OPEN") {
      return fail(
        "BRIEF_ALREADY_AWARDED",
        `Brief is already in status ${brief.status}.`,
        409
      );
    }

    const bid = await db.taskBid.findFirst({
      where: { id: body.bidId, openBriefId: brief.id },
      include: { creatorProfile: true },
    });
    if (!bid) {
      return fail("BID_NOT_FOUND", "Selected bid not found for this brief.", 404);
    }

    const now = new Date();
    const userIsPro = isUserProActive(user.membershipTier, user.proExpiresAt, now);
    const config = await db.platformConfig.findUnique({
      where: { id: "global" },
    });

    const { addOnsTotal, itemized } = calculateAddOnsTotal(
      bid.proposedPrice,
      body.selectedAddOns
    );
    const hasCreatorPlus = isFutureTimestamp(
      bid.creatorProfile.creatorPlusUntil,
      now
    );
    const creatorCommissionPct = hasCreatorPlus ? 5 : 10;

    const pricing = calculateBookingPricing({
      listedPrice: bid.proposedPrice,
      addOnsTotal,
      standardServiceFeePct: config?.standardServiceFeePct ?? 10,
      proFeeDiscountPct: config?.proFeeDiscountPct ?? 50,
      userIsPro,
      checkoutMode: body.checkoutMode,
      creatorCommissionPct,
    });

    const bookingRef = `TVL-${now.getFullYear()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;

    const turnaroundDays = body.selectedAddOns.includes("priority_rush")
      ? Math.max(1, Math.ceil(bid.deliveryDays / 2))
      : bid.deliveryDays;
    const agreedDeliveryDeadline = new Date(
      now.getTime() + turnaroundDays * 24 * 60 * 60 * 1000
    );

    const result = await db.$transaction(async (tx) => {
      // Backing custom listing stored as DRAFT so it never pollutes public /explore catalog
      const backingListing = await tx.taskListing.create({
        data: {
          slug: `brief-${brief.briefRef.toLowerCase()}-${crypto
            .randomBytes(3)
            .toString("hex")}`,
          title: brief.title,
          shortDescription: brief.description.slice(0, 260),
          fullDescription: brief.description,
          serviceType: `Open Brief (${brief.academicLevel})`,
          categoryId: brief.categoryId,
          creatorId: bid.creatorProfileId,
          createdByAdmin: true,
          pricingType: "QUOTE_BASED",
          basePrice: bid.proposedPrice,
          currency: brief.currency,
          deliveryTurnaroundDays: turnaroundDays,
          maxRevisions: config?.defaultRevisionLimit ?? 2,
          manualAcceptanceRequired: false,
          validityType: "ADMIN_CUSTOM",
          deliverablesSummary: [
            `${brief.wordCount.toLocaleString()} words (${brief.citationStyle})`,
            `Awarded from ${brief.briefRef}`,
          ],
          requirementsConfig: brief.category.requirementsSchema as Prisma.InputJsonValue,
          revisionPolicy:
            config?.revisionPolicyText ??
            "Includes standard revision protection.",
          cancellationPolicy:
            config?.cancellationPolicyText ??
            "Standard escrow cancellation protection applies.",
          status: "DRAFT",
        },
      });

      const booking = await tx.booking.create({
        data: {
          bookingRef,
          taskId: backingListing.id,
          customerId: brief.customerId,
          creatorId: bid.creatorProfileId,
          taskTitleSnapshot: brief.title,
          currency: brief.currency,
          listedPrice: pricing.listedPrice,
          extraCharges: pricing.extraCharges,
          addOnsTotal: pricing.addOnsTotal,
          selectedAddOns: itemized as unknown as Prisma.InputJsonValue,
          checkoutMode: pricing.checkoutMode,
          creatorCommissionPct,
          openBriefId: brief.id,
          awardedBidId: bid.id,
          serviceFee: pricing.serviceFee,
          proDiscount: pricing.proDiscount,
          totalPayable: pricing.totalPayable,
          creatorNetAmount: pricing.creatorNetAmount,
          requirementsResponses: {
            briefRef: brief.briefRef,
            academicLevel: brief.academicLevel,
            wordCount: brief.wordCount,
            citationStyle: brief.citationStyle,
            instructions: brief.description,
            creatorPitch: bid.pitch,
          } as Prisma.InputJsonValue,
          agreedDeliveryDeadline,
          status: "PENDING_PAYMENT",
          maxRevisions: config?.defaultRevisionLimit ?? 2,
          messages: {
            create: {
              senderId: user.id,
              isSystemMessage: true,
              body: `Awarded bid from ${brief.briefRef} (${pricing.checkoutMode.replace(/_/g, " ")}: ${brief.currency} ${pricing.totalPayable.toLocaleString()}). Complete IntaSend payment to lock escrow.`,
            },
          },
        },
      });

      await tx.taskBid.update({
        where: { id: bid.id },
        data: { status: "ACCEPTED" },
      });

      await tx.taskBid.updateMany({
        where: { openBriefId: brief.id, id: { not: bid.id } },
        data: { status: "DECLINED" },
      });

      const updatedBrief = await tx.openBrief.update({
        where: { id: brief.id },
        data: {
          status: "AWARDED",
          awardedBidId: bid.id,
          bookingId: booking.id,
        },
      });

      await enqueueNotificationInTx(tx, {
        userId: bid.creatorProfile.userId,
        eventType: "BID_AWARDED",
        title: `Your Bid Won: ${brief.briefRef}`,
        body: `Client awarded "${brief.title}" to you (${bookingRef}). Waiting for escrow funding.`,
        linkUrl: `/creators-hub/bookings/${bookingRef}`,
        payload: { bookingRef, briefId: brief.id, bidId: bid.id },
      });

      return { booking, brief: updatedBrief };
    });

    return ok({ booking: result.booking, brief: result.brief, pricing }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

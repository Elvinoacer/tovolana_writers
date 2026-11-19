import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import {
  BID_FEATURED_CONNECTS_COST,
  BID_SEALED_CONNECTS_COST,
  computeBidRankScore,
  isFutureTimestamp,
  rankBidsForBrief,
} from "@/lib/pricing";
import { enqueueNotificationInTx } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

const submitBidSchema = z.object({
  proposedPrice: z.number().positive(),
  deliveryDays: z.number().int().min(1).max(60),
  pitch: z.string().min(20).max(3000),
  sampleHook: z.string().max(1200).optional(),
  boostConnects: z.number().int().min(0).max(500).default(0),
  isSealed: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
});

const boostBidSchema = z.object({
  addBoostConnects: z.number().int().min(0).max(500).default(0),
  enableSealed: z.boolean().optional(),
  enableFeatured: z.boolean().optional(),
  proposedPrice: z.number().positive().optional(),
  deliveryDays: z.number().int().min(1).max(60).optional(),
  pitch: z.string().min(20).max(3000).optional(),
});

async function loadBriefWithRankedBids(idOrRef: string) {
  return db.openBrief.findFirst({
    where: { OR: [{ id: idOrRef }, { briefRef: idOrRef }] },
    include: {
      category: { select: { id: true, slug: true, name: true } },
      customer: { select: { id: true, name: true, avatarUrl: true } },
      bids: {
        where: { status: { not: "WITHDRAWN" } },
        include: {
          creatorProfile: {
            select: {
              id: true,
              userId: true,
              username: true,
              displayName: true,
              headline: true,
              creatorTier: true,
              assessmentScore: true,
              ratingAverage: true,
              completedBookingsCount: true,
              profileCompletenessScore: true,
              taglineBadge: true,
              educationCredentials: true,
              yearsExperience: true,
              responseTimeMinutes: true,
              onTimeDeliveryRate: true,
              availableNowBadgeUntil: true,
              featuredProfileUntil: true,
              creatorPlusUntil: true,
              user: { select: { avatarUrl: true } },
            },
          },
        },
      },
    },
  });
}

function serializeRankedBids(
  bids: NonNullable<Awaited<ReturnType<typeof loadBriefWithRankedBids>>>["bids"],
  briefIsSealed: boolean,
  viewerUserId: string | null,
  briefCustomerId: string,
  viewerCreatorId: string | null,
  isAdmin: boolean
) {
  const ranked = rankBidsForBrief(bids);
  const isOwner = viewerUserId === briefCustomerId;

  return ranked.map((bid) => {
    const isAuthor = bid.creatorProfileId === viewerCreatorId;
    const redacted = (briefIsSealed || bid.isSealed) && !isOwner && !isAuthor && !isAdmin;

    return {
      id: bid.id,
      openBriefId: bid.openBriefId,
      creatorProfileId: bid.creatorProfileId,
      proposedPrice: redacted ? null : bid.proposedPrice,
      currency: bid.currency,
      deliveryDays: bid.deliveryDays,
      pitch: redacted
        ? "Sealed proposal — price and editorial strategy visible only to the client."
        : bid.pitch,
      sampleHook: redacted ? null : bid.sampleHook,
      baseConnectsSpent: bid.baseConnectsSpent,
      boostConnects: bid.boostConnects,
      isSealed: bid.isSealed,
      isFeatured: bid.isFeatured,
      rankScore: bid.rankScore,
      status: bid.status,
      createdAt: bid.createdAt,
      rankPosition: bid.rankPosition,
      totalBidders: bid.totalBidders,
      isTopBoostedSlot: bid.isTopBoostedSlot,
      connectsNeededForRank1: bid.connectsNeededForRank1,
      connectsNeededForTop3: bid.connectsNeededForTop3,
      isRedacted: redacted,
      isMyBid: isAuthor,
      creator: {
        id: bid.creatorProfile.id,
        username: bid.creatorProfile.username,
        displayName: bid.creatorProfile.displayName,
        headline: bid.creatorProfile.headline,
        creatorTier: bid.creatorProfile.creatorTier,
        assessmentScore: bid.creatorProfile.assessmentScore,
        ratingAverage: bid.creatorProfile.ratingAverage,
        completedBookingsCount: bid.creatorProfile.completedBookingsCount,
        profileCompletenessScore: bid.creatorProfile.profileCompletenessScore,
        taglineBadge: bid.creatorProfile.taglineBadge,
        educationCredentials: bid.creatorProfile.educationCredentials,
        yearsExperience: bid.creatorProfile.yearsExperience,
        responseTimeMinutes: bid.creatorProfile.responseTimeMinutes,
        onTimeDeliveryRate: bid.creatorProfile.onTimeDeliveryRate,
        availableNow: isFutureTimestamp(bid.creatorProfile.availableNowBadgeUntil),
        featuredProfile: isFutureTimestamp(bid.creatorProfile.featuredProfileUntil),
        creatorPlus: isFutureTimestamp(bid.creatorProfile.creatorPlusUntil),
        avatarUrl: bid.creatorProfile.user?.avatarUrl ?? null,
      },
    };
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser(request);
    const brief = await loadBriefWithRankedBids(id);
    if (!brief) {
      return fail("BRIEF_NOT_FOUND", "Open brief not found.", 404);
    }

    const viewerCreatorId = user?.creatorProfile?.id ?? null;
    const isAdmin = user?.roles.includes("ADMIN") ?? false;
    const hasCreatorPlus = isFutureTimestamp(
      user?.creatorProfile?.creatorPlusUntil
    );

    const rankedBids = serializeRankedBids(
      brief.bids,
      brief.isSealed,
      user?.id ?? null,
      brief.customerId,
      viewerCreatorId,
      isAdmin
    );

    const allPrices = brief.bids.map((b) => b.proposedPrice);
    const bidStats = {
      count: allPrices.length,
      minBid: allPrices.length ? Math.min(...allPrices) : null,
      avgBid: allPrices.length
        ? Math.round(
            allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length
          )
        : null,
      maxBid: allPrices.length ? Math.max(...allPrices) : null,
    };

    const canSeeCompetitorStats =
      user?.id === brief.customerId ||
      isAdmin ||
      hasCreatorPlus ||
      !brief.isSealed;

    const myBid = rankedBids.find((b) => b.isMyBid) ?? null;

    return ok({
      brief: {
        id: brief.id,
        briefRef: brief.briefRef,
        customerId: brief.customerId,
        title: brief.title,
        description: brief.description,
        academicLevel: brief.academicLevel,
        wordCount: brief.wordCount,
        citationStyle: brief.citationStyle,
        budgetMin: brief.budgetMin,
        budgetMax: brief.budgetMax,
        currency: brief.currency,
        deadlineDays: brief.deadlineDays,
        requiredConnects: brief.requiredConnects,
        isUrgent: brief.isUrgent,
        isSealed: brief.isSealed,
        ndaRequired: brief.ndaRequired,
        allowTripwireOutline: brief.allowTripwireOutline,
        status: brief.status,
        awardedBidId: brief.awardedBidId,
        bookingId: brief.bookingId,
        expiresAt: brief.expiresAt,
        createdAt: brief.createdAt,
        category: brief.category,
        customer: brief.customer,
      },
      bids: rankedBids,
      myBid,
      bidStats: canSeeCompetitorStats ? bidStats : { count: allPrices.length, minBid: null, avgBid: null, maxBid: null },
      viewerConnectsBalance: user?.creatorProfile?.connectsBalance ?? null,
      hasCreatorPlus,
      isOwner: user?.id === brief.customerId,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await requireAuth(request);

    if (
      !user.roles.includes("CREATOR") ||
      !user.creatorProfile ||
      user.creatorProfile.applicationStatus !== "APPROVED"
    ) {
      return fail(
        "CREATOR_REQUIRED",
        "Only approved Creators can submit ranked proposals.",
        403
      );
    }

    const brief = await db.openBrief.findFirst({
      where: { OR: [{ id }, { briefRef: id }] },
    });
    if (!brief) {
      return fail("BRIEF_NOT_FOUND", "Open brief not found.", 404);
    }
    if (brief.status !== "OPEN") {
      return fail(
        "BRIEF_CLOSED",
        `This brief is ${brief.status} and no longer accepts bids.`,
        409
      );
    }
    if (brief.customerId === user.id) {
      return fail(
        "SELF_BID_NOT_ALLOWED",
        "You cannot submit a writer bid on your own open brief.",
        400
      );
    }

    const existingBid = await db.taskBid.findUnique({
      where: {
        openBriefId_creatorProfileId: {
          openBriefId: brief.id,
          creatorProfileId: user.creatorProfile.id,
        },
      },
    });
    if (existingBid) {
      return fail(
        "ALREADY_BID",
        "You already have an active proposal on this brief. Boost or edit your bid instead.",
        409
      );
    }

    const body = submitBidSchema.parse(await request.json());
    const baseCost = brief.requiredConnects;
    const sealedCost = body.isSealed ? BID_SEALED_CONNECTS_COST : 0;
    const featuredCost = body.isFeatured ? BID_FEATURED_CONNECTS_COST : 0;
    const boostCost = body.boostConnects;
    const totalCost = baseCost + sealedCost + featuredCost + boostCost;

    const txResult = await db.$transaction(async (tx) => {
      const creator = await tx.creatorProfile.findUniqueOrThrow({
        where: { id: user.creatorProfile!.id },
      });

      if (creator.connectsBalance < totalCost) {
        return { error: "INSUFFICIENT_CONNECTS" as const, balance: creator.connectsBalance };
      }

      const rankScore = computeBidRankScore({
        boostConnects: boostCost,
        isFeatured: body.isFeatured,
        isSealed: body.isSealed,
        creatorTier: creator.creatorTier,
        assessmentScore: creator.assessmentScore,
        ratingAverage: creator.ratingAverage,
        profileCompletenessScore: creator.profileCompletenessScore,
      });

      const updatedCreator = await tx.creatorProfile.update({
        where: { id: creator.id },
        data: {
          connectsBalance: { decrement: totalCost },
          totalConnectsSpent: { increment: totalCost },
        },
      });

      const createdBid = await tx.taskBid.create({
        data: {
          openBriefId: brief.id,
          creatorProfileId: creator.id,
          proposedPrice: body.proposedPrice,
          currency: brief.currency,
          deliveryDays: body.deliveryDays,
          pitch: body.pitch.trim(),
          sampleHook: body.sampleHook?.trim() || null,
          baseConnectsSpent: baseCost,
          boostConnects: boostCost,
          isSealed: body.isSealed,
          isFeatured: body.isFeatured,
          rankScore,
        },
      });

      let runningBalance = creator.connectsBalance;
      const ledgerEntries: Array<{
        creatorProfileId: string;
        type:
          | "BID_SUBMITTED"
          | "BID_BOOST_STAKE"
          | "BID_SEALED_UPGRADE"
          | "BID_FEATURED_UPGRADE";
        amount: number;
        balanceAfter: number;
        description: string;
        bidId: string;
      }> = [];

      runningBalance -= baseCost;
      ledgerEntries.push({
        creatorProfileId: creator.id,
        type: "BID_SUBMITTED",
        amount: -baseCost,
        balanceAfter: runningBalance,
        description: `Proposal submitted on ${brief.briefRef}: ${brief.title}`,
        bidId: createdBid.id,
      });

      if (boostCost > 0) {
        runningBalance -= boostCost;
        ledgerEntries.push({
          creatorProfileId: creator.id,
          type: "BID_BOOST_STAKE",
          amount: -boostCost,
          balanceAfter: runningBalance,
          description: `Rank Boost (+${boostCost} Connects) on ${brief.briefRef}`,
          bidId: createdBid.id,
        });
      }

      if (sealedCost > 0) {
        runningBalance -= sealedCost;
        ledgerEntries.push({
          creatorProfileId: creator.id,
          type: "BID_SEALED_UPGRADE",
          amount: -sealedCost,
          balanceAfter: runningBalance,
          description: `Sealed Proposal upgrade on ${brief.briefRef}`,
          bidId: createdBid.id,
        });
      }

      if (featuredCost > 0) {
        runningBalance -= featuredCost;
        ledgerEntries.push({
          creatorProfileId: creator.id,
          type: "BID_FEATURED_UPGRADE",
          amount: -featuredCost,
          balanceAfter: runningBalance,
          description: `Top Featured Pick upgrade on ${brief.briefRef}`,
          bidId: createdBid.id,
        });
      }

      await tx.connectsTransaction.createMany({ data: ledgerEntries });

      await enqueueNotificationInTx(tx, {
        userId: brief.customerId,
        eventType: "NEW_BID_RECEIVED",
        title: `New Writer Offer on ${brief.briefRef}`,
        body: `${creator.displayName} offered to write this for KES ${body.proposedPrice.toLocaleString()} (${body.deliveryDays}d).`,
        linkUrl: `/bidding/${brief.id}`,
        payload: { briefId: brief.id, bidId: createdBid.id },
      });

      return {
        error: null,
        bid: createdBid,
        connectsBalance: updatedCreator.connectsBalance,
      };
    });

    if (txResult.error === "INSUFFICIENT_CONNECTS") {
      return fail(
        "INSUFFICIENT_CONNECTS",
        `Need ${totalCost} Connects to submit this proposal (balance: ${txResult.balance}).`,
        402,
        { required: totalCost, balance: txResult.balance }
      );
    }

    const refreshed = await loadBriefWithRankedBids(brief.id);
    const rankedBids = refreshed
      ? serializeRankedBids(
          refreshed.bids,
          refreshed.isSealed,
          user.id,
          brief.customerId,
          user.creatorProfile.id,
          user.roles.includes("ADMIN")
        )
      : [];
    const myBid = rankedBids.find((b) => b.id === txResult.bid.id) ?? null;

    return ok(
      {
        bid: myBid,
        rankPosition: myBid?.rankPosition ?? 1,
        totalBidders: myBid?.totalBidders ?? rankedBids.length,
        connectsNeededForRank1: myBid?.connectsNeededForRank1 ?? 0,
        connectsNeededForTop3: myBid?.connectsNeededForTop3 ?? 0,
        rankedBids,
        connectsBalance: txResult.connectsBalance,
      },
      201
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await requireAuth(request);

    if (!user.roles.includes("CREATOR") || !user.creatorProfile) {
      return fail("FORBIDDEN", "Creator profile required.", 403);
    }

    const brief = await db.openBrief.findFirst({
      where: { OR: [{ id }, { briefRef: id }] },
    });
    if (!brief) {
      return fail("BRIEF_NOT_FOUND", "Open brief not found.", 404);
    }
    if (brief.status !== "OPEN") {
      return fail("BRIEF_CLOSED", "Cannot boost a closed brief.", 409);
    }

    const existingBid = await db.taskBid.findUnique({
      where: {
        openBriefId_creatorProfileId: {
          openBriefId: brief.id,
          creatorProfileId: user.creatorProfile.id,
        },
      },
    });
    if (!existingBid) {
      return fail(
        "BID_NOT_FOUND",
        "You have not submitted a proposal on this brief yet.",
        404
      );
    }

    const body = boostBidSchema.parse(await request.json());
    const boostCost = body.addBoostConnects;
    const sealedCost =
      body.enableSealed && !existingBid.isSealed ? BID_SEALED_CONNECTS_COST : 0;
    const featuredCost =
      body.enableFeatured && !existingBid.isFeatured
        ? BID_FEATURED_CONNECTS_COST
        : 0;
    const totalCost = boostCost + sealedCost + featuredCost;

    const txResult = await db.$transaction(async (tx) => {
      const creator = await tx.creatorProfile.findUniqueOrThrow({
        where: { id: user.creatorProfile!.id },
      });

      if (creator.connectsBalance < totalCost) {
        return { error: "INSUFFICIENT_CONNECTS" as const, balance: creator.connectsBalance };
      }

      const nextBoost = existingBid.boostConnects + boostCost;
      const nextSealed = existingBid.isSealed || Boolean(body.enableSealed);
      const nextFeatured =
        existingBid.isFeatured || Boolean(body.enableFeatured);

      const rankScore = computeBidRankScore({
        boostConnects: nextBoost,
        isFeatured: nextFeatured,
        isSealed: nextSealed,
        creatorTier: creator.creatorTier,
        assessmentScore: creator.assessmentScore,
        ratingAverage: creator.ratingAverage,
        profileCompletenessScore: creator.profileCompletenessScore,
      });

      const updatedBid = await tx.taskBid.update({
        where: { id: existingBid.id },
        data: {
          boostConnects: nextBoost,
          isSealed: nextSealed,
          isFeatured: nextFeatured,
          proposedPrice: body.proposedPrice ?? existingBid.proposedPrice,
          deliveryDays: body.deliveryDays ?? existingBid.deliveryDays,
          pitch: body.pitch ? body.pitch.trim() : existingBid.pitch,
          rankScore,
        },
      });

      let connectsBalance = creator.connectsBalance;
      if (totalCost > 0) {
        const updatedCreator = await tx.creatorProfile.update({
          where: { id: creator.id },
          data: {
            connectsBalance: { decrement: totalCost },
            totalConnectsSpent: { increment: totalCost },
          },
        });
        connectsBalance = updatedCreator.connectsBalance;

        let runningBalance = creator.connectsBalance;
        if (boostCost > 0) {
          runningBalance -= boostCost;
          await tx.connectsTransaction.create({
            data: {
              creatorProfileId: creator.id,
              type: "BID_BOOST_STAKE",
              amount: -boostCost,
              balanceAfter: runningBalance,
              description: `Promoted bid rank (+${boostCost} Connects) on ${brief.briefRef}`,
              bidId: existingBid.id,
            },
          });
        }
        if (sealedCost > 0) {
          runningBalance -= sealedCost;
          await tx.connectsTransaction.create({
            data: {
              creatorProfileId: creator.id,
              type: "BID_SEALED_UPGRADE",
              amount: -sealedCost,
              balanceAfter: runningBalance,
              description: `Upgraded proposal to Sealed on ${brief.briefRef}`,
              bidId: existingBid.id,
            },
          });
        }
        if (featuredCost > 0) {
          runningBalance -= featuredCost;
          await tx.connectsTransaction.create({
            data: {
              creatorProfileId: creator.id,
              type: "BID_FEATURED_UPGRADE",
              amount: -featuredCost,
              balanceAfter: runningBalance,
              description: `Upgraded proposal to Featured Gold Pitch on ${brief.briefRef}`,
              bidId: existingBid.id,
            },
          });
        }
      }

      return { error: null, bid: updatedBid, connectsBalance };
    });

    if (txResult.error === "INSUFFICIENT_CONNECTS") {
      return fail(
        "INSUFFICIENT_CONNECTS",
        `Need ${totalCost} Connects to promote this bid (balance: ${txResult.balance}).`,
        402,
        { required: totalCost, balance: txResult.balance }
      );
    }

    const refreshed = await loadBriefWithRankedBids(brief.id);
    const rankedBids = refreshed
      ? serializeRankedBids(
          refreshed.bids,
          refreshed.isSealed,
          user.id,
          brief.customerId,
          user.creatorProfile.id,
          user.roles.includes("ADMIN")
        )
      : [];
    const myBid = rankedBids.find((b) => b.id === txResult.bid.id) ?? null;

    return ok({
      bid: myBid,
      rankPosition: myBid?.rankPosition ?? 1,
      totalBidders: myBid?.totalBidders ?? rankedBids.length,
      connectsNeededForRank1: myBid?.connectsNeededForRank1 ?? 0,
      connectsNeededForTop3: myBid?.connectsNeededForTop3 ?? 0,
      rankedBids,
      connectsBalance: txResult.connectsBalance,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

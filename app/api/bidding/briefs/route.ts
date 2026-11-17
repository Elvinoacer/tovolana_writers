import crypto from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import {
  calculateRequiredConnectsForBrief,
  isFutureTimestamp,
  rankBidsForBrief,
} from "@/lib/pricing";
import { fail, handleApiError, ok } from "@/lib/http";

const createBriefSchema = z.object({
  title: z.string().min(6).max(180),
  categoryId: z.string().min(1),
  description: z.string().min(20).max(5000),
  academicLevel: z.string().min(2).max(80).default("Postgraduate / Masters"),
  wordCount: z.number().int().min(100).max(100000).default(2000),
  citationStyle: z.string().min(2).max(60).default("APA 7th"),
  budgetMin: z.number().positive(),
  budgetMax: z.number().positive(),
  deadlineDays: z.number().int().min(1).max(60).default(3),
  isUrgent: z.boolean().default(false),
  isSealed: z.boolean().default(false),
  ndaRequired: z.boolean().default(false),
  allowTripwireOutline: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const params = request.nextUrl.searchParams;
    const categorySlug = params.get("category")?.trim();
    const q = params.get("q")?.trim();
    const statusParam = params.get("status")?.trim() || "OPEN";
    const mineOnly = params.get("mine") === "true";

    const where: Record<string, unknown> = {};
    if (statusParam !== "ALL") {
      where.status = statusParam;
    }
    if (categorySlug && categorySlug !== "all") {
      where.category = { slug: categorySlug };
    }
    if (mineOnly && user) {
      where.customerId = user.id;
    }
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    const briefs = await db.openBrief.findMany({
      where,
      include: {
        category: { select: { id: true, slug: true, name: true } },
        customer: { select: { id: true, name: true, avatarUrl: true } },
        bids: {
          where: { status: { not: "WITHDRAWN" } },
          include: {
            creatorProfile: {
              select: {
                id: true,
                username: true,
                displayName: true,
                creatorTier: true,
                assessmentScore: true,
                ratingAverage: true,
                taglineBadge: true,
                availableNowBadgeUntil: true,
                featuredProfileUntil: true,
                user: { select: { avatarUrl: true } },
              },
            },
          },
        },
      },
      orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
    });

    const viewerCreatorId = user?.creatorProfile?.id ?? null;

    const enriched = briefs.map((brief) => {
      const ranked = rankBidsForBrief(brief.bids);
      const isOwner = user?.id === brief.customerId;
      const prices = ranked.map((b) => b.proposedPrice);
      const minBid = prices.length ? Math.min(...prices) : null;
      const maxBid = prices.length ? Math.max(...prices) : null;
      const avgBid = prices.length
        ? Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length)
        : null;

      const myBid = viewerCreatorId
        ? ranked.find((b) => b.creatorProfileId === viewerCreatorId) ?? null
        : null;

      const topPreview = ranked.slice(0, 3).map((b) => {
        const redacted =
          (brief.isSealed || b.isSealed) &&
          !isOwner &&
          b.creatorProfileId !== viewerCreatorId;
        return {
          id: b.id,
          rankPosition: b.rankPosition,
          isTopBoostedSlot: b.isTopBoostedSlot,
          isFeatured: b.isFeatured,
          isSealed: b.isSealed,
          boostConnects: b.boostConnects,
          proposedPrice: redacted ? null : b.proposedPrice,
          deliveryDays: b.deliveryDays,
          creator: {
            username: b.creatorProfile.username,
            displayName: b.creatorProfile.displayName,
            creatorTier: b.creatorProfile.creatorTier,
            taglineBadge: b.creatorProfile.taglineBadge,
            availableNow: isFutureTimestamp(
              b.creatorProfile.availableNowBadgeUntil
            ),
            featured: isFutureTimestamp(b.creatorProfile.featuredProfileUntil),
            ratingAverage: b.creatorProfile.ratingAverage,
            avatarUrl: b.creatorProfile.user?.avatarUrl ?? null,
          },
        };
      });

      return {
        id: brief.id,
        briefRef: brief.briefRef,
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
        expiresAt: brief.expiresAt,
        createdAt: brief.createdAt,
        category: brief.category,
        customer: {
          id: brief.customer.id,
          name: brief.customer.name,
        },
        bidCount: ranked.length,
        bidStats: { minBid, avgBid, maxBid },
        topPreview,
        myBid: myBid
          ? {
              id: myBid.id,
              rankPosition: myBid.rankPosition,
              totalBidders: myBid.totalBidders,
              boostConnects: myBid.boostConnects,
              proposedPrice: myBid.proposedPrice,
              connectsNeededForRank1: myBid.connectsNeededForRank1,
              connectsNeededForTop3: myBid.connectsNeededForTop3,
              isSealed: myBid.isSealed,
              isFeatured: myBid.isFeatured,
            }
          : null,
      };
    });

    return ok({
      briefs: enriched,
      viewerConnectsBalance: user?.creatorProfile?.connectsBalance ?? null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = createBriefSchema.parse(await request.json());

    if (body.budgetMax < body.budgetMin) {
      return fail(
        "INVALID_BUDGET_RANGE",
        "Maximum budget must be greater than or equal to minimum budget.",
        400
      );
    }

    const category = await db.category.findFirst({
      where: {
        OR: [{ id: body.categoryId }, { slug: body.categoryId }],
        isActive: true,
      },
    });
    if (!category) {
      return fail("INVALID_CATEGORY", "Selected category not found.", 404);
    }

    const now = new Date();
    const briefRef = `BRF-${now.getFullYear()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;

    const requiredConnects = calculateRequiredConnectsForBrief(
      body.budgetMax,
      body.isUrgent
    );

    const brief = await db.openBrief.create({
      data: {
        briefRef,
        customerId: user.id,
        categoryId: category.id,
        title: body.title.trim(),
        description: body.description.trim(),
        academicLevel: body.academicLevel.trim(),
        wordCount: body.wordCount,
        citationStyle: body.citationStyle.trim(),
        budgetMin: body.budgetMin,
        budgetMax: body.budgetMax,
        currency: "KES",
        deadlineDays: body.deadlineDays,
        requiredConnects,
        isUrgent: body.isUrgent,
        isSealed: body.isSealed,
        ndaRequired: body.ndaRequired,
        allowTripwireOutline: body.allowTripwireOutline,
        status: "OPEN",
        expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      },
      include: {
        category: { select: { id: true, slug: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
    });

    return ok({ brief }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

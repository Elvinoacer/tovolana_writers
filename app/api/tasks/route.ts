import crypto from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { calculateBookingPricing, isUserProActive } from "@/lib/pricing";
import { computeListingValidityDate } from "@/lib/state-machines";
import { invalidateCachePrefix } from "@/lib/redis";
import { fail, handleApiError, ok } from "@/lib/http";

const createTaskSchema = z.object({
  title: z.string().min(6).max(160),
  shortDescription: z.string().min(10).max(280),
  fullDescription: z.string().min(20).max(6000),
  serviceType: z.string().min(2).max(80),
  categoryId: z.string().min(1),
  pricingType: z.enum(["FIXED", "QUOTE_BASED"]).default("FIXED"),
  basePrice: z.number().positive(),
  currency: z.string().default("KES"),
  deliveryTurnaroundDays: z.number().int().min(1).max(90).default(3),
  maxRevisions: z.number().int().min(0).max(10).default(2),
  manualAcceptanceRequired: z.boolean().default(false),
  validityType: z
    .enum(["STANDARD_30D", "SHORT_14D", "ADMIN_CUSTOM"])
    .default("STANDARD_30D"),
  customValidUntil: z.string().optional(),
  deliverablesSummary: z.array(z.string().min(2)).min(1),
  requirementsConfig: z.array(z.record(z.string(), z.unknown())).optional(),
  revisionPolicy: z.string().min(5).max(1000),
  cancellationPolicy: z.string().min(5).max(1000),
  submitMode: z.enum(["DRAFT", "SUBMIT_REVIEW", "PUBLISH_DIRECT"]).default("DRAFT"),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const userIsPro = user
      ? isUserProActive(user.membershipTier, user.proExpiresAt)
      : false;
    const isAdmin = user?.roles.includes("ADMIN") ?? false;

    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim();
    const categorySlug = params.get("category")?.trim();
    const pricingType = params.get("pricingType");
    const maxPrice = params.get("maxPrice")
      ? Number(params.get("maxPrice"))
      : undefined;
    const minPrice = params.get("minPrice")
      ? Number(params.get("minPrice"))
      : undefined;
    const maxDays = params.get("maxDays")
      ? Number(params.get("maxDays"))
      : undefined;
    const sort = params.get("sort") || "newest";
    const statusFilter = params.get("status");

    const now = new Date();
    const where: Prisma.TaskListingWhereInput = {};

    if (isAdmin && statusFilter) {
      where.status = statusFilter as Prisma.EnumListingStatusFilter;
    } else {
      where.status = "PUBLISHED";
      where.validUntil = { gt: now };
      if (!userIsPro && !isAdmin) {
        where.OR = [
          { proEarlyAccessUntil: null },
          { proEarlyAccessUntil: { lte: now } },
        ];
      }
    }

    if (q) {
      where.AND = [
        {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { shortDescription: { contains: q, mode: "insensitive" } },
            { serviceType: { contains: q, mode: "insensitive" } },
          ],
        },
      ];
    }
    if (categorySlug && categorySlug !== "all") {
      where.category = { slug: categorySlug };
    }
    if (pricingType === "FIXED" || pricingType === "QUOTE_BASED") {
      where.pricingType = pricingType;
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.basePrice = {
        ...(minPrice !== undefined && !Number.isNaN(minPrice)
          ? { gte: minPrice }
          : {}),
        ...(maxPrice !== undefined && !Number.isNaN(maxPrice)
          ? { lte: maxPrice }
          : {}),
      };
    }
    if (maxDays !== undefined && !Number.isNaN(maxDays)) {
      where.deliveryTurnaroundDays = { lte: maxDays };
    }

    const orderBy: Prisma.TaskListingOrderByWithRelationInput =
      sort === "price_asc"
        ? { basePrice: "asc" }
        : sort === "price_desc"
          ? { basePrice: "desc" }
          : sort === "fastest"
            ? { deliveryTurnaroundDays: "asc" }
            : { publishedAt: "desc" };

    const [tasks, config] = await Promise.all([
      db.taskListing.findMany({
        where,
        orderBy,
        include: {
          category: { select: { id: true, slug: true, name: true } },
          creator: {
            select: {
              id: true,
              username: true,
              displayName: true,
              headline: true,
              ratingAverage: true,
              completedBookingsCount: true,
              isAvailable: true,
            },
          },
          _count: { select: { reviews: true } },
        },
      }),
      db.platformConfig.findUnique({ where: { id: "global" } }),
    ]);

    const feePct = config?.standardServiceFeePct ?? 10;
    const proDiscountPct = config?.proFeeDiscountPct ?? 50;

    const enriched = tasks.map((task) => ({
      ...task,
      isProEarlyAccess:
        Boolean(task.proEarlyAccessUntil) &&
        task.proEarlyAccessUntil!.getTime() > now.getTime(),
      pricingPreview: calculateBookingPricing({
        listedPrice: task.basePrice,
        standardServiceFeePct: feePct,
        proFeeDiscountPct: proDiscountPct,
        serviceFeePctOverride: task.serviceFeePctOverride,
        userIsPro,
      }),
    }));

    return ok({ tasks: enriched, total: enriched.length });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const isAdmin = user.roles.includes("ADMIN");
    const isCreator =
      user.roles.includes("CREATOR") &&
      user.creatorProfile?.applicationStatus === "APPROVED";

    if (!isAdmin && !isCreator) {
      return fail(
        "FORBIDDEN",
        "Only approved Creators or Administrators can create task listings.",
        403
      );
    }

    const body = createTaskSchema.parse(await request.json());
    const category = await db.category.findUnique({
      where: { id: body.categoryId },
    });
    if (!category || !category.isActive) {
      return fail(
        "INVALID_CATEGORY",
        "Selected category is inactive or does not exist.",
        400
      );
    }

    const baseSlug = body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    const slug = `${baseSlug}-${crypto.randomBytes(3).toString("hex")}`;

    let status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" = "DRAFT";
    let validUntil: Date | null = null;
    let publishedAt: Date | null = null;

    if (body.submitMode === "PUBLISH_DIRECT") {
      if (!isAdmin) {
        return fail(
          "APPROVAL_REQUIRED",
          "Creator-authored listings must go through administrator review before publication.",
          403
        );
      }
      status = "PUBLISHED";
      publishedAt = new Date();
      validUntil = computeListingValidityDate({
        validityType: body.validityType,
        customValidUntil: body.customValidUntil,
      });
    } else if (body.submitMode === "SUBMIT_REVIEW") {
      status = isAdmin ? "PUBLISHED" : "PENDING_REVIEW";
      if (isAdmin) {
        publishedAt = new Date();
        validUntil = computeListingValidityDate({
          validityType: body.validityType,
          customValidUntil: body.customValidUntil,
        });
      }
    }

    const listing = await db.taskListing.create({
      data: {
        slug,
        title: body.title.trim(),
        shortDescription: body.shortDescription.trim(),
        fullDescription: body.fullDescription.trim(),
        serviceType: body.serviceType.trim(),
        categoryId: category.id,
        creatorId: user.creatorProfile?.id ?? null,
        createdByAdmin: isAdmin && !user.creatorProfile,
        pricingType: body.pricingType,
        basePrice: body.basePrice,
        currency: body.currency,
        deliveryTurnaroundDays: body.deliveryTurnaroundDays,
        maxRevisions: body.maxRevisions,
        manualAcceptanceRequired: body.manualAcceptanceRequired,
        validityType: body.validityType,
        validUntil,
        deliverablesSummary: body.deliverablesSummary,
        requirementsConfig: (body.requirementsConfig ??
          category.requirementsSchema) as Prisma.InputJsonValue,
        revisionPolicy: body.revisionPolicy.trim(),
        cancellationPolicy: body.cancellationPolicy.trim(),
        status,
        publishedAt,
      },
      include: { category: true, creator: true },
    });

    await invalidateCachePrefix("categories:");
    return ok({ listing }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

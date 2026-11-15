import { NextRequest } from "next/server";
import { z } from "zod";
import { MediaAssetPurpose, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/http";

const ALLOWED_PORTFOLIO_ASSET_PURPOSES = new Set<MediaAssetPurpose>([
  MediaAssetPurpose.CREATOR_PORTFOLIO_IMAGE,
  MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT,
  MediaAssetPurpose.GENERAL,
]);

function isAllowedPortfolioUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || /[\x00-\x1f\x7f\s]/.test(trimmed)) return false;
  if (trimmed.startsWith("/api/media/")) {
    return !trimmed.startsWith("//") && !trimmed.includes("..");
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

const safePortfolioUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(isAllowedPortfolioUrl, {
    message: "URL must use https://, http://, or relative /api/media/ paths.",
  });

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(80).optional(),
  headline: z.string().min(6).max(160).optional(),
  bio: z.string().min(20).max(2000).optional(),
  writingCategories: z.array(z.string().min(2)).min(1).optional(),
  isAvailable: z.boolean().optional(),
  autoAcceptBookings: z.boolean().optional(),
  portfolioSamples: z
    .array(
      z.object({
        title: z.string().min(3),
        category: z.string().min(2),
        excerpt: z.string().min(10),
        url: safePortfolioUrlSchema.optional(),
        attachmentUrl: safePortfolioUrlSchema.optional(),
        attachmentName: z.string().trim().min(1).max(200).optional(),
        attachmentAssetId: z.string().trim().min(1).optional(),
        mimeType: z
          .string()
          .trim()
          .min(3)
          .max(120)
          .regex(/^[\x20-\x7e]+$/)
          .optional(),
      })
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user.creatorProfile) {
      return fail(
        "CREATOR_PROFILE_NOT_FOUND",
        "No Creator profile exists yet.",
        404
      );
    }

    const [creatorProfile, attempts, latestAvatarAsset] = await Promise.all([
      db.creatorProfile.findUnique({
        where: { id: user.creatorProfile.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      }),
      db.creatorAssessmentAttempt.findMany({
        where: { creatorProfileId: user.creatorProfile.id },
        orderBy: { createdAt: "desc" },
        include: { config: { select: { title: true, minWords: true, maxWords: true } } },
      }),
      db.mediaAsset.findFirst({
        where: { ownerId: user.id, purpose: MediaAssetPurpose.USER_AVATAR },
        orderBy: { createdAt: "desc" },
        select: { id: true, publicUrl: true },
      }),
    ]);

    const currentAvatarUrl = creatorProfile?.user?.avatarUrl ?? null;
    const avatarAssetId =
      latestAvatarAsset &&
      currentAvatarUrl &&
      ((Boolean(latestAvatarAsset.publicUrl) &&
        currentAvatarUrl === latestAvatarAsset.publicUrl) ||
        currentAvatarUrl === `/api/media/${latestAvatarAsset.id}/raw`)
        ? latestAvatarAsset.id
        : null;

    return ok({
      creatorProfile,
      attempts,
      avatarAssetId,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user.creatorProfile) {
      return fail("CREATOR_PROFILE_NOT_FOUND", "No Creator profile.", 404);
    }

    const body = updateProfileSchema.parse(await request.json());

    if (body.portfolioSamples && body.portfolioSamples.length > 0) {
      const assetIds = [
        ...new Set(
          body.portfolioSamples
            .map((sample) => sample.attachmentAssetId)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      if (assetIds.length > 0) {
        const assets = await db.mediaAsset.findMany({
          where: { id: { in: assetIds } },
          select: { id: true, ownerId: true, purpose: true },
        });
        const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
        const isAdmin = user.roles.includes("ADMIN");

        for (const assetId of assetIds) {
          const asset = assetMap.get(assetId);
          if (!asset) {
            return fail(
              "INVALID_MEDIA_ASSET",
              "Referenced portfolio media asset was not found.",
              400
            );
          }
          if (!isAdmin && asset.ownerId !== user.id) {
            return fail(
              "FORBIDDEN",
              "You can only attach portfolio media assets that you own.",
              403
            );
          }
          if (!ALLOWED_PORTFOLIO_ASSET_PURPOSES.has(asset.purpose)) {
            return fail(
              "INVALID_MEDIA_ASSET_PURPOSE",
              "Only portfolio or general media assets can be attached to portfolio samples.",
              400
            );
          }
        }
      }
    }

    const updated = await db.creatorProfile.update({
      where: { id: user.creatorProfile.id },
      data: {
        displayName: body.displayName?.trim(),
        headline: body.headline?.trim(),
        bio: body.bio?.trim(),
        writingCategories: body.writingCategories,
        isAvailable: body.isAvailable,
        autoAcceptBookings: body.autoAcceptBookings,
        portfolioSamples: body.portfolioSamples as
          | Prisma.InputJsonValue
          | undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return ok({ creatorProfile: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

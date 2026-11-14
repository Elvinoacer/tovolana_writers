import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/http";

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

    const attempts = await db.creatorAssessmentAttempt.findMany({
      where: { creatorProfileId: user.creatorProfile.id },
      orderBy: { createdAt: "desc" },
      include: { config: { select: { title: true, minWords: true, maxWords: true } } },
    });

    return ok({
      creatorProfile: user.creatorProfile,
      attempts,
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
    });

    return ok({ creatorProfile: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

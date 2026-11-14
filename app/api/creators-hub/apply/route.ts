import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/http";

const applySchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/i),
  displayName: z.string().min(2).max(80),
  headline: z.string().min(6).max(160),
  bio: z.string().min(20).max(1500),
  writingCategories: z.array(z.string().min(2)).min(1),
  academicIntegrityAccepted: z.literal(true),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = applySchema.parse(await request.json());
    const normalizedUsername = body.username.toLowerCase();

    const usernameOwner = await db.creatorProfile.findUnique({
      where: { username: normalizedUsername },
    });
    if (usernameOwner && usernameOwner.userId !== user.id) {
      return fail(
        "USERNAME_TAKEN",
        "That creator handle is already taken.",
        409
      );
    }

    const creatorProfile = await db.creatorProfile.upsert({
      where: { userId: user.id },
      update: {
        username: normalizedUsername,
        displayName: body.displayName.trim(),
        headline: body.headline.trim(),
        bio: body.bio.trim(),
        writingCategories: body.writingCategories,
        academicIntegrityAccepted: true,
      },
      create: {
        userId: user.id,
        username: normalizedUsername,
        displayName: body.displayName.trim(),
        headline: body.headline.trim(),
        bio: body.bio.trim(),
        writingCategories: body.writingCategories,
        academicIntegrityAccepted: true,
        applicationStatus: "NOT_APPLIED",
      },
    });

    return ok({ creatorProfile }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

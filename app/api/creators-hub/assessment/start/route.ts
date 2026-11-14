import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const creatorProfile = await db.creatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!creatorProfile || !creatorProfile.academicIntegrityAccepted) {
      return fail(
        "ONBOARDING_REQUIRED",
        "Complete the Creator onboarding step and accept the academic integrity pledge first.",
        400
      );
    }

    if (
      creatorProfile.applicationStatus === "APPROVED" &&
      user.roles.includes("CREATOR")
    ) {
      return fail(
        "ALREADY_APPROVED",
        "Your Creator status is already approved.",
        400
      );
    }

    if (
      creatorProfile.cooldownUntil &&
      creatorProfile.cooldownUntil.getTime() > Date.now()
    ) {
      return fail(
        "COOLDOWN_ACTIVE",
        `You may retake the writing assessment after ${creatorProfile.cooldownUntil.toDateString()}.`,
        429
      );
    }

    const config = await db.assessmentConfig.findFirst({
      where: { isActive: true },
    });
    if (!config) {
      return fail(
        "ASSESSMENT_UNAVAILABLE",
        "Assessment configuration not found.",
        500
      );
    }

    // Reuse an unsubmitted in-progress attempt if present
    const existingOpen = await db.creatorAssessmentAttempt.findFirst({
      where: {
        creatorProfileId: creatorProfile.id,
        submittedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    const attempt =
      existingOpen ??
      (await db.creatorAssessmentAttempt.create({
        data: {
          creatorProfileId: creatorProfile.id,
          configId: config.id,
        },
      }));

    await db.creatorProfile.update({
      where: { id: creatorProfile.id },
      data: { applicationStatus: "ASSESSMENT_IN_PROGRESS" },
    });

    return ok({ attempt, config }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

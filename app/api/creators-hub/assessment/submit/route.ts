import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { evaluateWritingAssessment } from "@/lib/assessment-evaluator";
import { enqueueNotificationInTx } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

const submitSchema = z.object({
  attemptId: z.string().min(1),
  responseText: z.string().min(30).max(20000),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = submitSchema.parse(await request.json());

    const attempt = await db.creatorAssessmentAttempt.findUnique({
      where: { id: body.attemptId },
      include: {
        creatorProfile: true,
        config: true,
      },
    });

    if (!attempt || attempt.creatorProfile.userId !== user.id) {
      return fail("NOT_FOUND", "Assessment attempt not found.", 404);
    }
    if (attempt.submittedAt) {
      return fail(
        "ALREADY_SUBMITTED",
        "This assessment attempt has already been evaluated.",
        409
      );
    }

    const weights = attempt.config.rubricWeights as Record<string, number>;
    const evaluation = evaluateWritingAssessment({
      responseText: body.responseText,
      promptText: attempt.config.promptText,
      minWords: attempt.config.minWords,
      maxWords: attempt.config.maxWords,
      passScoreThreshold: attempt.config.passScoreThreshold,
      reviewScoreThreshold: attempt.config.reviewScoreThreshold,
      weights,
    });

    const cooldownUntil =
      evaluation.autoDecision === "REJECTED"
        ? new Date(
            Date.now() + attempt.config.cooldownDays * 24 * 60 * 60 * 1000
          )
        : null;

    const result = await db.$transaction(async (tx) => {
      const updatedAttempt = await tx.creatorAssessmentAttempt.update({
        where: { id: attempt.id },
        data: {
          submittedAt: new Date(),
          responseText: body.responseText.trim(),
          wordCount: evaluation.wordCount,
          grammarScore: evaluation.grammarScore,
          coherenceScore: evaluation.coherenceScore,
          instructionScore: evaluation.instructionScore,
          originalityScore: evaluation.originalityScore,
          toneScore: evaluation.toneScore,
          researchScore: evaluation.researchScore,
          totalScore: evaluation.totalScore,
          autoDecision: evaluation.autoDecision,
          reviewNote: evaluation.feedbackSummary,
        },
      });

      const updatedProfile = await tx.creatorProfile.update({
        where: { id: attempt.creatorProfileId },
        data: {
          applicationStatus: evaluation.autoDecision,
          assessmentScore: evaluation.totalScore,
          assessmentAttemptCount: { increment: 1 },
          cooldownUntil,
        },
      });

      if (evaluation.autoDecision === "APPROVED") {
        const nextRoles = Array.from(
          new Set([...user.roles, "CREATOR" as const])
        );
        await tx.user.update({
          where: { id: user.id },
          data: { roles: nextRoles },
        });

        await enqueueNotificationInTx(tx, {
          userId: user.id,
          eventType: "CREATOR_APPROVED",
          title: "You Are Approved as a Writer!",
          body: `Your writing test scored ${evaluation.totalScore}/100. You can now open your Writer Hub and start working.`,
          linkUrl: "/creators-hub",
        });
      } else {
        await enqueueNotificationInTx(tx, {
          userId: user.id,
          eventType: "CREATOR_ASSESSMENT_RESULT",
          title: `Writing Test Update: ${evaluation.autoDecision.replace(/_/g, " ")}`,
          body: evaluation.feedbackSummary,
          linkUrl: "/creators-hub/status",
        });
      }

      return { updatedAttempt, updatedProfile };
    });

    return ok({
      attempt: result.updatedAttempt,
      creatorProfile: result.updatedProfile,
      evaluation,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

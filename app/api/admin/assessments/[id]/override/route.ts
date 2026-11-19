import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/auth";
import { enqueueNotificationInTx } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

const overrideSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().min(5).max(1000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminScope("MODERATION_ADMIN", request);
    const { id } = await context.params;
    const body = overrideSchema.parse(await request.json());

    const attempt = await db.creatorAssessmentAttempt.findUnique({
      where: { id },
      include: {
        creatorProfile: { include: { user: true } },
        config: true,
      },
    });
    if (!attempt) {
      return fail("NOT_FOUND", "Assessment attempt not found.", 404);
    }

    const result = await db.$transaction(async (tx) => {
      const updatedAttempt = await tx.creatorAssessmentAttempt.update({
        where: { id },
        data: {
          autoDecision: body.decision,
          reviewerAdminId: admin.id,
          reviewNote: body.reviewNote.trim(),
        },
      });

      const updatedProfile = await tx.creatorProfile.update({
        where: { id: attempt.creatorProfileId },
        data: {
          applicationStatus: body.decision,
          cooldownUntil:
            body.decision === "REJECTED"
              ? new Date(
                  Date.now() + attempt.config.cooldownDays * 24 * 60 * 60 * 1000
                )
              : null,
        },
      });

      if (body.decision === "APPROVED") {
        const nextRoles = Array.from(
          new Set([...attempt.creatorProfile.user.roles, "CREATOR" as const])
        );
        await tx.user.update({
          where: { id: attempt.creatorProfile.userId },
          data: { roles: nextRoles },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          actorAdminId: admin.id,
          action: `ASSESSMENT_OVERRIDE_${body.decision}`,
          targetType: "CreatorAssessmentAttempt",
          targetId: id,
          reason: body.reviewNote.trim(),
          metadata: {
            creatorProfileId: attempt.creatorProfileId,
            score: attempt.totalScore,
          },
        },
      });

      await enqueueNotificationInTx(tx, {
        userId: attempt.creatorProfile.userId,
        eventType: "CREATOR_ASSESSMENT_REVIEWED",
        title: `Writer Application ${body.decision === "APPROVED" ? "Approved" : "Update"}`,
        body:
          body.decision === "APPROVED"
            ? "Our team approved your writing test. Your Writer Hub is now open."
            : `Writing test update: ${body.reviewNote.trim()}`,
        linkUrl: body.decision === "APPROVED" ? "/creators-hub" : "/creators-hub/status",
      });

      return { updatedAttempt, updatedProfile };
    });

    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}

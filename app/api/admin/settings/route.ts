import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminScope, requireRole } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/http";

const updatePlatformConfigSchema = z.object({
  standardServiceFeePct: z.number().min(0).max(50).optional(),
  proFeeDiscountPct: z.number().min(0).max(100).optional(),
  proMonthlyPrice: z.number().positive().optional(),
  proAnnualPrice: z.number().positive().optional(),
  archiveRecoveryDays: z.number().int().min(1).max(90).optional(),
  defaultRevisionLimit: z.number().int().min(0).max(10).optional(),
  proEarlyAccessHours: z.number().int().min(0).max(168).optional(),
  announcementBanner: z.string().max(500).nullable().optional(),
  academicIntegrityPolicy: z.string().min(10).optional(),
  revisionPolicyText: z.string().min(10).optional(),
  cancellationPolicyText: z.string().min(10).optional(),
  reason: z.string().min(4).max(300).default("Platform configuration update"),
});

export async function GET(request: NextRequest) {
  try {
    await requireRole("ADMIN", request);
    const [config, auditLogs] = await Promise.all([
      db.platformConfig.findUnique({ where: { id: "global" } }),
      db.adminAuditLog.findMany({
        include: { actorAdmin: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return ok({ config, auditLogs });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminScope("SUPER_ADMIN", request);
    const body = updatePlatformConfigSchema.parse(await request.json());

    const { reason, ...fields } = body;
    const updated = await db.$transaction(async (tx) => {
      const saved = await tx.platformConfig.update({
        where: { id: "global" },
        data: fields,
      });

      await tx.adminAuditLog.create({
        data: {
          actorAdminId: admin.id,
          action: "PLATFORM_CONFIG_UPDATED",
          targetType: "PlatformConfig",
          targetId: "global",
          reason: reason.trim(),
          metadata: fields,
        },
      });

      return saved;
    });

    return ok({ config: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

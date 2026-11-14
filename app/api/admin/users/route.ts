import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/http";

const patchUserSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION"]).optional(),
  roles: z.array(z.enum(["CUSTOMER", "CREATOR", "ADMIN"])).min(1).optional(),
  adminScopes: z
    .array(
      z.enum([
        "SUPER_ADMIN",
        "MODERATION_ADMIN",
        "FINANCE_ADMIN",
        "SUPPORT_ADMIN",
      ])
    )
    .optional(),
  membershipTier: z.enum(["FREE", "PRO"]).optional(),
  proDays: z.number().int().min(1).max(730).optional(),
  reason: z.string().min(4).max(500),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminScope("SUPPORT_ADMIN", request);
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const users = await db.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        roles: true,
        adminScopes: true,
        status: true,
        membershipTier: true,
        proExpiresAt: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        creatorProfile: {
          select: {
            id: true,
            username: true,
            applicationStatus: true,
            assessmentScore: true,
            completedBookingsCount: true,
          },
        },
        _count: { select: { customerBookings: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok({ users });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminScope("SUPER_ADMIN", request);
    const body = patchUserSchema.parse(await request.json());

    const target = await db.user.findUnique({ where: { id: body.userId } });
    if (!target) return fail("NOT_FOUND", "User not found.", 404);

    if (target.id === admin.id && body.status === "SUSPENDED") {
      return fail(
        "CANNOT_SUSPEND_SELF",
        "Administrators cannot suspend their own active session account.",
        400
      );
    }

    const proExpiresAt =
      body.membershipTier === "PRO"
        ? new Date(Date.now() + (body.proDays ?? 30) * 24 * 60 * 60 * 1000)
        : body.membershipTier === "FREE"
          ? null
          : undefined;

    const updated = await db.$transaction(async (tx) => {
      const saved = await tx.user.update({
        where: { id: target.id },
        data: {
          status: body.status,
          roles: body.roles,
          adminScopes: body.adminScopes,
          membershipTier: body.membershipTier,
          proExpiresAt,
        },
        select: {
          id: true,
          email: true,
          name: true,
          roles: true,
          adminScopes: true,
          status: true,
          membershipTier: true,
          proExpiresAt: true,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          actorAdminId: admin.id,
          action: "USER_GOVERNANCE_UPDATED",
          targetType: "User",
          targetId: target.id,
          reason: body.reason.trim(),
          metadata: {
            status: saved.status,
            roles: saved.roles,
            adminScopes: saved.adminScopes,
            membershipTier: saved.membershipTier,
          },
        },
      });

      return saved;
    });

    return ok({ user: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

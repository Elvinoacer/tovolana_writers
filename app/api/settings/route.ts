import { NextRequest } from "next/server";
import { z } from "zod";
import { MediaAssetPurpose, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword, requireAuth, verifyPassword } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/http";

const updateSettingsSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: z.string().max(24).optional(),
  preferredLocale: z.string().max(20).optional(),
  clearAvatar: z.boolean().optional(),
  notificationPrefs: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      inApp: z.boolean().optional(),
      sms: z.boolean().optional(),
    })
    .optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const [customerProfile, authAccounts, latestAvatarAsset] = await Promise.all([
      db.customerProfile.findUnique({ where: { userId: user.id } }),
      db.authAccount.findMany({
        where: { userId: user.id },
        select: { provider: true, createdAt: true },
      }),
      db.mediaAsset.findFirst({
        where: { ownerId: user.id, purpose: MediaAssetPurpose.USER_AVATAR },
        orderBy: { createdAt: "desc" },
        select: { id: true, publicUrl: true },
      }),
    ]);

    const avatarAssetId =
      latestAvatarAsset &&
      user.avatarUrl &&
      ((Boolean(latestAvatarAsset.publicUrl) &&
        user.avatarUrl === latestAvatarAsset.publicUrl) ||
        user.avatarUrl === `/api/media/${latestAvatarAsset.id}/raw`)
        ? latestAvatarAsset.id
        : null;

    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        avatarAssetId,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        membershipTier: user.membershipTier,
        proExpiresAt: user.proExpiresAt,
        roles: user.roles,
      },
      customerProfile,
      authAccounts,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = updateSettingsSchema.parse(await request.json());

    let nextPasswordHash = user.passwordHash;
    if (body.newPassword) {
      if (user.passwordHash) {
        if (
          !body.currentPassword ||
          !verifyPassword(body.currentPassword, user.passwordHash)
        ) {
          return fail(
            "INVALID_CURRENT_PASSWORD",
            "Current password does not match.",
            400
          );
        }
      }
      nextPasswordHash = hashPassword(body.newPassword);
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        name: body.name?.trim(),
        phone: body.phone !== undefined ? body.phone.trim() || null : undefined,
        avatarUrl: body.clearAvatar ? null : undefined,
        passwordHash: nextPasswordHash,
      },
    });

    if (body.preferredLocale || body.notificationPrefs) {
      await db.customerProfile.upsert({
        where: { userId: user.id },
        update: {
          preferredLocale: body.preferredLocale,
          notificationPrefs: body.notificationPrefs as
            | Prisma.InputJsonValue
            | undefined,
        },
        create: {
          userId: user.id,
          preferredLocale: body.preferredLocale ?? "en-KE",
          notificationPrefs: (body.notificationPrefs ?? {
            email: true,
            push: true,
            inApp: true,
            sms: false,
          }) as Prisma.InputJsonValue,
        },
      });
    }

    return ok({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        phone: updated.phone,
        avatarUrl: updated.avatarUrl,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

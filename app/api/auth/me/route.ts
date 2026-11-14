import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isUserProActive } from "@/lib/pricing";
import { ok } from "@/lib/http";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return ok({ user: null, unreadNotifications: 0 });
  }

  const unreadNotifications = await db.notificationOutbox.count({
    where: {
      userId: user.id,
      channel: "IN_APP",
      readAt: null,
    },
  });

  return ok({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      roles: user.roles,
      adminScopes: user.adminScopes,
      status: user.status,
      membershipTier: isUserProActive(user.membershipTier, user.proExpiresAt)
        ? "PRO"
        : "FREE",
      proExpiresAt: user.proExpiresAt,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      customerProfile: user.customerProfile,
      creatorProfile: user.creatorProfile,
    },
    unreadNotifications,
  });
}

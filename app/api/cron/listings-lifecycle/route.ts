import crypto from "crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { computeArchiveExpiryDate } from "@/lib/state-machines";
import { invalidateCachePrefix } from "@/lib/redis";
import { fail, handleApiError, ok } from "@/lib/http";

function verifyCronSecret(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  const a = crypto.createHash("sha256").update(token).digest();
  const b = crypto.createHash("sha256").update(env.cronSecret).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  return runLifecycleSweep(request);
}

export async function GET(request: NextRequest) {
  return runLifecycleSweep(request);
}

async function runLifecycleSweep(request: NextRequest) {
  try {
    const validSecret = verifyCronSecret(request);
    if (!validSecret) {
      const user = await getCurrentUser(request);
      if (!user || !user.roles.includes("ADMIN")) {
        return fail("UNAUTHORIZED", "Valid CRON_SECRET or Admin required.", 401);
      }
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const config = await db.platformConfig.findUnique({
      where: { id: "global" },
    });
    const archiveDays = config?.archiveRecoveryDays ?? 14;

    // 1. Mark expired PUBLISHED listings as EXPIRED (confirmed bookings unaffected!)
    const expiredResult = await db.taskListing.updateMany({
      where: {
        status: "PUBLISHED",
        validUntil: { lte: now },
      },
      data: { status: "EXPIRED" },
    });

    // 2. Move older expired listings into 14-day recovery archive vault
    const archivedResult = await db.taskListing.updateMany({
      where: {
        status: "EXPIRED",
        validUntil: { lte: sevenDaysAgo },
      },
      data: {
        status: "ARCHIVED",
        archiveExpiresAt: computeArchiveExpiryDate(archiveDays, now),
      },
    });

    // 3. Revert lapsed PRO subscriptions gracefully to FREE without losing history
    const expiredProUsers = await db.user.updateMany({
      where: {
        membershipTier: "PRO",
        proExpiresAt: { lte: now },
      },
      data: { membershipTier: "FREE" },
    });

    await db.membershipSubscription.updateMany({
      where: {
        status: "ACTIVE",
        currentPeriodEnd: { lte: now },
      },
      data: { status: "EXPIRED" },
    });

    await invalidateCachePrefix("categories:");

    return ok({
      expiredListingsCount: expiredResult.count,
      archivedListingsCount: archivedResult.count,
      revertedProUsersCount: expiredProUsers.count,
      executedAt: now.toISOString(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

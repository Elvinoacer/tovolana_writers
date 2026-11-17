import crypto from "crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { enqueueNotification } from "@/lib/notifications";
import { invalidateCachePrefix } from "@/lib/redis";
import { computeArchiveExpiryDate } from "@/lib/state-machines";

function extractCronToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const customSecret = request.headers.get("x-cron-secret")?.trim();
  if (customSecret) return customSecret;

  return null;
}

export function verifyCronSecret(request: NextRequest): boolean {
  const token = extractCronToken(request);
  if (!token || !env.cronSecret) return false;

  const providedHash = crypto.createHash("sha256").update(token).digest();
  const expectedHash = crypto
    .createHash("sha256")
    .update(env.cronSecret)
    .digest();

  return crypto.timingSafeEqual(providedHash, expectedHash);
}

export async function isAuthorizedCronOrAdmin(
  request: NextRequest
): Promise<boolean> {
  if (verifyCronSecret(request)) return true;
  const user = await getCurrentUser(request);
  return Boolean(user && user.roles.includes("ADMIN"));
}

/**
 * Expires lapsed published listings, moves older expired listings to the recovery archive,
 * downgrades expired Pro memberships, and expires past-due open bidding briefs.
 */
export async function runListingsLifecycleSweep() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const config = await db.platformConfig.findUnique({
    where: { id: "global" },
  });
  const archiveDays = config?.archiveRecoveryDays ?? 14;

  // 1. Mark expired PUBLISHED listings as EXPIRED (confirmed bookings unaffected)
  const expiredResult = await db.taskListing.updateMany({
    where: {
      status: "PUBLISHED",
      validUntil: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  // 2. Move older expired listings into recovery archive vault
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

  // 4. Expire past-due OPEN bidding briefs
  const expiredBriefs = await db.openBrief.updateMany({
    where: {
      status: "OPEN",
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  await invalidateCachePrefix("categories:");

  return {
    expiredListingsCount: expiredResult.count,
    archivedListingsCount: archivedResult.count,
    revertedProUsersCount: expiredProUsers.count,
    expiredBriefsCount: expiredBriefs.count,
    executedAt: now.toISOString(),
  };
}

/**
 * Queues <24h delivery deadline alert notifications for active bookings.
 */
export async function runDeadlineAlertsSweep() {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const dueSoonBookings = await db.booking.findMany({
    where: {
      status: {
        in: ["IN_PROGRESS", "PAID_AWAITING_ACCEPTANCE", "REVISION_REQUESTED"],
      },
      agreedDeliveryDeadline: { lte: in24Hours, gt: now },
    },
    include: {
      creator: true,
    },
  });

  let alertedCount = 0;
  for (const booking of dueSoonBookings) {
    if (booking.creator) {
      await enqueueNotification({
        userId: booking.creator.userId,
        eventType: "DELIVERY_DEADLINE_ALERT_24H",
        title: `Deadline Reminder (<24h): ${booking.bookingRef}`,
        body: `Booking "${booking.taskTitleSnapshot}" is due on ${booking.agreedDeliveryDeadline.toISOString()}.`,
        linkUrl: `/creators-hub/bookings/${booking.bookingRef}`,
        payload: { bookingRef: booking.bookingRef },
      });
      alertedCount += 1;
    }
  }

  return {
    checked: dueSoonBookings.length,
    alertedCount,
    executedAt: now.toISOString(),
  };
}

import crypto from "crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { enqueueNotification } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

function verifyCronSecret(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  const a = crypto.createHash("sha256").update(token).digest();
  const b = crypto.createHash("sha256").update(env.cronSecret).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  return handleDeadlineAlerts(request);
}

export async function POST(request: NextRequest) {
  return handleDeadlineAlerts(request);
}

async function handleDeadlineAlerts(request: NextRequest) {
  try {
    if (!verifyCronSecret(request)) {
      const user = await getCurrentUser(request);
      if (!user || !user.roles.includes("ADMIN")) {
        return fail("UNAUTHORIZED", "Valid CRON_SECRET or Admin required.", 401);
      }
    }

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

    return ok({ checked: dueSoonBookings.length, alertedCount });
  } catch (err) {
    return handleApiError(err);
  }
}

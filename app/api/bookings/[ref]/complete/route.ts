import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { enqueueNotificationInTx } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

const completeSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ref: string }> }
) {
  try {
    const { ref } = await context.params;
    const user = await requireAuth(request);
    const raw = await request.json().catch(() => ({}));
    const body = completeSchema.parse(raw);

    const booking = await db.booking.findFirst({
      where: { OR: [{ bookingRef: ref }, { id: ref }] },
      include: { creator: true },
    });

    if (!booking) {
      return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
    }
    if (booking.customerId !== user.id) {
      return fail(
        "FORBIDDEN",
        "Only the customer can approve final completion.",
        403
      );
    }
    if (
      booking.status !== "DELIVERED" &&
      booking.status !== "REVISION_REQUESTED"
    ) {
      return fail(
        "INVALID_STATUS",
        `Cannot complete booking in status ${booking.status}.`,
        409
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const saved = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      await tx.creatorEarningsLedger.updateMany({
        where: { bookingId: booking.id, status: "PENDING_ESCROW" },
        data: {
          status: "AVAILABLE",
          availableAt: new Date(),
        },
      });

      if (body.rating && booking.creatorId) {
        await tx.review.upsert({
          where: { bookingId: booking.id },
          update: {
            rating: body.rating,
            comment: body.comment?.trim() || "Completed cleanly.",
          },
          create: {
            bookingId: booking.id,
            taskId: booking.taskId,
            customerId: user.id,
            creatorId: booking.creatorId,
            rating: body.rating,
            comment: body.comment?.trim() || "Completed cleanly.",
          },
        });

        const agg = await tx.review.aggregate({
          where: { creatorId: booking.creatorId },
          _avg: { rating: true },
        });
        await tx.creatorProfile.update({
          where: { id: booking.creatorId },
          data: {
            completedBookingsCount: { increment: 1 },
            ratingAverage: Math.round((agg._avg.rating ?? 5) * 10) / 10,
          },
        });
      } else if (booking.creatorId) {
        await tx.creatorProfile.update({
          where: { id: booking.creatorId },
          data: { completedBookingsCount: { increment: 1 } },
        });
      }

      await tx.bookingMessage.create({
        data: {
          bookingId: booking.id,
          senderId: user.id,
          isSystemMessage: true,
          body: `Booking marked COMPLETED by customer. Escrow funds (${booking.currency} ${booking.creatorNetAmount.toLocaleString()}) released to Creator available balance.`,
        },
      });

      if (booking.creator) {
        await enqueueNotificationInTx(tx, {
          userId: booking.creator.userId,
          eventType: "BOOKING_COMPLETED_ESCROW_RELEASED",
          title: `Booking Completed: ${booking.bookingRef}`,
          body: `Escrow cleared! ${booking.currency} ${booking.creatorNetAmount.toLocaleString()} is now available for payout.`,
          linkUrl: `/creators-hub/earnings`,
        });
      }

      return saved;
    });

    return ok({ booking: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

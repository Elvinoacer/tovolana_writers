import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { enqueueNotificationInTx } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

const acceptSchema = z.object({
  decision: z.enum(["ACCEPT", "DECLINE"]),
  note: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ref: string }> }
) {
  try {
    const { ref } = await context.params;
    const user = await requireRole("CREATOR", request);
    const body = acceptSchema.parse(await request.json());

    const booking = await db.booking.findFirst({
      where: { OR: [{ bookingRef: ref }, { id: ref }] },
    });

    if (!booking) {
      return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
    }
    if (booking.creatorId !== user.creatorProfile?.id) {
      return fail("FORBIDDEN", "Not assigned creator for this booking.", 403);
    }
    if (booking.status !== "PAID_AWAITING_ACCEPTANCE") {
      return fail(
        "INVALID_STATUS",
        `Booking cannot be accepted/declined from status ${booking.status}.`,
        409
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const nextStatus =
        body.decision === "ACCEPT" ? "IN_PROGRESS" : "CANCELLED";

      const saved = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: nextStatus,
          ...(body.decision === "DECLINE"
            ? {
                cancelledAt: new Date(),
                cancellationReason:
                  body.note || "Creator declined paid booking prior to starting.",
              }
            : {}),
        },
      });

      if (body.decision === "DECLINE") {
        await tx.creatorEarningsLedger.updateMany({
          where: { bookingId: booking.id },
          data: { status: "REVERSED" },
        });
      }

      await tx.bookingMessage.create({
        data: {
          bookingId: booking.id,
          senderId: user.id,
          isSystemMessage: true,
          body:
            body.decision === "ACCEPT"
              ? `Creator accepted the booking and work is now in progress.`
              : `Creator declined booking (${body.note || "No reason stated"}). Eligible for administrator refund processing.`,
        },
      });

      await enqueueNotificationInTx(tx, {
        userId: booking.customerId,
        eventType:
          body.decision === "ACCEPT" ? "BOOKING_ACCEPTED" : "BOOKING_DECLINED",
        title:
          body.decision === "ACCEPT"
            ? `Creator Started Work: ${booking.bookingRef}`
            : `Creator Declined: ${booking.bookingRef}`,
        body:
          body.decision === "ACCEPT"
            ? `Your creator accepted booking ${booking.bookingRef}. Delivery due ${booking.agreedDeliveryDeadline.toDateString()}.`
            : `Your creator was unable to accept ${booking.bookingRef}. Our finance desk is queued to process your refund.`,
        linkUrl: `/dashboard/bookings/${booking.bookingRef}`,
      });

      return saved;
    });

    return ok({ booking: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

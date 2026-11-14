import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { enqueueNotificationInTx } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

const disputeSchema = z.object({
  action: z.enum(["CANCEL", "DISPUTE"]).default("DISPUTE"),
  reason: z.string().min(5).max(300),
  details: z.string().min(10).max(3000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ref: string }> }
) {
  try {
    const { ref } = await context.params;
    const user = await requireAuth(request);
    const body = disputeSchema.parse(await request.json());

    const booking = await db.booking.findFirst({
      where: { OR: [{ bookingRef: ref }, { id: ref }] },
      include: { creator: true },
    });

    if (!booking) {
      return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
    }

    const isCustomer = booking.customerId === user.id;
    const isCreator = booking.creatorId === user.creatorProfile?.id;
    if (!isCustomer && !isCreator) {
      return fail("FORBIDDEN", "Permission denied.", 403);
    }

    if (
      body.action === "CANCEL" &&
      (booking.status === "PENDING_PAYMENT" ||
        booking.status === "PAID_AWAITING_ACCEPTANCE")
    ) {
      const cancelled = await db.$transaction(async (tx) => {
        const saved = await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: body.reason.trim(),
          },
        });
        await tx.bookingMessage.create({
          data: {
            bookingId: booking.id,
            senderId: user.id,
            isSystemMessage: true,
            body: `Booking cancelled (${body.reason.trim()}).`,
          },
        });
        return saved;
      });
      return ok({ booking: cancelled, mode: "CANCELLED" });
    }

    if (
      booking.status === "CANCELLED" ||
      booking.status === "REFUNDED" ||
      booking.status === "DISPUTED"
    ) {
      return fail(
        "INVALID_DISPUTE_STATE",
        `Cannot open dispute in status ${booking.status}.`,
        409
      );
    }

    const result = await db.$transaction(async (tx) => {
      const dispute = await tx.dispute.upsert({
        where: { bookingId: booking.id },
        update: {
          reason: body.reason.trim(),
          details: body.details.trim(),
          status: "OPEN",
        },
        create: {
          bookingId: booking.id,
          openedById: user.id,
          reason: body.reason.trim(),
          details: body.details.trim(),
          status: "OPEN",
        },
      });

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "DISPUTED" },
      });

      await tx.bookingMessage.create({
        data: {
          bookingId: booking.id,
          senderId: user.id,
          isSystemMessage: true,
          body: `Dispute opened: ${body.reason.trim()}. Administrator tribunal notified.`,
        },
      });

      const counterpartyId = isCustomer
        ? booking.creator?.userId
        : booking.customerId;
      if (counterpartyId) {
        await enqueueNotificationInTx(tx, {
          userId: counterpartyId,
          eventType: "DISPUTE_OPENED",
          title: `Dispute Opened: ${booking.bookingRef}`,
          body: `${user.name} opened a dispute ("${body.reason.trim()}"). Administrators will review escrow evidence.`,
          linkUrl: isCustomer
            ? `/creators-hub/bookings/${booking.bookingRef}`
            : `/dashboard/bookings/${booking.bookingRef}`,
        });
      }

      return { dispute, booking: updatedBooking };
    });

    return ok(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

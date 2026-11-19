import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { enqueueNotificationInTx } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

const deliverSchema = z.object({
  deliverySummary: z.string().min(10).max(4000),
  fileIds: z.array(z.string()).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ref: string }> }
) {
  try {
    const { ref } = await context.params;
    const user = await requireRole("CREATOR", request);
    const body = deliverSchema.parse(await request.json());

    const booking = await db.booking.findFirst({
      where: { OR: [{ bookingRef: ref }, { id: ref }] },
    });

    if (!booking) {
      return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
    }
    if (booking.creatorId !== user.creatorProfile?.id) {
      return fail("FORBIDDEN", "Only the assigned creator can deliver.", 403);
    }
    if (
      booking.status !== "IN_PROGRESS" &&
      booking.status !== "REVISION_REQUESTED"
    ) {
      return fail(
        "INVALID_STATUS",
        `Cannot submit delivery while booking is ${booking.status}.`,
        409
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const saved = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
        },
      });

      await tx.bookingRevision.updateMany({
        where: { bookingId: booking.id, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });

      await tx.bookingMessage.create({
        data: {
          bookingId: booking.id,
          senderId: user.id,
          isSystemMessage: false,
          body: `Finished Work Sent:\n${body.deliverySummary.trim()}`,
        },
      });

      await enqueueNotificationInTx(tx, {
        userId: booking.customerId,
        eventType: "BOOKING_DELIVERED",
        title: `Your Work Is Ready: ${booking.bookingRef}`,
        body: `Your finished work for "${booking.taskTitleSnapshot}" is ready. Check it now and accept it or ask for a free edit.`,
        linkUrl: `/dashboard/bookings/${booking.bookingRef}`,
      });

      return saved;
    });

    return ok({ booking: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

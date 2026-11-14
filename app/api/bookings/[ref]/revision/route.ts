import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { enqueueNotificationInTx } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

const revisionSchema = z.object({
  reason: z.string().min(10).max(2000),
  checklist: z.array(z.string().min(2)).default([]),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ref: string }> }
) {
  try {
    const { ref } = await context.params;
    const user = await requireAuth(request);
    const body = revisionSchema.parse(await request.json());

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
        "Only the booking customer can request revisions.",
        403
      );
    }
    if (booking.status !== "DELIVERED") {
      return fail(
        "INVALID_STATUS",
        `Revisions can only be requested after delivery (current status: ${booking.status}).`,
        409
      );
    }
    if (booking.revisionCount >= booking.maxRevisions) {
      return fail(
        "REVISION_QUOTA_EXHAUSTED",
        `All ${booking.maxRevisions} permitted revision rounds have been used. Open a dispute if unresolved.`,
        409
      );
    }

    const result = await db.$transaction(async (tx) => {
      const nextCount = booking.revisionCount + 1;
      const revision = await tx.bookingRevision.create({
        data: {
          bookingId: booking.id,
          requestedById: user.id,
          revisionNumber: nextCount,
          reason: body.reason.trim(),
          checklist: body.checklist as Prisma.InputJsonValue,
        },
      });

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "REVISION_REQUESTED",
          revisionCount: nextCount,
        },
      });

      await tx.bookingMessage.create({
        data: {
          bookingId: booking.id,
          senderId: user.id,
          isSystemMessage: true,
          body: `Revision #${nextCount} of ${booking.maxRevisions} requested: ${body.reason.trim()}`,
        },
      });

      if (booking.creator) {
        await enqueueNotificationInTx(tx, {
          userId: booking.creator.userId,
          eventType: "REVISION_REQUESTED",
          title: `Revision #${nextCount} Requested: ${booking.bookingRef}`,
          body: `Customer requested updates on "${booking.taskTitleSnapshot}".`,
          linkUrl: `/creators-hub/bookings/${booking.bookingRef}`,
        });
      }

      return { revision, booking: updatedBooking };
    });

    return ok(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

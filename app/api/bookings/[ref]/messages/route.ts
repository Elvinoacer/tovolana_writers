import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { enqueueNotificationInTx } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

const messageSchema = z.object({
  body: z.string().min(1).max(4000),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ ref: string }> }
) {
  try {
    const { ref } = await context.params;
    const user = await requireAuth(request);

    const booking = await db.booking.findFirst({
      where: { OR: [{ bookingRef: ref }, { id: ref }] },
    });
    if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);

    const allowed =
      booking.customerId === user.id ||
      booking.creatorId === user.creatorProfile?.id ||
      user.roles.includes("ADMIN");
    if (!allowed) return fail("FORBIDDEN", "Permission denied.", 403);

    const messages = await db.bookingMessage.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: { id: true, name: true, roles: true } } },
    });
    return ok({ messages });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ref: string }> }
) {
  try {
    const { ref } = await context.params;
    const user = await requireAuth(request);
    const body = messageSchema.parse(await request.json());

    const booking = await db.booking.findFirst({
      where: { OR: [{ bookingRef: ref }, { id: ref }] },
      include: { creator: true },
    });
    if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);

    const isCustomer = booking.customerId === user.id;
    const isCreator = booking.creatorId === user.creatorProfile?.id;
    const isAdmin = user.roles.includes("ADMIN");
    if (!isCustomer && !isCreator && !isAdmin) {
      return fail("FORBIDDEN", "Permission denied.", 403);
    }

    const message = await db.$transaction(async (tx) => {
      const created = await tx.bookingMessage.create({
        data: {
          bookingId: booking.id,
          senderId: user.id,
          body: body.body.trim(),
        },
        include: { sender: { select: { id: true, name: true, roles: true } } },
      });

      const recipientUserId = isCustomer
        ? booking.creator?.userId
        : booking.customerId;
      if (recipientUserId && recipientUserId !== user.id) {
        await enqueueNotificationInTx(tx, {
          userId: recipientUserId,
          eventType: "BOOKING_MESSAGE",
          title: `New Message on ${booking.bookingRef}`,
          body: body.body.trim().slice(0, 140),
          linkUrl: isCustomer
            ? `/creators-hub/bookings/${booking.bookingRef}`
            : `/dashboard/bookings/${booking.bookingRef}`,
        });
      }

      return created;
    });

    return ok({ message }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

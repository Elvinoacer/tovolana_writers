import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { initiateIntaSendPayment } from "@/lib/intasend";
import { fail, handleApiError, ok } from "@/lib/http";

const checkoutSchema = z.object({
  channel: z.enum(["MPESA_STK", "CARD"]).default("MPESA_STK"),
  phone: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ref: string }> }
) {
  try {
    const { ref } = await context.params;
    const user = await requireAuth(request);
    const body = checkoutSchema.parse(await request.json());

    const booking = await db.booking.findFirst({
      where: { OR: [{ bookingRef: ref }, { id: ref }] },
    });

    if (!booking) {
      return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
    }
    if (booking.customerId !== user.id) {
      return fail(
        "FORBIDDEN",
        "Only the booking customer can initiate payment.",
        403
      );
    }
    if (booking.status !== "PENDING_PAYMENT") {
      return fail(
        "INVALID_BOOKING_STATUS",
        `Cannot pay for a booking in status ${booking.status}.`,
        409
      );
    }

    const checkoutResult = await initiateIntaSendPayment({
      userId: user.id,
      bookingId: booking.id,
      purpose: "BOOKING_ESCROW",
      channel: body.channel,
      phone: body.phone ?? user.phone,
      email: user.email,
      amount: booking.totalPayable,
      currency: booking.currency,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/bookings/${booking.bookingRef}`,
    });

    return ok(checkoutResult, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/http";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ ref: string }> }
) {
  try {
    const { ref } = await context.params;
    const user = await requireAuth(request);

    const booking = await db.booking.findFirst({
      where: {
        OR: [{ bookingRef: ref }, { id: ref }],
      },
      include: {
        task: {
          include: {
            category: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            membershipTier: true,
          },
        },
        creator: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        files: {
          orderBy: { createdAt: "desc" },
          include: { uploader: { select: { id: true, name: true } } },
        },
        revisions: { orderBy: { revisionNumber: "desc" } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { id: true, name: true, roles: true } } },
        },
        payments: { orderBy: { createdAt: "desc" } },
        dispute: true,
        review: true,
        ledgerEntry: true,
      },
    });

    if (!booking) {
      return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
    }

    const isCustomer = booking.customerId === user.id;
    const isCreator = Boolean(
      user.creatorProfile && booking.creatorId === user.creatorProfile.id
    );
    const isAdmin = user.roles.includes("ADMIN");

    if (!isCustomer && !isCreator && !isAdmin) {
      return fail(
        "FORBIDDEN",
        "You are not authorized to view this booking.",
        403
      );
    }

    return ok({ booking });
  } catch (err) {
    return handleApiError(err);
  }
}

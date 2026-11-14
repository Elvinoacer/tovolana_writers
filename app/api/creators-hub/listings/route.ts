import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user.creatorProfile) {
      return fail(
        "CREATOR_PROFILE_NOT_FOUND",
        "Complete Creator onboarding to view listings.",
        404
      );
    }

    const listings = await db.taskListing.findMany({
      where: {
        creatorId: user.creatorProfile.id,
        status: { not: "RETAINED_SOFT_DELETED" },
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const bookings = await db.booking.findMany({
      where: { creatorId: user.creatorProfile.id },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        task: { select: { id: true, slug: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok({
      listings,
      bookings,
      creatorProfile: user.creatorProfile,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

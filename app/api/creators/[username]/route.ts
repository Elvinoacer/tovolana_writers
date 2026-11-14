import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { fail, handleApiError, ok } from "@/lib/http";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await context.params;
    const creator = await db.creatorProfile.findUnique({
      where: { username },
      include: {
        listings: {
          where: {
            status: "PUBLISHED",
            validUntil: { gt: new Date() },
          },
          include: {
            category: { select: { id: true, slug: true, name: true } },
          },
          orderBy: { publishedAt: "desc" },
        },
        reviewsReceived: {
          where: { isPublic: true },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            customer: { select: { id: true, name: true } },
            task: { select: { slug: true, title: true } },
          },
        },
      },
    });

    if (!creator || creator.applicationStatus !== "APPROVED") {
      return fail("CREATOR_NOT_FOUND", "Creator profile not found.", 404);
    }

    return ok({ creator });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { normalizeKenyanMsisdn } from "@/lib/intasend";
import { fail, handleApiError, ok } from "@/lib/http";

const payoutRequestSchema = z.object({
  destinationPhone: z.string().min(9).max(20),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole("CREATOR", request);
    if (!user.creatorProfile) {
      return fail("CREATOR_PROFILE_NOT_FOUND", "Creator profile missing.", 404);
    }

    const [ledger, payouts] = await Promise.all([
      db.creatorEarningsLedger.findMany({
        where: { creatorId: user.creatorProfile.id },
        include: {
          booking: {
            select: {
              bookingRef: true,
              taskTitleSnapshot: true,
              status: true,
              completedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.creatorPayout.findMany({
        where: { creatorId: user.creatorProfile.id },
        orderBy: { requestedAt: "desc" },
      }),
    ]);

    const pendingEscrow = ledger
      .filter((e) => e.status === "PENDING_ESCROW")
      .reduce((sum, e) => sum + e.netAmount, 0);
    const availableBalance = ledger
      .filter((e) => e.status === "AVAILABLE")
      .reduce((sum, e) => sum + e.netAmount, 0);
    const paidOutTotal = ledger
      .filter((e) => e.status === "PAID")
      .reduce((sum, e) => sum + e.netAmount, 0);

    return ok({
      summary: {
        pendingEscrow,
        availableBalance,
        paidOutTotal,
        currency: "KES",
      },
      ledger,
      payouts,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("CREATOR", request);
    if (!user.creatorProfile) {
      return fail("CREATOR_PROFILE_NOT_FOUND", "Creator profile missing.", 404);
    }

    const body = payoutRequestSchema.parse(await request.json());
    const phone = normalizeKenyanMsisdn(body.destinationPhone);

    const availableEntries = await db.creatorEarningsLedger.findMany({
      where: {
        creatorId: user.creatorProfile.id,
        status: "AVAILABLE",
      },
    });

    const totalAvailable = availableEntries.reduce(
      (sum, entry) => sum + entry.netAmount,
      0
    );
    if (totalAvailable < 100) {
      return fail(
        "INSUFFICIENT_BALANCE",
        "Minimum withdrawable balance is KES 100.",
        400
      );
    }

    const payout = await db.$transaction(async (tx) => {
      const created = await tx.creatorPayout.create({
        data: {
          creatorId: user.creatorProfile!.id,
          amount: totalAvailable,
          currency: "KES",
          destinationPhone: phone,
          status: "REQUESTED",
        },
      });

      await tx.creatorEarningsLedger.updateMany({
        where: {
          id: { in: availableEntries.map((e) => e.id) },
        },
        data: {
          status: "REQUESTED",
          payoutId: created.id,
        },
      });

      return created;
    });

    return ok({ payout }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

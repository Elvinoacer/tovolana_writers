import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/http";

const financeActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("REFUND"),
    transactionId: z.string().min(1),
    amount: z.number().positive(),
    reason: z.string().min(5).max(500),
  }),
  z.object({
    action: z.literal("MARK_PAYOUT_PAID"),
    payoutId: z.string().min(1),
    providerRef: z.string().min(3),
    reason: z.string().min(4).max(500).default("Settled via M-Pesa B2C"),
  }),
]);

export async function GET(request: NextRequest) {
  try {
    await requireAdminScope("FINANCE_ADMIN", request);
    const [transactions, refunds, payouts, ledger] = await Promise.all([
      db.paymentTransaction.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          booking: { select: { bookingRef: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.refundRecord.findMany({
        include: { booking: { select: { bookingRef: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.creatorPayout.findMany({
        include: {
          creator: { select: { username: true, displayName: true } },
        },
        orderBy: { requestedAt: "desc" },
        take: 30,
      }),
      db.creatorEarningsLedger.findMany({
        include: {
          creator: { select: { displayName: true, username: true } },
          booking: { select: { bookingRef: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    ]);

    return ok({ transactions, refunds, payouts, ledger });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminScope("FINANCE_ADMIN", request);
    const body = financeActionSchema.parse(await request.json());

    if (body.action === "REFUND") {
      const txRecord = await db.paymentTransaction.findUnique({
        where: { id: body.transactionId },
      });
      if (!txRecord || txRecord.status !== "COMPLETE") {
        return fail(
          "INVALID_TRANSACTION",
          "Only completed transactions can be refunded.",
          400
        );
      }
      if (body.amount > txRecord.amount) {
        return fail(
          "REFUND_EXCEEDS_PAYMENT",
          "Refund amount cannot exceed original transaction amount.",
          400
        );
      }

      const refund = await db.$transaction(async (tx) => {
        const created = await tx.refundRecord.create({
          data: {
            transactionId: txRecord.id,
            bookingId: txRecord.bookingId,
            amount: body.amount,
            currency: txRecord.currency,
            reason: body.reason.trim(),
            processedByAdminId: admin.id,
            providerRefundRef: `RFD-${Date.now()}`,
          },
        });

        await tx.paymentTransaction.update({
          where: { id: txRecord.id },
          data: { status: "REFUNDED" },
        });

        if (txRecord.bookingId) {
          await tx.booking.update({
            where: { id: txRecord.bookingId },
            data: { status: "REFUNDED" },
          });
          await tx.creatorEarningsLedger.updateMany({
            where: { bookingId: txRecord.bookingId },
            data: { status: "REVERSED" },
          });
        }

        await tx.adminAuditLog.create({
          data: {
            actorAdminId: admin.id,
            action: "FINANCE_REFUND_PROCESSED",
            targetType: "PaymentTransaction",
            targetId: txRecord.id,
            reason: body.reason.trim(),
            metadata: { amount: body.amount, apiRef: txRecord.apiRef },
          },
        });

        return created;
      });

      return ok({ refund }, 201);
    }

    const payout = await db.creatorPayout.findUnique({
      where: { id: body.payoutId },
    });
    if (!payout) return fail("NOT_FOUND", "Payout request not found.", 404);

    const updatedPayout = await db.$transaction(async (tx) => {
      const saved = await tx.creatorPayout.update({
        where: { id: payout.id },
        data: {
          status: "PAID",
          providerRef: body.providerRef.trim(),
          paidAt: new Date(),
        },
      });
      await tx.creatorEarningsLedger.updateMany({
        where: { payoutId: payout.id },
        data: { status: "PAID" },
      });
      await tx.adminAuditLog.create({
        data: {
          actorAdminId: admin.id,
          action: "CREATOR_PAYOUT_SETTLED",
          targetType: "CreatorPayout",
          targetId: payout.id,
          reason: body.reason.trim(),
          metadata: { amount: payout.amount, providerRef: body.providerRef },
        },
      });
      return saved;
    });

    return ok({ payout: updatedPayout });
  } catch (err) {
    return handleApiError(err);
  }
}

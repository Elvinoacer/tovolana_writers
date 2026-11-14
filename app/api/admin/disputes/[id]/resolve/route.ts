import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/auth";
import { enqueueNotificationInTx } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

const resolveDisputeSchema = z.object({
  outcome: z.enum([
    "RESOLVED_REFUND",
    "RESOLVED_PARTIAL_SPLIT",
    "RESOLVED_RELEASE_CREATOR",
  ]),
  refundAmount: z.number().min(0).optional(),
  creatorReleaseAmount: z.number().min(0).optional(),
  resolutionNote: z.string().min(6).max(2000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminScope("SUPPORT_ADMIN", request);
    const { id } = await context.params;
    const body = resolveDisputeSchema.parse(await request.json());

    const dispute = await db.dispute.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            creator: true,
            payments: { where: { status: "COMPLETE" }, take: 1 },
          },
        },
      },
    });
    if (!dispute) return fail("NOT_FOUND", "Dispute not found.", 404);

    const booking = dispute.booking;
    const refundAmount =
      body.outcome === "RESOLVED_REFUND"
        ? booking.totalPayable
        : body.outcome === "RESOLVED_PARTIAL_SPLIT"
          ? Math.min(booking.totalPayable, body.refundAmount ?? 0)
          : 0;
    const creatorReleaseAmount =
      body.outcome === "RESOLVED_RELEASE_CREATOR"
        ? booking.creatorNetAmount
        : body.outcome === "RESOLVED_PARTIAL_SPLIT"
          ? Math.min(
              booking.creatorNetAmount,
              body.creatorReleaseAmount ??
                Math.max(0, booking.creatorNetAmount - refundAmount)
            )
          : 0;

    const result = await db.$transaction(async (tx) => {
      const updatedDispute = await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: body.outcome,
          resolutionNote: body.resolutionNote.trim(),
          refundAmount,
          creatorReleaseAmount,
          resolvedByAdminId: admin.id,
          resolvedAt: new Date(),
        },
      });

      const nextBookingStatus =
        body.outcome === "RESOLVED_REFUND" ? "REFUNDED" : "COMPLETED";

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: nextBookingStatus,
          completedAt: nextBookingStatus === "COMPLETED" ? new Date() : null,
        },
      });

      if (refundAmount > 0 && booking.payments[0]) {
        await tx.refundRecord.create({
          data: {
            transactionId: booking.payments[0].id,
            bookingId: booking.id,
            amount: refundAmount,
            currency: booking.currency,
            reason: body.resolutionNote.trim(),
            processedByAdminId: admin.id,
            providerRefundRef: `RFD-${Date.now()}`,
          },
        });
      }

      if (creatorReleaseAmount > 0) {
        await tx.creatorEarningsLedger.updateMany({
          where: { bookingId: booking.id },
          data: {
            netAmount: creatorReleaseAmount,
            status: "AVAILABLE",
            availableAt: new Date(),
          },
        });
      } else {
        await tx.creatorEarningsLedger.updateMany({
          where: { bookingId: booking.id },
          data: { status: "REVERSED" },
        });
      }

      await tx.bookingMessage.create({
        data: {
          bookingId: booking.id,
          senderId: admin.id,
          isSystemMessage: true,
          body: `Dispute Resolved (${body.outcome}): ${body.resolutionNote.trim()}`,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          actorAdminId: admin.id,
          action: `DISPUTE_${body.outcome}`,
          targetType: "Dispute",
          targetId: dispute.id,
          reason: body.resolutionNote.trim(),
          metadata: { bookingRef: booking.bookingRef, refundAmount, creatorReleaseAmount },
        },
      });

      await enqueueNotificationInTx(tx, {
        userId: booking.customerId,
        eventType: "DISPUTE_RESOLVED",
        title: `Dispute Resolved: ${booking.bookingRef}`,
        body: body.resolutionNote.trim(),
        linkUrl: `/dashboard/bookings/${booking.bookingRef}`,
      });
      if (booking.creator) {
        await enqueueNotificationInTx(tx, {
          userId: booking.creator.userId,
          eventType: "DISPUTE_RESOLVED",
          title: `Dispute Resolved: ${booking.bookingRef}`,
          body: body.resolutionNote.trim(),
          linkUrl: `/creators-hub/bookings/${booking.bookingRef}`,
        });
      }

      return updatedDispute;
    });

    return ok({ dispute: result });
  } catch (err) {
    return handleApiError(err);
  }
}

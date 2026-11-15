import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { enqueueNotificationInTx } from "@/lib/notifications";
import { fail, handleApiError, ok } from "@/lib/http";

const disputeSchema = z.object({
  action: z.enum(["CANCEL", "DISPUTE"]).default("DISPUTE"),
  reason: z.string().min(5).max(300),
  details: z.string().min(10).max(3000),
  attachmentFileIds: z.array(z.string().min(1)).max(5).optional(),
});

class AttachmentLinkError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ref: string }> }
) {
  try {
    const { ref } = await context.params;
    const user = await requireAuth(request);
    const body = disputeSchema.parse(await request.json());
    const attachmentFileIds = [...new Set(body.attachmentFileIds ?? [])];

    const booking = await db.booking.findFirst({
      where: { OR: [{ bookingRef: ref }, { id: ref }] },
      include: { creator: true },
    });

    if (!booking) {
      return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
    }

    const isCustomer = booking.customerId === user.id;
    const isCreator = booking.creatorId === user.creatorProfile?.id;
    if (!isCustomer && !isCreator) {
      return fail("FORBIDDEN", "Permission denied.", 403);
    }

    if (
      body.action === "CANCEL" &&
      (booking.status === "PENDING_PAYMENT" ||
        booking.status === "PAID_AWAITING_ACCEPTANCE")
    ) {
      const cancelled = await db.$transaction(async (tx) => {
        const saved = await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: body.reason.trim(),
          },
        });
        await tx.bookingMessage.create({
          data: {
            bookingId: booking.id,
            senderId: user.id,
            isSystemMessage: true,
            body: `Booking cancelled (${body.reason.trim()}).`,
          },
        });
        return saved;
      });
      return ok({ booking: cancelled, mode: "CANCELLED" });
    }

    if (
      booking.status === "CANCELLED" ||
      booking.status === "REFUNDED" ||
      booking.status === "DISPUTED"
    ) {
      return fail(
        "INVALID_DISPUTE_STATE",
        `Cannot open dispute in status ${booking.status}.`,
        409
      );
    }

    const result = await db.$transaction(async (tx) => {
      const dispute = await tx.dispute.upsert({
        where: { bookingId: booking.id },
        update: {
          reason: body.reason.trim(),
          details: body.details.trim(),
          status: "OPEN",
        },
        create: {
          bookingId: booking.id,
          openedById: user.id,
          reason: body.reason.trim(),
          details: body.details.trim(),
          status: "OPEN",
        },
      });

      if (attachmentFileIds.length > 0) {
        const files = await tx.bookingFile.findMany({
          where: { id: { in: attachmentFileIds } },
          select: {
            id: true,
            bookingId: true,
            uploaderId: true,
            revisionId: true,
            disputeId: true,
          },
        });
        const fileMap = new Map(files.map((f) => [f.id, f]));
        const isAdmin = user.roles.includes("ADMIN");

        for (const fileId of attachmentFileIds) {
          const file = fileMap.get(fileId);
          if (!file || file.bookingId !== booking.id) {
            throw new AttachmentLinkError(
              "INVALID_ATTACHMENT_FILE",
              "One or more attachment files do not belong to this booking.",
              400
            );
          }
          if (!isAdmin && file.uploaderId !== user.id) {
            throw new AttachmentLinkError(
              "FORBIDDEN",
              "You can only attach files that you uploaded.",
              403
            );
          }
          if (
            file.revisionId ||
            (file.disputeId && file.disputeId !== dispute.id)
          ) {
            throw new AttachmentLinkError(
              "ATTACHMENT_ALREADY_LINKED",
              "One or more attachment files are already linked to another revision or dispute.",
              409
            );
          }
        }

        const linked = await tx.bookingFile.updateMany({
          where: {
            id: { in: attachmentFileIds },
            bookingId: booking.id,
            revisionId: null,
            OR: [{ disputeId: null }, { disputeId: dispute.id }],
            ...(isAdmin ? {} : { uploaderId: user.id }),
          },
          data: { disputeId: dispute.id },
        });

        if (linked.count !== attachmentFileIds.length) {
          throw new AttachmentLinkError(
            "ATTACHMENT_ALREADY_LINKED",
            "One or more attachment files could not be linked to this dispute.",
            409
          );
        }
      }

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "DISPUTED" },
      });

      await tx.bookingMessage.create({
        data: {
          bookingId: booking.id,
          senderId: user.id,
          isSystemMessage: true,
          body: `Dispute opened: ${body.reason.trim()}. Administrator tribunal notified.`,
        },
      });

      const counterpartyId = isCustomer
        ? booking.creator?.userId
        : booking.customerId;
      if (counterpartyId) {
        await enqueueNotificationInTx(tx, {
          userId: counterpartyId,
          eventType: "DISPUTE_OPENED",
          title: `Dispute Opened: ${booking.bookingRef}`,
          body: `${user.name} opened a dispute ("${body.reason.trim()}"). Administrators will review escrow evidence.`,
          linkUrl: isCustomer
            ? `/creators-hub/bookings/${booking.bookingRef}`
            : `/dashboard/bookings/${booking.bookingRef}`,
        });
      }

      return { dispute, booking: updatedBooking };
    });

    return ok(result, 201);
  } catch (err) {
    if (err instanceof AttachmentLinkError) {
      return fail(err.code, err.message, err.status);
    }
    return handleApiError(err);
  }
}

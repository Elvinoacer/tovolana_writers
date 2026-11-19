import crypto from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  calculateAddOnsTotal,
  calculateBookingPricing,
  isUserProActive,
} from "@/lib/pricing";
import { fail, handleApiError, ok } from "@/lib/http";

const createBookingSchema = z.object({
  taskId: z.string().min(1),
  requirementsResponses: z.record(z.string(), z.unknown()),
  requestedDeadline: z.string().optional(),
  rushExtraCharge: z.number().min(0).optional(),
  selectedAddOns: z.array(z.string()).default([]),
  checkoutMode: z
    .enum(["FULL_ESCROW", "TRIPWIRE_OUTLINE", "MILESTONE_SPLIT"])
    .default("FULL_ESCROW"),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const scope = request.nextUrl.searchParams.get("scope") || "customer";

    if (scope === "creator") {
      if (!user.creatorProfile) {
        return fail("FORBIDDEN", "Creator profile required.", 403);
      }
      const bookings = await db.booking.findMany({
        where: { creatorId: user.creatorProfile.id },
        include: {
          task: { select: { id: true, slug: true, title: true, status: true, validUntil: true } },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              membershipTier: true,
            },
          },
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      });
      return ok({ bookings });
    }

    const bookings = await db.booking.findMany({
      where: { customerId: user.id },
      include: {
        task: { select: { id: true, slug: true, title: true, status: true, validUntil: true } },
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            ratingAverage: true,
            user: { select: { avatarUrl: true } },
          },
        },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok({ bookings });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = createBookingSchema.parse(await request.json());

    const task = await db.taskListing.findFirst({
      where: { OR: [{ id: body.taskId }, { slug: body.taskId }] },
      include: { creator: true },
    });

    if (!task) {
      return fail("TASK_NOT_FOUND", "Task listing not found.", 404);
    }

    const now = new Date();
    if (
      task.status !== "PUBLISHED" ||
      (task.validUntil && task.validUntil.getTime() <= now.getTime())
    ) {
      return fail(
        "LISTING_EXPIRED_OR_UNAVAILABLE",
        "This service listing is no longer open for new bookings.",
        409
      );
    }

    if (task.creator && task.creator.userId === user.id) {
      return fail(
        "SELF_BOOKING_NOT_ALLOWED",
        "You cannot place a customer booking on your own service listing.",
        400
      );
    }

    const userIsPro = isUserProActive(user.membershipTier, user.proExpiresAt, now);
    if (
      task.proEarlyAccessUntil &&
      task.proEarlyAccessUntil.getTime() > now.getTime() &&
      !userIsPro
    ) {
      return fail(
        "PRO_EARLY_ACCESS_ACTIVE",
        "This listing is currently in its Pro Early Access window.",
        403
      );
    }

    const config = await db.platformConfig.findUnique({
      where: { id: "global" },
    });

    const { addOnsTotal, itemized } = calculateAddOnsTotal(
      task.basePrice,
      body.selectedAddOns
    );

    const pricing = calculateBookingPricing({
      listedPrice: task.basePrice,
      extraCharges: body.rushExtraCharge ?? 0,
      addOnsTotal,
      standardServiceFeePct: config?.standardServiceFeePct ?? 10,
      proFeeDiscountPct: config?.proFeeDiscountPct ?? 50,
      serviceFeePctOverride: task.serviceFeePctOverride,
      userIsPro,
      checkoutMode: body.checkoutMode,
    });

    const effectiveDays = body.selectedAddOns.includes("priority_rush")
      ? Math.max(1, Math.ceil(task.deliveryTurnaroundDays / 2))
      : task.deliveryTurnaroundDays;
    const minDeadline = new Date(
      now.getTime() + effectiveDays * 24 * 60 * 60 * 1000
    );
    let agreedDeliveryDeadline = minDeadline;
    if (body.requestedDeadline) {
      const requested = new Date(body.requestedDeadline);
      if (!Number.isNaN(requested.getTime()) && requested > minDeadline) {
        agreedDeliveryDeadline = requested;
      }
    }

    const bookingRef = `TVL-${now.getFullYear()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;

    const booking = await db.booking.create({
      data: {
        bookingRef,
        taskId: task.id,
        customerId: user.id,
        creatorId: task.creatorId,
        taskTitleSnapshot: task.title,
        currency: task.currency,
        listedPrice: pricing.listedPrice,
        extraCharges: pricing.extraCharges,
        addOnsTotal: pricing.addOnsTotal,
        selectedAddOns: itemized as unknown as Prisma.InputJsonValue,
        checkoutMode: pricing.checkoutMode,
        serviceFee: pricing.serviceFee,
        proDiscount: pricing.proDiscount,
        totalPayable: pricing.totalPayable,
        creatorNetAmount: pricing.creatorNetAmount,
        requirementsResponses: body.requirementsResponses as Prisma.InputJsonValue,
        agreedDeliveryDeadline,
        status: "PENDING_PAYMENT",
        maxRevisions: task.maxRevisions,
        messages: {
          create: {
            senderId: user.id,
            isSystemMessage: true,
            body: `Order ${bookingRef} created (${task.currency} ${pricing.totalPayable.toLocaleString()}). Complete payment to lock in your delivery date.`,
          },
        },
      },
      include: {
        task: { select: { id: true, slug: true, title: true, validUntil: true, status: true } },
        creator: { select: { id: true, username: true, displayName: true } },
      },
    });

    return ok({ booking, pricing }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

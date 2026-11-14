import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env, hasLiveIntaSendKeys } from "@/lib/env";
import { withDistributedLock } from "@/lib/redis";
import { enqueueNotificationInTx } from "@/lib/notifications";

export function normalizeKenyanMsisdn(rawPhone: string): string {
  const digits = rawPhone.replace(/[\s\-()+]/g, "");
  if (/^254[17]\d{8}$/.test(digits)) {
    return digits;
  }
  if (/^0[17]\d{8}$/.test(digits)) {
    return `254${digits.slice(1)}`;
  }
  if (/^[17]\d{8}$/.test(digits)) {
    return `254${digits}`;
  }
  throw new Error(
    "INVALID_KENYAN_PHONE: Expected Safaricom/Airtel format 2547XXXXXXXX, 2541XXXXXXXX, or 07XXXXXXXX."
  );
}

export function verifyIntaSendChallenge(
  receivedChallenge: string | null | undefined
): boolean {
  if (!receivedChallenge || !env.intasendWebhookChallenge) return false;
  const a = crypto
    .createHash("sha256")
    .update(String(receivedChallenge))
    .digest();
  const b = crypto
    .createHash("sha256")
    .update(String(env.intasendWebhookChallenge))
    .digest();
  return crypto.timingSafeEqual(a, b);
}

function getIntaSendBaseUrl(): string {
  return env.intasendIsTest
    ? "https://sandbox.intasend.com"
    : "https://payment.intasend.com";
}

export interface InitiatePaymentInput {
  userId: string;
  bookingId?: string;
  subscriptionId?: string;
  purpose: "BOOKING_ESCROW" | "PRO_SUBSCRIPTION";
  channel: "MPESA_STK" | "CARD";
  phone?: string | null;
  email: string;
  amount: number;
  currency?: string;
  redirectUrl?: string;
}

export async function initiateIntaSendPayment(input: InitiatePaymentInput) {
  const targetKey = input.bookingId ?? input.subscriptionId ?? input.userId;
  return withDistributedLock(`checkout:${targetKey}`, 15, async () => {
    const currency = input.currency || "KES";
    let normalizedPhone: string | null = null;
    if (input.channel === "MPESA_STK") {
      if (!input.phone) {
        throw new Error("PHONE_REQUIRED_FOR_MPESA");
      }
      normalizedPhone = normalizeKenyanMsisdn(input.phone);
    }

    if (input.bookingId) {
      const completed = await db.paymentTransaction.findFirst({
        where: { bookingId: input.bookingId, status: "COMPLETE" },
      });
      if (completed) {
        throw new Error("BOOKING_ALREADY_PAID");
      }
    }

    const prefix = input.purpose === "PRO_SUBSCRIPTION" ? "tv-pro" : "tv-bk";
    const apiRef = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    // Ledger-first: write PENDING transaction before calling IntaSend API
    const txRecord = await db.paymentTransaction.create({
      data: {
        userId: input.userId,
        bookingId: input.bookingId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        purpose: input.purpose,
        channel: input.channel,
        apiRef,
        phone: normalizedPhone,
        currency,
        amount: input.amount,
        status: "PENDING",
      },
    });

    if (hasLiveIntaSendKeys()) {
      const baseUrl = getIntaSendBaseUrl();
      if (input.channel === "MPESA_STK") {
        const res = await fetch(`${baseUrl}/api/v1/payment/mpesa-stk-push/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.intasendSecretKey}`,
          },
          body: JSON.stringify({
            amount: input.amount,
            phone_number: normalizedPhone,
            api_ref: apiRef,
            narrative:
              input.purpose === "PRO_SUBSCRIPTION"
                ? "Tovolana Writers Pro Membership"
                : "Tovolana Writers Booking Escrow",
          }),
        });
        const data = (await res.json()) as {
          invoice?: { invoice_id?: string };
          id?: string;
          errors?: unknown;
        };
        if (!res.ok) {
          await db.paymentTransaction.update({
            where: { id: txRecord.id },
            data: { status: "FAILED", rawWebhookPayload: data as Prisma.InputJsonValue },
          });
          throw new Error(`INTASEND_STK_FAILED: ${JSON.stringify(data)}`);
        }
        const invoiceId = data.invoice?.invoice_id ?? `INV-${apiRef}`;
        const updated = await db.paymentTransaction.update({
          where: { id: txRecord.id },
          data: {
            providerInvoiceId: invoiceId,
            providerTrackingId: data.id ?? null,
          },
        });
        return {
          mode: "LIVE_INTASEND" as const,
          transaction: updated,
          checkoutUrl: null as string | null,
        };
      } else {
        const res = await fetch(`${baseUrl}/api/v1/checkout/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.intasendSecretKey}`,
          },
          body: JSON.stringify({
            public_key: env.intasendPublishableKey,
            amount: input.amount,
            currency,
            email: input.email,
            api_ref: apiRef,
            redirect_url: input.redirectUrl || `${env.appUrl}/dashboard`,
          }),
        });
        const data = (await res.json()) as {
          id?: string;
          url?: string;
        };
        if (!res.ok) {
          await db.paymentTransaction.update({
            where: { id: txRecord.id },
            data: { status: "FAILED", rawWebhookPayload: data as Prisma.InputJsonValue },
          });
          throw new Error(`INTASEND_CHECKOUT_FAILED: ${JSON.stringify(data)}`);
        }
        const updated = await db.paymentTransaction.update({
          where: { id: txRecord.id },
          data: {
            providerInvoiceId: data.id ?? `CHK-${apiRef}`,
            providerTrackingId: data.id ?? null,
          },
        });
        return {
          mode: "LIVE_INTASEND" as const,
          transaction: updated,
          checkoutUrl: data.url ?? null,
        };
      }
    }

    // Sandbox local simulation when live IntaSend keys aren't configured yet
    const simInvoiceId = `SIM-${apiRef}`;
    const updated = await db.paymentTransaction.update({
      where: { id: txRecord.id },
      data: {
        providerInvoiceId: simInvoiceId,
        providerTrackingId: simInvoiceId,
      },
    });
    return {
      mode: "SANDBOX_SIMULATION" as const,
      transaction: updated,
      checkoutUrl:
        input.channel === "CARD"
          ? `${env.appUrl}/dashboard?simulatedCheckout=${apiRef}`
          : null,
    };
  });
}

export interface IntaSendWebhookPayload {
  invoice_id?: string;
  state?: string;
  provider?: string;
  charges?: string | number;
  net_amount?: string | number;
  currency?: string;
  value?: string | number;
  amount?: string | number;
  account?: string;
  api_ref?: string;
  challenge?: string;
  failed_reason?: string | null;
}

export async function processIntaSendWebhook(payload: IntaSendWebhookPayload) {
  if (!verifyIntaSendChallenge(payload.challenge)) {
    throw new Error("INVALID_WEBHOOK_CHALLENGE");
  }

  const state = (payload.state || "").toUpperCase();
  const txRecord = await db.paymentTransaction.findFirst({
    where: {
      OR: [
        ...(payload.api_ref ? [{ apiRef: payload.api_ref }] : []),
        ...(payload.invoice_id
          ? [{ providerInvoiceId: payload.invoice_id }]
          : []),
      ],
    },
  });

  if (!txRecord) {
    throw new Error("TRANSACTION_NOT_FOUND");
  }

  if (state === "FAILED") {
    if (txRecord.status === "COMPLETE") {
      return { idempotent: true, transaction: txRecord };
    }
    const updated = await db.paymentTransaction.update({
      where: { id: txRecord.id },
      data: {
        status: "FAILED",
        rawWebhookPayload: payload as unknown as Prisma.InputJsonValue,
      },
    });
    return { idempotent: false, transaction: updated };
  }

  if (state !== "COMPLETE") {
    return { idempotent: true, transaction: txRecord };
  }

  const incomingAmount = Number(payload.value ?? payload.amount ?? txRecord.amount);
  if (
    Number.isNaN(incomingAmount) ||
    Math.abs(incomingAmount - txRecord.amount) > 0.05
  ) {
    throw new Error(
      `AMOUNT_MISMATCH: expected ${txRecord.amount}, received ${incomingAmount}`
    );
  }
  if (
    payload.currency &&
    payload.currency.toUpperCase() !== txRecord.currency.toUpperCase()
  ) {
    throw new Error(
      `CURRENCY_MISMATCH: expected ${txRecord.currency}, received ${payload.currency}`
    );
  }

  return db.$transaction(async (tx) => {
    const freshTx = await tx.paymentTransaction.findUniqueOrThrow({
      where: { id: txRecord.id },
    });

    if (freshTx.status === "COMPLETE") {
      return { idempotent: true, transaction: freshTx };
    }

    const updatedTx = await tx.paymentTransaction.update({
      where: { id: freshTx.id },
      data: {
        status: "COMPLETE",
        paidAt: new Date(),
        providerInvoiceId: payload.invoice_id ?? freshTx.providerInvoiceId,
        rawWebhookPayload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    if (freshTx.purpose === "BOOKING_ESCROW" && freshTx.bookingId) {
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: freshTx.bookingId },
        include: {
          task: true,
          creator: { include: { user: true } },
          customer: true,
        },
      });

      const nextStatus = booking.task.manualAcceptanceRequired
        ? "PAID_AWAITING_ACCEPTANCE"
        : "IN_PROGRESS";

      await tx.booking.update({
        where: { id: booking.id },
        data: { status: nextStatus },
      });

      await tx.bookingMessage.create({
        data: {
          bookingId: booking.id,
          senderId: booking.customerId,
          isSystemMessage: true,
          body: `Payment confirmed via ${freshTx.channel} (${freshTx.currency} ${freshTx.amount.toLocaleString()}). Booking moved to ${nextStatus.replace(/_/g, " ")}.`,
        },
      });

      if (booking.creatorId) {
        await tx.creatorEarningsLedger.upsert({
          where: { bookingId: booking.id },
          update: {},
          create: {
            creatorId: booking.creatorId,
            bookingId: booking.id,
            grossAmount: booking.totalPayable,
            platformFee: booking.serviceFee,
            netAmount: booking.creatorNetAmount,
            currency: booking.currency,
            status: "PENDING_ESCROW",
          },
        });

        if (booking.creator) {
          await enqueueNotificationInTx(tx, {
            userId: booking.creator.userId,
            eventType: "NEW_BOOKING_PAID",
            title: `New Paid Booking: ${booking.bookingRef}`,
            body: `${booking.customer.name} confirmed "${booking.taskTitleSnapshot}". Delivery deadline: ${booking.agreedDeliveryDeadline.toDateString()}.`,
            linkUrl: `/creators-hub/bookings/${booking.bookingRef}`,
            payload: { bookingRef: booking.bookingRef },
          });
        }
      }

      await enqueueNotificationInTx(tx, {
        userId: booking.customerId,
        eventType: "PAYMENT_CONFIRMED",
        title: `Payment Confirmed: ${booking.bookingRef}`,
        body: `Your payment of ${booking.currency} ${booking.totalPayable.toLocaleString()} is secured in escrow.`,
        linkUrl: `/dashboard/bookings/${booking.bookingRef}`,
        payload: { bookingRef: booking.bookingRef },
      });
    }

    if (freshTx.purpose === "PRO_SUBSCRIPTION" && freshTx.subscriptionId) {
      const sub = await tx.membershipSubscription.findUniqueOrThrow({
        where: { id: freshTx.subscriptionId },
      });
      const now = new Date();
      const days = sub.planInterval === "ANNUAL" ? 365 : 30;
      const periodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      await tx.membershipSubscription.update({
        where: { id: sub.id },
        data: {
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });

      await tx.user.update({
        where: { id: sub.userId },
        data: {
          membershipTier: "PRO",
          proExpiresAt: periodEnd,
        },
      });

      await enqueueNotificationInTx(tx, {
        userId: sub.userId,
        eventType: "PRO_ACTIVATED",
        title: "Welcome to Tovolana Pro",
        body: `Your Pro membership is active through ${periodEnd.toDateString()}, unlocking reduced service fees and early listing access.`,
        linkUrl: "/dashboard/membership",
        payload: { subscriptionId: sub.id },
      });
    }

    return { idempotent: false, transaction: updatedTx };
  });
}

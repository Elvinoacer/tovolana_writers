import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { initiateIntaSendPayment } from "@/lib/intasend";
import { handleApiError, ok } from "@/lib/http";

const subscribeSchema = z.object({
  planInterval: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
  channel: z.enum(["MPESA_STK", "CARD"]).default("MPESA_STK"),
  phone: z.string().optional(),
});

const toggleSchema = z.object({
  subscriptionId: z.string().min(1),
  autoRenew: z.boolean(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const [config, subscriptions, transactions] = await Promise.all([
      db.platformConfig.findUnique({ where: { id: "global" } }),
      db.membershipSubscription.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
      db.paymentTransaction.findMany({
        where: { userId: user.id, purpose: "PRO_SUBSCRIPTION" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return ok({ config, subscriptions, transactions });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = subscribeSchema.parse(await request.json());

    const config = await db.platformConfig.findUnique({
      where: { id: "global" },
    });
    const amount =
      body.planInterval === "ANNUAL"
        ? config?.proAnnualPrice ?? 24000
        : config?.proMonthlyPrice ?? 2500;
    const currency = config?.currency ?? "KES";

    const subscription = await db.membershipSubscription.create({
      data: {
        userId: user.id,
        tier: "PRO",
        planInterval: body.planInterval,
        amount,
        currency,
        status: "PENDING",
      },
    });

    const checkout = await initiateIntaSendPayment({
      userId: user.id,
      subscriptionId: subscription.id,
      purpose: "PRO_SUBSCRIPTION",
      channel: body.channel,
      phone: body.phone ?? user.phone,
      email: user.email,
      amount,
      currency,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/membership`,
    });

    return ok({ subscription, ...checkout }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = toggleSchema.parse(await request.json());

    const updated = await db.membershipSubscription.updateMany({
      where: { id: body.subscriptionId, userId: user.id },
      data: { autoRenew: body.autoRenew },
    });

    return ok({ updatedCount: updated.count, autoRenew: body.autoRenew });
  } catch (err) {
    return handleApiError(err);
  }
}

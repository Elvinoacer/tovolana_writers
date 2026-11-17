import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  BOOST_CONNECTS_COSTS,
  CONNECTS_BUNDLES,
  EARNINGS_TO_CONNECT_RATE_KES,
  computeCreatorProfileStandoutScore,
  isFutureTimestamp,
} from "@/lib/pricing";
import { initiateIntaSendPayment, processIntaSendWebhook } from "@/lib/intasend";
import { fail, handleApiError, ok } from "@/lib/http";

const postConnectsSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("BUY_BUNDLE"),
    bundleId: z.enum(["starter", "growth", "studio", "agency"]),
    channel: z.enum(["MPESA_STK", "CARD"]).default("MPESA_STK"),
    phone: z.string().optional(),
    autoCompleteSandbox: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("SWAP_EARNINGS"),
    connectsCount: z.number().int().min(10).max(2000),
  }),
  z.object({
    action: z.literal("ACTIVATE_BOOST"),
    boostType: z.enum(["AVAILABLE_NOW", "FEATURED_PROFILE", "CREATOR_PLUS"]),
  }),
]);

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole("CREATOR", request);
    if (!user.creatorProfile) {
      return fail("CREATOR_PROFILE_NOT_FOUND", "Creator profile missing.", 404);
    }

    const [creator, transactions, availableEntries] = await Promise.all([
      db.creatorProfile.findUniqueOrThrow({
        where: { id: user.creatorProfile.id },
        include: { user: { select: { avatarUrl: true } } },
      }),
      db.connectsTransaction.findMany({
        where: { creatorProfileId: user.creatorProfile.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.creatorEarningsLedger.findMany({
        where: {
          creatorId: user.creatorProfile.id,
          status: "AVAILABLE",
        },
        select: { netAmount: true },
      }),
    ]);

    const availableEarningsBalance = availableEntries.reduce(
      (sum, entry) => sum + entry.netAmount,
      0
    );

    const standoutReport = computeCreatorProfileStandoutScore({
      ...creator,
      avatarUrl: creator.user?.avatarUrl ?? null,
    });

    return ok({
      balance: creator.connectsBalance,
      totalConnectsSpent: creator.totalConnectsSpent,
      creatorTier: creator.creatorTier,
      boosts: {
        availableNowActive: isFutureTimestamp(creator.availableNowBadgeUntil),
        availableNowBadgeUntil: creator.availableNowBadgeUntil,
        featuredProfileActive: isFutureTimestamp(creator.featuredProfileUntil),
        featuredProfileUntil: creator.featuredProfileUntil,
        creatorPlusActive: isFutureTimestamp(creator.creatorPlusUntil),
        creatorPlusUntil: creator.creatorPlusUntil,
      },
      standoutReport,
      bundles: CONNECTS_BUNDLES,
      availableEarningsBalance,
      earningsRateKes: EARNINGS_TO_CONNECT_RATE_KES,
      boostCosts: BOOST_CONNECTS_COSTS,
      transactions,
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

    const body = postConnectsSchema.parse(await request.json());

    if (body.action === "BUY_BUNDLE") {
      const bundle = CONNECTS_BUNDLES.find((b) => b.id === body.bundleId);
      if (!bundle) {
        return fail("INVALID_BUNDLE", "Connects bundle not found.", 400);
      }

      const checkout = await initiateIntaSendPayment({
        userId: user.id,
        bundleCode: bundle.id,
        purpose: "CONNECTS_PURCHASE",
        channel: body.channel,
        phone: body.phone ?? user.phone ?? "0711000000",
        email: user.email,
        amount: bundle.priceKes,
        currency: "KES",
        redirectUrl: `${env.appUrl}/creators-hub/connects`,
      });

      if (body.autoCompleteSandbox && env.intasendIsTest) {
        const webhookResult = await processIntaSendWebhook({
          api_ref: checkout.transaction.apiRef,
          invoice_id:
            checkout.transaction.providerInvoiceId ??
            `SIM-${checkout.transaction.apiRef}`,
          state: "COMPLETE",
          value: bundle.priceKes,
          currency: "KES",
          challenge: env.intasendWebhookChallenge,
        });
        const freshCreator = await db.creatorProfile.findUniqueOrThrow({
          where: { id: user.creatorProfile.id },
        });
        return ok(
          {
            ...checkout,
            credited: true,
            bundle,
            balance: freshCreator.connectsBalance,
            webhookResult,
          },
          201
        );
      }

      return ok({ ...checkout, credited: false, bundle }, 201);
    }

    if (body.action === "SWAP_EARNINGS") {
      const requiredKes = body.connectsCount * EARNINGS_TO_CONNECT_RATE_KES;

      const swapResult = await db.$transaction(async (tx) => {
        const availableEntries = await tx.creatorEarningsLedger.findMany({
          where: {
            creatorId: user.creatorProfile!.id,
            status: "AVAILABLE",
          },
          orderBy: { createdAt: "asc" },
        });

        const totalAvailable = availableEntries.reduce(
          (sum, entry) => sum + entry.netAmount,
          0
        );

        if (totalAvailable < requiredKes) {
          return {
            error: "INSUFFICIENT_EARNINGS" as const,
            available: totalAvailable,
          };
        }

        let remainingToDeduct = requiredKes;
        for (const entry of availableEntries) {
          if (remainingToDeduct <= 0) break;
          if (entry.netAmount <= remainingToDeduct) {
            remainingToDeduct -= entry.netAmount;
            await tx.creatorEarningsLedger.update({
              where: { id: entry.id },
              data: {
                netAmount: 0,
                status: "PAID",
              },
            });
          } else {
            await tx.creatorEarningsLedger.update({
              where: { id: entry.id },
              data: {
                netAmount: entry.netAmount - remainingToDeduct,
              },
            });
            remainingToDeduct = 0;
          }
        }

        const updatedCreator = await tx.creatorProfile.update({
          where: { id: user.creatorProfile!.id },
          data: {
            connectsBalance: { increment: body.connectsCount },
          },
        });

        await tx.connectsTransaction.create({
          data: {
            creatorProfileId: updatedCreator.id,
            type: "EARNINGS_SWAP",
            amount: body.connectsCount,
            balanceAfter: updatedCreator.connectsBalance,
            description: `Swapped KES ${requiredKes.toLocaleString()} available earnings for +${body.connectsCount} Connects`,
          },
        });

        return {
          error: null,
          balance: updatedCreator.connectsBalance,
          deductedKes: requiredKes,
        };
      });

      if (swapResult.error === "INSUFFICIENT_EARNINGS") {
        return fail(
          "INSUFFICIENT_EARNINGS",
          `Need KES ${requiredKes.toLocaleString()} in available balance (current: KES ${swapResult.available.toLocaleString()}).`,
          400
        );
      }

      return ok(swapResult);
    }

    // ACTIVATE_BOOST
    const cost = BOOST_CONNECTS_COSTS[body.boostType];
    const now = new Date();
    const boostResult = await db.$transaction(async (tx) => {
      const creator = await tx.creatorProfile.findUniqueOrThrow({
        where: { id: user.creatorProfile!.id },
        include: { user: { select: { avatarUrl: true } } },
      });

      if (creator.connectsBalance < cost) {
        return {
          error: "INSUFFICIENT_CONNECTS" as const,
          balance: creator.connectsBalance,
        };
      }

      const extendFrom = (current: Date | null, days: number) => {
        const base =
          current && current.getTime() > now.getTime() ? current : now;
        return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
      };

      const updateData: {
        connectsBalance: { decrement: number };
        totalConnectsSpent: { increment: number };
        availableNowBadgeUntil?: Date;
        featuredProfileUntil?: Date;
        creatorPlusUntil?: Date;
        creatorTier?: "STANDARD" | "RISING_TALENT" | "TOP_RATED" | "ELITE";
        profileCompletenessScore?: number;
      } = {
        connectsBalance: { decrement: cost },
        totalConnectsSpent: { increment: cost },
      };

      let txType: "AVAILABILITY_BADGE" | "PROFILE_BOOST" | "CREATOR_PLUS_UNLOCK" =
        "AVAILABILITY_BADGE";
      let description = "";

      if (body.boostType === "AVAILABLE_NOW") {
        updateData.availableNowBadgeUntil = extendFrom(
          creator.availableNowBadgeUntil,
          7
        );
        txType = "AVAILABILITY_BADGE";
        description = "Activated Available Now Live Pulse Badge (7 days)";
      } else if (body.boostType === "FEATURED_PROFILE") {
        updateData.featuredProfileUntil = extendFrom(
          creator.featuredProfileUntil,
          7
        );
        if (
          creator.creatorTier === "STANDARD" ||
          creator.creatorTier === "RISING_TALENT"
        ) {
          updateData.creatorTier = "TOP_RATED";
        }
        txType = "PROFILE_BOOST";
        description =
          "Activated Featured Directory & Category Spotlight (7 days)";
      } else {
        updateData.creatorPlusUntil = extendFrom(creator.creatorPlusUntil, 30);
        updateData.creatorTier = "ELITE";
        txType = "CREATOR_PLUS_UNLOCK";
        description =
          "Activated Creator Plus Elite Pass (30 days · 5% bid fee & competitor intelligence)";
      }

      const nextStandout = computeCreatorProfileStandoutScore({
        ...creator,
        avatarUrl: creator.user?.avatarUrl ?? null,
        availableNowBadgeUntil:
          updateData.availableNowBadgeUntil ?? creator.availableNowBadgeUntil,
        featuredProfileUntil:
          updateData.featuredProfileUntil ?? creator.featuredProfileUntil,
      });
      updateData.profileCompletenessScore = nextStandout.score;

      const updatedCreator = await tx.creatorProfile.update({
        where: { id: creator.id },
        data: updateData,
      });

      await tx.connectsTransaction.create({
        data: {
          creatorProfileId: creator.id,
          type: txType,
          amount: -cost,
          balanceAfter: updatedCreator.connectsBalance,
          description,
        },
      });

      return {
        error: null,
        balance: updatedCreator.connectsBalance,
        creatorTier: updatedCreator.creatorTier,
        availableNowBadgeUntil: updatedCreator.availableNowBadgeUntil,
        featuredProfileUntil: updatedCreator.featuredProfileUntil,
        creatorPlusUntil: updatedCreator.creatorPlusUntil,
        standoutScore: updatedCreator.profileCompletenessScore,
      };
    });

    if (boostResult.error === "INSUFFICIENT_CONNECTS") {
      return fail(
        "INSUFFICIENT_CONNECTS",
        `Need ${cost} Connects to activate this boost (balance: ${boostResult.balance}).`,
        402,
        { required: cost, balance: boostResult.balance }
      );
    }

    return ok(boostResult);
  } catch (err) {
    return handleApiError(err);
  }
}

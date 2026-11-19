import React from "react";
import Link from "next/link";
import { Check, Crown, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatKes } from "@/components/ui/Badges";
import {
  AuroraHeading,
  HudBadge,
  HudCard,
  HudPriceDock,
} from "@/components/ui/AuroraPrimitives";
import { InteractiveFeeCalculator } from "@/components/InteractiveFeeCalculator";

export const dynamic = "force-dynamic";

export default async function MembershipPage() {
  const [config, user] = await Promise.all([
    db.platformConfig.findUnique({ where: { id: "global" } }),
    getCurrentUser(),
  ]);

  const currency = config?.currency ?? "KES";
  const monthlyPrice = config?.proMonthlyPrice ?? 2500;
  const annualPrice = config?.proAnnualPrice ?? 24000;
  const feePct = config?.standardServiceFeePct ?? 10;
  const discountPct = config?.proFeeDiscountPct ?? 50;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 animate-reveal">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-tech uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/35">
          <Crown className="w-3.5 h-3.5 text-amber-300" />
          Simple Pricing
        </span>
        <AuroraHeading
          as="h1"
          className="text-3xl sm:text-5xl leading-tight"
        >
          Order for free. Save 50% on fees with Pro.
        </AuroraHeading>
        <p className="text-sm sm:text-base text-slate-300">
          Every account can find writers and order help for free. Only get Pro
          if you order often and want to save money on fees.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Free Tier Sculpted HUD Card */}
        <HudCard
          theme="cyan"
          brackets
          dotMatrix="left"
          className="p-7 sm:p-8 flex flex-col justify-between space-y-6"
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2">
              <HudBadge label="FREE PLAN · FOREVER" sparkle />
              <ShieldCheck className="w-5 h-5 text-teal-300" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-y border-white/[0.1] py-4">
              <div>
                <p className="font-editorial text-xl font-bold text-white">
                  Free Plan
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  No monthly fee, pay per order
                </p>
              </div>
              <HudPriceDock
                label="FOREVER"
                price={`${currency} 0`}
                theme="cyan"
                size="lg"
              />
            </div>

            <ul className="space-y-3 text-sm text-slate-200 pt-1">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-teal-300 shrink-0" />
                Order any writing service across all categories
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-teal-300 shrink-0" />
                Safe payment protection with M-Pesa or Card
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-teal-300 shrink-0" />
                Direct chat, project files, and free edits
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-teal-300 shrink-0" />
                Apply anytime to become a writer and earn
              </li>
              <li className="flex items-center gap-2.5 text-slate-400">
                <Zap className="w-4 h-4 text-slate-400 shrink-0" />
                Standard {feePct}% service fee
              </li>
            </ul>
          </div>

          <Link
            href={user ? "/explore" : "/auth"}
            className="btn-ghost w-full py-3.5 text-sm"
          >
            {user ? "Find a Writer" : "Create Free Account"}
          </Link>
        </HudCard>

        {/* Pro Tier Sculpted HUD Card */}
        <HudCard
          theme="amber"
          brackets
          dotMatrix="right"
          className="p-7 sm:p-8 flex flex-col justify-between space-y-6"
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2">
              <HudBadge label="MOST POPULAR · PRO" sparkle />
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-y border-white/[0.1] py-4">
              <div>
                <p className="font-editorial text-xl font-bold text-white flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-300" />
                  Tovolana Pro
                </p>
                <p className="text-xs font-tech text-amber-200/90 mt-1">
                  Yearly plan: {formatKes(annualPrice, currency)}/yr (2 months free)
                </p>
              </div>
              <HudPriceDock
                label="MONTHLY"
                price={formatKes(monthlyPrice, currency)}
                sublabel="/ month"
                theme="amber"
                size="lg"
              />
            </div>

            <ul className="space-y-3 text-sm text-slate-100 pt-1">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-300 shrink-0" />
                <span>
                  <strong>{discountPct}% lower fees</strong> ({feePct}% drops to{" "}
                  {(feePct * (1 - discountPct / 100)).toFixed(1)}%)
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-300 shrink-0" />
                <span>
                  <strong>{config?.proEarlyAccessHours ?? 24}h early access</strong> to new writer services
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-300 shrink-0" />
                Faster help from Support if something goes wrong
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-300 shrink-0" />
                Pro Member badge shown on your orders
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-300 shrink-0" />
                Cancel anytime without losing your order history
              </li>
            </ul>
          </div>

          <Link
            href={
              user
                ? "/dashboard/membership"
                : `/auth?callbackUrl=${encodeURIComponent("/dashboard/membership")}`
            }
            className="btn-amber w-full py-3.5 text-sm"
          >
            {user?.membershipTier === "PRO"
              ? "Manage Pro Plan"
              : "Upgrade to Pro"}
          </Link>
        </HudCard>
      </div>

      {/* Live Interactive Fee Calculator */}
      <InteractiveFeeCalculator
        standardFeePct={feePct}
        proDiscountPct={discountPct}
        monthlyProPrice={monthlyPrice}
        currency={currency}
      />
    </div>
  );
}

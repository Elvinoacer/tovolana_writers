import React from "react";
import Link from "next/link";
import { Check, Crown, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatKes } from "@/components/ui/Badges";
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12 animate-reveal">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-tech uppercase tracking-wider px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
          <Crown className="w-3.5 h-3.5 text-amber-700" />
          Transparent Plans
        </span>
        <h1 className="font-editorial text-3xl sm:text-5xl font-semibold text-[#111827] leading-tight">
          Book free forever. Halve fees with Pro.
        </h1>
        <p className="text-sm sm:text-base text-stone-600">
          Core booking stays open to every customer. Upgrade only when fee
          savings pay for themselves.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Free Tier */}
        <div className="editorial-card p-8 bg-white flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-tech uppercase tracking-wider px-3 py-1 rounded-full bg-stone-100 text-stone-800 font-semibold">
                Free Tier
              </span>
              <ShieldCheck className="w-5 h-5 text-[#0f766e]" />
            </div>
            <div>
              <p className="font-editorial text-4xl font-semibold text-[#111827]">
                {currency} 0{" "}
                <span className="text-sm font-sans font-normal text-stone-500">
                  / forever
                </span>
              </p>
            </div>

            <ul className="space-y-3 text-sm text-stone-700 pt-1">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#0f766e] shrink-0" />
                Book any public listing across all categories
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#0f766e] shrink-0" />
                M-Pesa STK Push &amp; Card escrow protection
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#0f766e] shrink-0" />
                Live order chat, private files &amp; revisions
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#0f766e] shrink-0" />
                Creators Hub onboarding via writing assessment
              </li>
              <li className="flex items-center gap-2.5 text-stone-500">
                <Zap className="w-4 h-4 text-stone-400 shrink-0" />
                Standard {feePct}% platform fee
              </li>
            </ul>
          </div>

          <Link
            href={user ? "/explore" : "/auth"}
            className="btn-ghost w-full py-3.5 text-sm"
          >
            {user ? "Browse Services" : "Create Free Account"}
          </Link>
        </div>

        {/* Pro Tier */}
        <div className="editorial-card p-8 bg-gradient-to-br from-white via-amber-50/40 to-amber-100/60 border-amber-300 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                <Crown className="w-3.5 h-3.5" />
                Tovolana Pro
              </span>
              <Sparkles className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="font-editorial text-4xl font-semibold text-[#111827]">
                {formatKes(monthlyPrice, currency)}{" "}
                <span className="text-sm font-sans font-normal text-stone-600">
                  / month
                </span>
              </p>
              <p className="text-xs font-tech text-amber-900 mt-1">
                Annual plan: {formatKes(annualPrice, currency)}/yr (2 months free)
              </p>
            </div>

            <ul className="space-y-3 text-sm text-stone-800 pt-1">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-700 shrink-0" />
                <strong>{discountPct}% lower fees</strong> ({feePct}% drops to{" "}
                {(feePct * (1 - discountPct / 100)).toFixed(1)}%)
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-700 shrink-0" />
                <strong>{config?.proEarlyAccessHours ?? 24}h early access</strong> to new Creator tasks
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-700 shrink-0" />
                Priority dispute tribunal queue
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-700 shrink-0" />
                Verified Pro badge on bookings
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-700 shrink-0" />
                Cancel renewal anytime without losing history
              </li>
            </ul>
          </div>

          <Link
            href={
              user
                ? "/dashboard/membership"
                : `/auth?callbackUrl=${encodeURIComponent("/dashboard/membership")}`
            }
            className="btn-primary w-full py-3.5 text-sm"
          >
            {user?.membershipTier === "PRO"
              ? "Manage Pro Subscription"
              : "Upgrade to Pro via IntaSend"}
          </Link>
        </div>
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

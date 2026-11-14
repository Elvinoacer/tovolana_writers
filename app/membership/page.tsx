import React from "react";
import Link from "next/link";
import { Check, Crown, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatKes } from "@/components/ui/Badges";

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <p className="text-xs font-tech uppercase tracking-wider text-[#1e3a8a]">
          Membership Model (Screen 1.5)
        </p>
        <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#111827]">
          Free accounts unlock full booking. Pro adds fee savings &amp; priority access.
        </h1>
        <p className="text-sm sm:text-base text-stone-600">
          Every registered customer on the Free tier can browse and book any
          publicly listed writing service. Pro rewards frequent clients with{" "}
          {discountPct}% lower platform fees and early access spotlights.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* Free Plan */}
        <div className="editorial-card p-8 bg-white flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-tech uppercase tracking-wider px-2.5 py-1 rounded bg-stone-100 text-stone-700">
                Free Account
              </span>
              <ShieldCheck className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <p className="font-editorial text-3xl font-semibold">
                {currency} 0{" "}
                <span className="text-sm font-sans font-normal text-stone-500">
                  / forever
                </span>
              </p>
              <p className="text-sm text-stone-600 mt-1">
                Complete access to book tasks, upload requirements, chat with
                creators, and request revisions.
              </p>
            </div>

            <ul className="space-y-2.5 text-sm text-stone-700 pt-2">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-700 shrink-0" />
                Unrestricted booking across all 7 active categories
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-700 shrink-0" />
                Escrow payment protection via M-Pesa STK Push &amp; Card
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-700 shrink-0" />
                Real-time order tracking &amp; private attachment vault
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-700 shrink-0" />
                Eligible to apply to Creators Hub via writing assessment
              </li>
              <li className="flex items-center gap-2 text-stone-500">
                <Zap className="w-4 h-4 text-stone-400 shrink-0" />
                Standard {feePct}% platform service fee per booking
              </li>
            </ul>
          </div>

          <Link
            href={user ? "/explore" : "/auth"}
            className="block w-full py-3 rounded-xl border border-[#e6e0d4] bg-[#faf7f2] text-center text-sm font-semibold text-[#111827] hover:bg-stone-200/70 transition-colors"
          >
            {user ? "Browse Services (Free Plan Ready)" : "Create Free Account"}
          </Link>
        </div>

        {/* Pro Plan */}
        <div className="editorial-card p-8 bg-gradient-to-br from-white to-amber-50/70 border-amber-300 flex flex-col justify-between space-y-6 relative">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                <Crown className="w-3.5 h-3.5" />
                Tovolana Pro
              </span>
              <Sparkles className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="font-editorial text-3xl font-semibold">
                {formatKes(monthlyPrice, currency)}{" "}
                <span className="text-sm font-sans font-normal text-stone-600">
                  / month
                </span>
              </p>
              <p className="text-xs font-tech text-amber-900 mt-1">
                Or save with Annual billing: {formatKes(annualPrice, currency)} / year
              </p>
            </div>

            <ul className="space-y-2.5 text-sm text-stone-800 pt-2">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-700 shrink-0" />
                <strong>{discountPct}% Service Fee Discount</strong> (Effective fee drops from {feePct}% to{" "}
                {(feePct * (1 - discountPct / 100)).toFixed(1)}%)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-700 shrink-0" />
                <strong>24-Hour Early Access</strong> to newly published Creator listings
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-700 shrink-0" />
                Priority dispute &amp; support queue routing
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-700 shrink-0" />
                Verified Pro account badge across customer bookings
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-700 shrink-0" />
                Seamless downgrade to Free at expiry without losing history
              </li>
            </ul>
          </div>

          <Link
            href={
              user
                ? "/dashboard/membership"
                : `/auth?callbackUrl=${encodeURIComponent("/dashboard/membership")}`
            }
            className="block w-full py-3 rounded-xl bg-[#1e3a8a] text-white text-center text-sm font-semibold hover:bg-[#172554] transition-colors shadow-sm"
          >
            {user?.membershipTier === "PRO"
              ? "Manage Active Pro Subscription"
              : "Upgrade to Pro via IntaSend"}
          </Link>
        </div>
      </div>

      {/* Savings Preview */}
      <div className="editorial-card p-6 bg-white">
        <h2 className="font-editorial text-xl font-semibold mb-4">
          Example Fee Savings on Real Bookings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-tech">
          {[5000, 10000, 25000].map((amt) => {
            const stdFee = amt * (feePct / 100);
            const proFee = stdFee * (1 - discountPct / 100);
            return (
              <div
                key={amt}
                className="p-4 rounded-lg bg-[#faf7f2] border border-[#e6e0d4] space-y-1"
              >
                <p className="text-xs text-stone-500">Booking Subtotal</p>
                <p className="text-lg font-bold">{formatKes(amt, currency)}</p>
                <p className="text-xs text-stone-600">
                  Free Fee: {formatKes(stdFee, currency)} · Pro Fee:{" "}
                  <strong className="text-amber-800">
                    {formatKes(proFee, currency)}
                  </strong>
                </p>
                <p className="text-xs font-semibold text-teal-800">
                  Saved: {formatKes(stdFee - proFee, currency)} per order
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

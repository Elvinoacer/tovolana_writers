"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Crown,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  CLIENT_CHECKOUT_ADDONS,
  CheckoutMode,
  MILESTONE_SPLIT_RATIO,
  TRIPWIRE_OUTLINE_PRICE_KES,
  calculateAddOnsTotal,
  roundCurrency,
} from "@/lib/pricing";
import { formatKes, formatShortDate } from "@/components/ui/Badges";

export interface SidebarPricingSnapshot {
  listedPrice: number;
  rawServiceFee: number;
  effectiveServiceFee: number;
  proDiscount: number;
  totalPayable: number;
}

export interface TaskCommissionSidebarProps {
  task: {
    id: string;
    slug: string;
    title: string;
    basePrice: number;
    currency: string;
    deliveryTurnaroundDays: number;
    maxRevisions: number;
    pricingType: string;
    validUntil: string | Date | null;
    validityType: string;
    manualAcceptanceRequired: boolean;
    status: string;
  };
  isPublished: boolean;
  userIsAuthenticated: boolean;
  userIsPro: boolean;
  feePct: number;
  proDiscountPct: number;
  freePricing: SidebarPricingSnapshot;
  proPricing: SidebarPricingSnapshot;
}

const MODE_DESCRIPTIONS: Record<CheckoutMode, string> = {
  FULL_ESCROW: "Full amount held in IntaSend escrow until final approval.",
  MILESTONE_SPLIT: "Pay 25% today; remaining 75% on draft preview.",
  TRIPWIRE_OUTLINE: "Start with a 1-page outline & thesis test-drive.",
};

export function TaskCommissionSidebar({
  task,
  isPublished,
  userIsAuthenticated,
  userIsPro,
  feePct,
  proDiscountPct,
  freePricing,
  proPricing,
}: TaskCommissionSidebarProps) {
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>("FULL_ESCROW");
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [addOnsExpanded, setAddOnsExpanded] = useState(false);

  const activePricing = userIsPro ? proPricing : freePricing;

  const { addOnsTotal, itemized: itemizedAddOns } = useMemo(
    () => calculateAddOnsTotal(task.basePrice, selectedAddOns),
    [task.basePrice, selectedAddOns]
  );

  const fullOrderTotal = roundCurrency(activePricing.totalPayable + addOnsTotal);
  const proFullOrderTotal = roundCurrency(proPricing.totalPayable + addOnsTotal);
  const depositAmount = roundCurrency(fullOrderTotal * MILESTONE_SPLIT_RATIO);

  const dueToday =
    checkoutMode === "TRIPWIRE_OUTLINE"
      ? TRIPWIRE_OUTLINE_PRICE_KES
      : checkoutMode === "MILESTONE_SPLIT"
        ? depositAmount
        : fullOrderTotal;

  const remainingBalance =
    checkoutMode === "FULL_ESCROW"
      ? 0
      : roundCurrency(Math.max(0, fullOrderTotal - dueToday));

  const rushActive = selectedAddOns.includes("priority_rush");
  const effectiveTurnaroundDays = rushActive
    ? Math.max(1, Math.ceil(task.deliveryTurnaroundDays / 2))
    : task.deliveryTurnaroundDays;

  const estimatedDeliveryDate = useMemo(() => {
    const target = new Date();
    target.setDate(target.getDate() + effectiveTurnaroundDays);
    return formatShortDate(target);
  }, [effectiveTurnaroundDays]);

  const effectiveFeeDisplayPct =
    activePricing.listedPrice > 0
      ? Math.round((activePricing.rawServiceFee / activePricing.listedPrice) * 100)
      : feePct;

  const bookingTarget = `/book/${task.id}?mode=${checkoutMode}&addons=${encodeURIComponent(
    selectedAddOns.join(",")
  )}`;
  const ctaHref = userIsAuthenticated
    ? bookingTarget
    : `/auth?callbackUrl=${encodeURIComponent(bookingTarget)}`;

  function toggleAddOn(id: string) {
    setSelectedAddOns((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  const modeTabs: Array<{
    mode: CheckoutMode;
    label: string;
    sub: string;
  }> = [
    { mode: "FULL_ESCROW", label: "Full Escrow", sub: "100%" },
    {
      mode: "MILESTONE_SPLIT",
      label: "25% Deposit",
      sub: formatKes(depositAmount, task.currency),
    },
    {
      mode: "TRIPWIRE_OUTLINE",
      label: "Outline",
      sub: formatKes(TRIPWIRE_OUTLINE_PRICE_KES, task.currency),
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e6e0d4] bg-white shadow-[0_1px_2px_rgba(17,24,39,0.03),0_12px_32px_-14px_rgba(17,24,39,0.1)]">
      {/* Price header */}
      <div className="border-b border-[#e6e0d4] bg-gradient-to-br from-[#faf7f2] to-white px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-[#6b7280]">
              {checkoutMode === "FULL_ESCROW" ? "Total payable" : "Due today"}
            </span>
            <p className="font-tech mt-1 text-[1.85rem] font-bold leading-none tracking-tight text-[#b45309]">
              {formatKes(dueToday, task.currency)}
            </p>
            <p className="mt-2 text-xs text-[#4b5563]">
              <span className="font-tech font-semibold text-[#111827]">
                {effectiveTurnaroundDays}d
              </span>{" "}
              turnaround ·{" "}
              <span className="font-tech font-semibold text-[#111827]">
                {task.maxRevisions}
              </span>{" "}
              revisions
            </p>
          </div>

          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              userIsPro
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-[#e6e0d4] bg-white text-[#4b5563]"
            }`}
          >
            {userIsPro && <Crown className="h-3 w-3 text-amber-700" aria-hidden="true" />}
            {userIsPro ? "Pro rate" : "Standard"}
          </span>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {/* Mode switcher */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold text-[#111827]">Payment structure</p>
          <div
            role="radiogroup"
            aria-label="Commission payment structure"
            className="grid grid-cols-3 gap-1.5 rounded-xl border border-[#e6e0d4] bg-[#faf7f2] p-1"
          >
            {modeTabs.map((tab) => {
              const active = checkoutMode === tab.mode;
              return (
                <button
                  key={tab.mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setCheckoutMode(tab.mode)}
                  className={`cursor-pointer rounded-lg px-1.5 py-2.5 text-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a8a] ${
                    active
                      ? "bg-white text-[#111827] shadow-sm ring-1 ring-[#d6cfc2]"
                      : "text-[#6b7280] hover:text-[#111827]"
                  }`}
                >
                  <span className="block text-[11px] font-semibold leading-tight">
                    {tab.label}
                  </span>
                  <span
                    className={`font-tech mt-1 block text-[10px] leading-tight ${
                      active ? "font-bold text-[#b45309]" : "text-[#6b7280]"
                    }`}
                  >
                    {tab.sub}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs leading-snug text-[#4b5563]">
            {MODE_DESCRIPTIONS[checkoutMode]}
          </p>
        </div>

        {/* Add-ons */}
        <div className="overflow-hidden rounded-xl border border-[#e6e0d4] bg-[#faf7f2]/60">
          <button
            type="button"
            onClick={() => setAddOnsExpanded((v) => !v)}
            aria-expanded={addOnsExpanded}
            className="flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-semibold text-[#111827] transition-colors hover:bg-[#f2ede3]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1e3a8a]"
          >
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#b45309]" aria-hidden="true" />
              Optional upgrades
              {selectedAddOns.length > 0 && (
                <span className="font-tech rounded-full bg-[#1e3a8a] px-1.5 py-0.5 text-[10px] text-white">
                  {selectedAddOns.length}
                </span>
              )}
            </span>
            <span
              className={`inline-flex items-center gap-1 font-tech text-[11px] ${
                addOnsTotal > 0 ? "font-semibold text-[#b45309]" : "text-[#6b7280]"
              }`}
            >
              {addOnsTotal > 0 ? `+${formatKes(addOnsTotal, task.currency)}` : "Add"}
              {addOnsExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </span>
          </button>

          {addOnsExpanded && (
            <div className="space-y-1 border-t border-[#e6e0d4] bg-white p-2">
              {CLIENT_CHECKOUT_ADDONS.map((addon) => {
                const checked = selectedAddOns.includes(addon.id);
                const addonCost =
                  addon.pricingKind === "FLAT"
                    ? addon.value
                    : roundCurrency(task.basePrice * (addon.value / 100));

                return (
                  <label
                    key={addon.id}
                    className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                      checked
                        ? "bg-[#eff6ff] text-[#111827]"
                        : "text-[#4b5563] hover:bg-[#faf7f2]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAddOn(addon.id)}
                        className="h-4 w-4 shrink-0 accent-[#1e3a8a]"
                      />
                      <span className="truncate font-medium">{addon.label}</span>
                    </span>
                    <span className="font-tech shrink-0 text-[11px] font-semibold text-[#b45309]">
                      +{formatKes(addonCost, task.currency)}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Fee ledger */}
        <div className="space-y-2.5 border-t border-[#e6e0d4] pt-4 text-xs">
          <div className="flex justify-between text-[#4b5563]">
            <span>Listed scope</span>
            <span className="font-tech font-medium text-[#111827]">
              {formatKes(activePricing.listedPrice, task.currency)}
            </span>
          </div>

          {itemizedAddOns.map((addon) => (
            <div key={addon.id} className="flex justify-between gap-2 text-[#4b5563]">
              <span className="truncate">+ {addon.label}</span>
              <span className="font-tech shrink-0 font-medium text-[#111827]">
                {formatKes(addon.amount, task.currency)}
              </span>
            </div>
          ))}

          <div className="flex justify-between text-[#4b5563]">
            <span>Service fee ({effectiveFeeDisplayPct}%)</span>
            <span className="font-tech font-medium text-[#111827]">
              {formatKes(activePricing.rawServiceFee, task.currency)}
            </span>
          </div>

          {userIsPro && (
            <div className="flex justify-between font-medium text-amber-800">
              <span>Pro discount (−{proDiscountPct}%)</span>
              <span className="font-tech font-semibold">
                −{formatKes(activePricing.proDiscount, task.currency)}
              </span>
            </div>
          )}

          <div className="flex items-baseline justify-between border-t border-[#e6e0d4] pt-3 text-sm font-semibold text-[#111827]">
            <span>Total payable</span>
            <span className="font-tech text-base font-bold text-[#b45309]">
              {formatKes(fullOrderTotal, task.currency)}
            </span>
          </div>

          {checkoutMode !== "FULL_ESCROW" && (
            <div className="flex justify-between rounded-lg bg-[#faf7f2] px-2.5 py-2 text-[11px] text-[#4b5563]">
              <span className="font-tech font-semibold text-[#b45309]">
                Due today {formatKes(dueToday, task.currency)}
              </span>
              <span className="font-tech">
                Balance {formatKes(remainingBalance, task.currency)}
              </span>
            </div>
          )}
        </div>

        {/* Pro savings */}
        {!userIsPro && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950">
            <span className="flex min-w-0 items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
              <span className="truncate">
                Pro saves{" "}
                <strong>{formatKes(proPricing.proDiscount, task.currency)}</strong>
              </span>
            </span>
            <Link
              href="/membership"
              className="shrink-0 cursor-pointer font-semibold text-[#b45309] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b45309]"
            >
              Upgrade
            </Link>
          </div>
        )}

        {/* Date separation */}
        <div className="space-y-2">
          <div
            title="Booking delivery deadline stays protected once payment enters escrow."
            className="font-tech flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-[11px] font-medium text-blue-900"
          >
            <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1e3a8a]" aria-hidden="true" />
            <span>
              Est. delivery{" "}
              <strong suppressHydrationWarning>{estimatedDeliveryDate}</strong> (
              {effectiveTurnaroundDays}d)
            </span>
          </div>

          {task.validUntil && (
            <div
              title="Public discovery window only; separate from active order deadline."
              className="font-tech flex items-start gap-2 rounded-xl border border-[#e6e0d4] bg-[#f2ede3]/70 px-3 py-2.5 text-[11px] text-[#4b5563]"
            >
              <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6b7280]" aria-hidden="true" />
              <span>Listing open until {formatShortDate(task.validUntil)}</span>
            </div>
          )}
        </div>

        {/* CTA */}
        {isPublished ? (
          <div className="space-y-3">
            <Link
              href={ctaHref}
              className="btn-primary w-full min-h-[48px] cursor-pointer px-5 py-3 text-sm"
            >
              <span>
                {userIsAuthenticated ? "Proceed to brief" : "Sign in to book"}
              </span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#6b7280]">
              <Lock className="h-3 w-3 text-[#0f766e]" aria-hidden="true" />
              <span>M-Pesa · Card · IntaSend Escrow</span>
            </p>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#0f766e]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Funds release only after you approve</span>
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#d6cfc2] bg-[#f2ede3] p-3.5 text-center text-xs text-[#4b5563]">
            Status: <strong className="text-[#111827]">{task.status.replace(/_/g, " ")}</strong>{" "}
            — closed to new bookings.
          </div>
        )}
      </div>
    </div>
  );
}

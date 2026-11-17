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
    <div className="editorial-card overflow-hidden bg-white p-5 sm:p-6 space-y-5">
      {/* Prominent Price & Spec Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[11px] font-medium text-stone-500 block">
            {checkoutMode === "FULL_ESCROW" ? "Total Payable" : "Due Today"}
          </span>
          <p className="font-tech text-2xl sm:text-[1.75rem] font-bold tracking-tight text-[#b45309] mt-0.5">
            {formatKes(dueToday, task.currency)}
          </p>
          <p className="font-tech text-xs text-stone-500 mt-1">
            {effectiveTurnaroundDays}d turnaround · {task.maxRevisions} revisions
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold shrink-0 ${
            userIsPro
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-stone-200 bg-[#faf7f2] text-stone-700"
          }`}
        >
          {userIsPro && <Crown className="h-3 w-3 text-amber-700" />}
          <span>{userIsPro ? "Pro Rate" : "Standard Rate"}</span>
        </span>
      </div>

      {/* Compact 3-Tab Commission Mode Switcher */}
      <div className="space-y-2">
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
                className={`rounded-lg px-2 py-2 text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a8a] ${
                  active
                    ? "bg-white text-[#111827] shadow-xs ring-1 ring-[#e6e0d4]"
                    : "text-stone-600 hover:text-[#111827]"
                }`}
              >
                <span className="block text-[11px] font-semibold leading-tight">
                  {tab.label}
                </span>
                <span
                  className={`font-tech mt-0.5 block text-[10px] leading-tight ${
                    active ? "text-[#b45309] font-bold" : "text-stone-500"
                  }`}
                >
                  {tab.sub}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-stone-600 leading-snug">
          {MODE_DESCRIPTIONS[checkoutMode]}
        </p>
      </div>

      {/* Compact 1-Line Optional Upgrades Drawer */}
      <div className="rounded-xl border border-[#e6e0d4] bg-[#faf7f2]/70">
        <button
          type="button"
          onClick={() => setAddOnsExpanded((v) => !v)}
          aria-expanded={addOnsExpanded}
          className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-semibold text-[#111827] rounded-xl hover:bg-[#f2ede3]/60 transition-colors"
        >
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#b45309]" />
            <span>Optional Upgrades</span>
            {selectedAddOns.length > 0 && (
              <span className="font-tech rounded-full bg-[#1e3a8a] px-1.5 py-0.5 text-[10px] text-white">
                {selectedAddOns.length}
              </span>
            )}
          </span>
          <span
            className={`inline-flex items-center gap-1 font-tech text-[11px] ${
              addOnsTotal > 0 ? "font-semibold text-[#b45309]" : "text-stone-600"
            }`}
          >
            {addOnsTotal > 0 ? `+${formatKes(addOnsTotal, task.currency)}` : "Add"}
            {addOnsExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </span>
        </button>

        {addOnsExpanded && (
          <div className="border-t border-[#e6e0d4] bg-white p-2 space-y-1 rounded-b-xl">
            {CLIENT_CHECKOUT_ADDONS.map((addon) => {
              const checked = selectedAddOns.includes(addon.id);
              const addonCost =
                addon.pricingKind === "FLAT"
                  ? addon.value
                  : roundCurrency(task.basePrice * (addon.value / 100));

              return (
                <label
                  key={addon.id}
                  className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs cursor-pointer transition-colors ${
                    checked ? "bg-blue-50/60 text-[#111827]" : "hover:bg-[#faf7f2] text-stone-700"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAddOn(addon.id)}
                      className="accent-[#1e3a8a] shrink-0"
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

      {/* Concise Zero-Ambiguity Fee Ledger */}
      <div className="space-y-2 border-t border-[#e6e0d4] pt-4 text-xs">
        <div className="flex justify-between text-stone-600">
          <span>Listed Scope</span>
          <span className="font-tech font-medium text-[#111827]">
            {formatKes(activePricing.listedPrice, task.currency)}
          </span>
        </div>

        {itemizedAddOns.map((addon) => (
          <div key={addon.id} className="flex justify-between gap-2 text-stone-600">
            <span className="truncate">+ {addon.label}</span>
            <span className="font-tech shrink-0 font-medium text-[#111827]">
              {formatKes(addon.amount, task.currency)}
            </span>
          </div>
        ))}

        <div className="flex justify-between text-stone-600">
          <span>Service Fee ({effectiveFeeDisplayPct}%)</span>
          <span className="font-tech font-medium text-[#111827]">
            {formatKes(activePricing.rawServiceFee, task.currency)}
          </span>
        </div>

        {userIsPro && (
          <div className="flex justify-between text-amber-800 font-medium">
            <span>Pro Discount (-{proDiscountPct}%)</span>
            <span className="font-tech font-semibold">
              -{formatKes(activePricing.proDiscount, task.currency)}
            </span>
          </div>
        )}

        <div className="flex justify-between items-baseline border-t border-[#e6e0d4] pt-2.5 text-sm font-semibold text-[#111827]">
          <span>Total Payable</span>
          <span className="font-tech text-base font-bold text-[#b45309]">
            {formatKes(fullOrderTotal, task.currency)}
          </span>
        </div>

        {checkoutMode !== "FULL_ESCROW" && (
          <div className="flex justify-between text-[11px] text-stone-500">
            <span className="font-tech font-semibold text-[#b45309]">
              Due today {formatKes(dueToday, task.currency)}
            </span>
            <span className="font-tech">
              Balance {formatKes(remainingBalance, task.currency)}
            </span>
          </div>
        )}
      </div>

      {/* Single Sleek Pro Savings Bar */}
      {!userIsPro && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/75 px-3 py-2.5 text-xs text-amber-950">
          <span className="flex items-center gap-1.5 min-w-0">
            <Crown className="h-3.5 w-3.5 text-amber-700 shrink-0" />
            <span className="truncate">
              Pro saves <strong>{formatKes(proPricing.proDiscount, task.currency)}</strong>{" "}
              <span className="font-tech text-amber-900/80">
                ({formatKes(proFullOrderTotal, task.currency)})
              </span>
            </span>
          </span>
          <Link
            href="/membership"
            className="shrink-0 font-semibold text-[#b45309] hover:underline"
          >
            Upgrade →
          </Link>
        </div>
      )}

      {/* Compact Two-Pill Date Separation Bar */}
      <div className="flex flex-wrap gap-2">
        <span
          title="Booking delivery deadline stays protected once payment enters escrow."
          className="font-tech inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-medium text-blue-900"
        >
          <CalendarClock className="h-3.5 w-3.5 text-[#1e3a8a] shrink-0" />
          <span>
            Est. delivery{" "}
            <strong suppressHydrationWarning>{estimatedDeliveryDate}</strong> (
            {effectiveTurnaroundDays}d)
          </span>
        </span>

        {task.validUntil && (
          <span
            title="Public discovery window only; separate from active order deadline."
            className="font-tech inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-100 px-2.5 py-1.5 text-[11px] text-stone-700"
          >
            <Calendar className="h-3.5 w-3.5 text-stone-500 shrink-0" />
            <span>Listing valid {formatShortDate(task.validUntil)}</span>
          </span>
        )}
      </div>

      {/* Primary Action */}
      {isPublished ? (
        <div className="space-y-2.5">
          <Link
            href={ctaHref}
            className="btn-primary w-full min-h-[46px] px-5 py-3 text-sm"
          >
            <span>
              {userIsAuthenticated ? "Proceed to Brief" : "Sign In to Book"}
            </span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-stone-500">
            <Lock className="h-3 w-3 text-[#0f766e]" />
            <span>M-Pesa · Card · IntaSend Escrow</span>
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-300 bg-stone-100 p-3 text-center text-xs text-stone-700">
          Status: <strong>{task.status.replace(/_/g, " ")}</strong> — closed
          to new bookings.
        </div>
      )}
    </div>
  );
}

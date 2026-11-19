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
import { formatKes, formatShortDate, formatStatusLabel } from "@/components/ui/Badges";
import { HudCard, HudPriceDock } from "@/components/ui/AuroraPrimitives";

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
  FULL_ESCROW: "Pay the full amount now. We hold it safely until you approve the finished work.",
  MILESTONE_SPLIT: "Pay 25% today to start. Pay the remaining 75% when you see the draft.",
  TRIPWIRE_OUTLINE: "Pay KES 490 for an outline and Page 1 first. Only pay the rest if you like it.",
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
    { mode: "FULL_ESCROW", label: "Pay Full", sub: "100%" },
    {
      mode: "MILESTONE_SPLIT",
      label: "25% Now",
      sub: formatKes(depositAmount, task.currency),
    },
    {
      mode: "TRIPWIRE_OUTLINE",
      label: "Try Page 1",
      sub: formatKes(TRIPWIRE_OUTLINE_PRICE_KES, task.currency),
    },
  ];

  const dockTheme =
    checkoutMode === "TRIPWIRE_OUTLINE" || userIsPro ? "amber" : "cyan";

  return (
    <HudCard theme="cyan" brackets className="overflow-hidden">
      {/* Price Header */}
      <div className="border-b border-white/[0.1] bg-white/[0.03] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                userIsPro
                  ? "border-amber-400/40 bg-amber-500/15 text-amber-300"
                  : "border-white/[0.14] bg-white/[0.06] text-slate-300"
              }`}
            >
              {userIsPro && <Crown className="h-3 w-3 text-amber-300" aria-hidden="true" />}
              {userIsPro ? "Pro price" : "Free plan"}
            </span>
            <p className="text-xs text-slate-300">
              <span className="font-tech font-semibold text-white">
                {effectiveTurnaroundDays}{" "}
                {effectiveTurnaroundDays === 1 ? "day" : "days"}
              </span>{" "}
              delivery ·{" "}
              <span className="font-tech font-semibold text-white">
                {task.maxRevisions}
              </span>{" "}
              {task.maxRevisions === 1 ? "free edit" : "free edits"}
            </p>
          </div>

          <HudPriceDock
            label={checkoutMode === "FULL_ESCROW" ? "Total price" : "Pay today"}
            price={formatKes(dueToday, task.currency)}
            theme={dockTheme}
            size="md"
          />
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {/* Mode switcher */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold text-white">How would you like to pay?</p>
          <div
            role="radiogroup"
            aria-label="How would you like to pay"
            className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/[0.12] bg-[#060b14]/80 p-1"
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
                  className={`cursor-pointer rounded-lg px-1.5 py-2.5 text-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    active
                      ? "bg-white/[0.12] text-white ring-1 ring-cyan-400/50 shadow-[0_0_14px_rgba(45,212,191,0.18)]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="block text-[11px] font-semibold leading-tight">
                    {tab.label}
                  </span>
                  <span
                    className={`font-tech mt-1 block text-[10px] leading-tight ${
                      active ? "font-bold text-cyan-300" : "text-slate-400"
                    }`}
                  >
                    {tab.sub}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs leading-snug text-slate-300">
            {MODE_DESCRIPTIONS[checkoutMode]}
          </p>
        </div>

        {/* Add-ons */}
        <div className="overflow-hidden rounded-xl border border-white/[0.12] bg-white/[0.04]">
          <button
            type="button"
            onClick={() => setAddOnsExpanded((v) => !v)}
            aria-expanded={addOnsExpanded}
            className="flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400"
          >
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              Optional extras
              {selectedAddOns.length > 0 && (
                <span className="font-tech rounded-full bg-cyan-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
                  {selectedAddOns.length}
                </span>
              )}
            </span>
            <span
              className={`inline-flex items-center gap-1 font-tech text-[11px] ${
                addOnsTotal > 0 ? "font-semibold text-amber-300" : "text-slate-400"
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
            <div className="space-y-1 border-t border-white/[0.1] bg-[#060b14]/65 p-2">
              {CLIENT_CHECKOUT_ADDONS.map((addon) => {
                const checked = selectedAddOns.includes(addon.id);
                const addonCost =
                  addon.pricingKind === "FLAT"
                    ? addon.value
                    : roundCurrency(task.basePrice * (addon.value / 100));

                return (
                  <label
                    key={addon.id}
                    className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors border ${
                      checked
                        ? "bg-sky-500/[0.14] border-sky-400/35 text-white"
                        : "border-transparent text-slate-300 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAddOn(addon.id)}
                        className="h-4 w-4 shrink-0 accent-cyan-400"
                      />
                      <span className="truncate font-medium">{addon.label}</span>
                    </span>
                    <span className="font-tech shrink-0 text-[11px] font-semibold text-amber-300">
                      +{formatKes(addonCost, task.currency)}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Fee ledger */}
        <div className="space-y-2.5 border-t border-white/[0.1] pt-4 text-xs">
          <div className="flex justify-between text-slate-300">
            <span>Service price</span>
            <span className="font-tech font-medium text-white">
              {formatKes(activePricing.listedPrice, task.currency)}
            </span>
          </div>

          {itemizedAddOns.map((addon) => (
            <div key={addon.id} className="flex justify-between gap-2 text-slate-300">
              <span className="truncate">+ {addon.label}</span>
              <span className="font-tech shrink-0 font-medium text-white">
                {formatKes(addon.amount, task.currency)}
              </span>
            </div>
          ))}

          <div className="flex justify-between text-slate-300">
            <span>Service fee ({effectiveFeeDisplayPct}%)</span>
            <span className="font-tech font-medium text-white">
              {formatKes(activePricing.rawServiceFee, task.currency)}
            </span>
          </div>

          {userIsPro && (
            <div className="flex justify-between font-medium text-amber-300">
              <span>Pro savings (−{proDiscountPct}%)</span>
              <span className="font-tech font-semibold">
                −{formatKes(activePricing.proDiscount, task.currency)}
              </span>
            </div>
          )}

          <div className="flex items-baseline justify-between border-t border-white/[0.1] pt-3 text-sm font-semibold text-white">
            <span>Full order total</span>
            <span className="font-tech text-base font-bold text-cyan-300">
              {formatKes(fullOrderTotal, task.currency)}
            </span>
          </div>

          {checkoutMode !== "FULL_ESCROW" && (
            <div className="flex justify-between rounded-lg bg-white/[0.045] border border-white/[0.1] px-2.5 py-2 text-[11px] text-slate-300">
              <span className="font-tech font-semibold text-amber-300">
                Pay today {formatKes(dueToday, task.currency)}
              </span>
              <span className="font-tech">
                Rest later {formatKes(remainingBalance, task.currency)}
              </span>
            </div>
          )}
        </div>

        {/* Pro savings */}
        {!userIsPro && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-400/35 bg-amber-500/[0.1] px-3 py-2.5 text-xs text-amber-200">
            <span className="flex min-w-0 items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
              <span className="truncate">
                Pro saves{" "}
                <strong>{formatKes(proPricing.proDiscount, task.currency)}</strong>
              </span>
            </span>
            <Link
              href="/membership"
              className="shrink-0 cursor-pointer font-semibold text-amber-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              See Pro
            </Link>
          </div>
        )}

        {/* Date separation */}
        <div className="space-y-2">
          <div
            title="Your due date stays locked once you pay."
            className="font-tech flex items-start gap-2 rounded-xl border border-sky-400/30 bg-sky-500/[0.09] px-3 py-2.5 text-[11px] font-medium text-sky-200"
          >
            <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" aria-hidden="true" />
            <span>
              Estimated delivery:{" "}
              <strong suppressHydrationWarning className="text-white">{estimatedDeliveryDate}</strong> (
              {effectiveTurnaroundDays}{" "}
              {effectiveTurnaroundDays === 1 ? "day" : "days"})
            </span>
          </div>

          {task.validUntil && (
            <div
              title="Last day new clients can order. Active orders are never affected."
              className="font-tech flex items-start gap-2 rounded-xl border border-white/[0.11] bg-white/[0.04] px-3 py-2.5 text-[11px] text-slate-300"
            >
              <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span>Open to order until {formatShortDate(task.validUntil)}</span>
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
                {userIsAuthenticated ? "Start Your Order" : "Sign in to Order"}
              </span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Lock className="h-3 w-3 text-teal-400" aria-hidden="true" />
              <span>Pay by M-Pesa or Card</span>
            </p>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-teal-300">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Money held safely until you approve</span>
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.14] bg-white/[0.05] p-3.5 text-center text-xs text-slate-300">
            Status: <strong className="text-white">{formatStatusLabel(task.status)}</strong>{" "}
            — not taking new orders right now.
          </div>
        )}
      </div>
    </HudCard>
  );
}

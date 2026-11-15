"use client";

import React, { useState } from "react";
import { Crown } from "lucide-react";
import { formatKes } from "@/components/ui/Badges";

const PRESET_AMOUNTS = [3500, 6500, 12000, 25000, 50000];

export function InteractiveFeeCalculator({
  standardFeePct = 10,
  proDiscountPct = 50,
  monthlyProPrice = 2500,
  currency = "KES",
}: {
  standardFeePct?: number;
  proDiscountPct?: number;
  monthlyProPrice?: number;
  currency?: string;
}) {
  const [subtotal, setSubtotal] = useState(12000);

  const freeFee = Math.round(subtotal * (standardFeePct / 100));
  const proFeePct = Number(
    (standardFeePct * (1 - proDiscountPct / 100)).toFixed(1)
  );
  const proFee = Math.round(freeFee * (1 - proDiscountPct / 100));
  const savedPerOrder = freeFee - proFee;
  const freeTotal = subtotal + freeFee;
  const proTotal = subtotal + proFee;
  const ordersToBreakEven =
    savedPerOrder > 0 ? Math.ceil(monthlyProPrice / savedPerOrder) : 0;

  return (
    <div className="editorial-card p-6 sm:p-8 bg-white space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#111827]">
            Compare Free and Pro totals
          </h2>
          <p className="text-sm text-stone-600">
            Move the slider to inspect exact platform fees before checkout.
          </p>
        </div>
        <div className="text-left sm:text-right shrink-0">
          <p className="text-xs font-medium text-stone-500">Task Scope</p>
          <p className="font-tech text-3xl font-bold text-[#111827] leading-tight">
            {formatKes(subtotal, currency)}
          </p>
        </div>
      </div>

      {/* Slider + Quick Presets */}
      <div className="space-y-3.5">
        <input
          type="range"
          min={2000}
          max={80000}
          step={500}
          value={subtotal}
          onChange={(e) => setSubtotal(Number(e.target.value))}
          aria-label="Booking subtotal in KES"
          className="w-full h-2 bg-[#ece5d8] rounded-full appearance-none cursor-pointer accent-[#1e3a8a]"
        />
        <div className="flex flex-wrap gap-2">
          {PRESET_AMOUNTS.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setSubtotal(amt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-tech font-medium border transition-colors ${
                subtotal === amt
                  ? "bg-[#111827] text-white border-[#111827]"
                  : "bg-[#faf7f2] text-stone-700 border-[#e6e0d4] hover:bg-[#f2ede3]"
              }`}
            >
              {formatKes(amt, currency)}
            </button>
          ))}
        </div>
      </div>

      {/* Spacious 2-Column Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-[#faf7f2] border border-[#e6e0d4] space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs text-stone-700">
            <span className="font-semibold">Free ({standardFeePct}% fee)</span>
            <span className="font-tech text-stone-600 whitespace-nowrap">
              +{formatKes(freeFee, currency)}
            </span>
          </div>
          <p className="font-tech text-2xl font-bold text-[#111827]">
            {formatKes(freeTotal, currency)}
          </p>
          <div className="w-full h-1.5 rounded-full bg-stone-200 overflow-hidden">
            <div
              className="h-full bg-[#1e3a8a] rounded-full transition-all duration-300"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-300/80 space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs text-amber-950">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Crown className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              Pro ({proFeePct}% fee)
            </span>
            <span className="font-tech font-semibold text-amber-900 whitespace-nowrap">
              +{formatKes(proFee, currency)}
            </span>
          </div>
          <p className="font-tech text-2xl font-bold text-[#111827]">
            {formatKes(proTotal, currency)}
          </p>
          <div className="w-full h-1.5 rounded-full bg-amber-200/70 overflow-hidden">
            <div
              className="h-full bg-[#b45309] rounded-full transition-all duration-300"
              style={{ width: `${Math.max(25, 100 - proDiscountPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Full-Width High-Contrast Savings Summary */}
      <div className="rounded-2xl bg-[#f0fdfa] border border-teal-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-sm font-medium text-[#115e59]">
          Instant Pro saving on this booking
        </span>
        <div className="flex flex-wrap items-baseline justify-between sm:justify-end gap-x-3 gap-y-1">
          <span className="font-tech text-xl font-bold text-[#0f766e] whitespace-nowrap shrink-0">
            -{formatKes(savedPerOrder, currency)}
          </span>
          <span className="text-xs font-tech text-[#115e59] whitespace-nowrap">
            Breaks even in {ordersToBreakEven} order
            {ordersToBreakEven === 1 ? "" : "s"}/mo
          </span>
        </div>
      </div>
    </div>
  );
}

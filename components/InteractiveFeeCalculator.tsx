"use client";

import React, { useState } from "react";
import { Crown, Sparkles } from "lucide-react";
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
  const proFee = Math.round(freeFee * (1 - proDiscountPct / 100));
  const savedPerOrder = freeFee - proFee;
  const freeTotal = subtotal + freeFee;
  const proTotal = subtotal + proFee;
  const ordersToBreakEven =
    savedPerOrder > 0 ? Math.ceil(monthlyProPrice / savedPerOrder) : 0;

  return (
    <div className="editorial-card p-6 sm:p-8 bg-white space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-tech uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
            <Sparkles className="w-3 h-3" />
            Interactive Fee Simulator
          </span>
          <h2 className="font-editorial text-2xl font-semibold text-[#111827] mt-2">
            Slide to see your exact KES fee savings
          </h2>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[11px] font-tech uppercase text-stone-500">
            Selected Booking Scope
          </p>
          <p className="font-tech text-3xl font-bold text-[#111827]">
            {formatKes(subtotal, currency)}
          </p>
        </div>
      </div>

      {/* Slider + Quick Presets */}
      <div className="space-y-3">
        <input
          type="range"
          min={2000}
          max={80000}
          step={500}
          value={subtotal}
          onChange={(e) => setSubtotal(Number(e.target.value))}
          aria-label="Booking subtotal in KES"
          className="w-full h-2.5 bg-[#f2ede3] rounded-full appearance-none cursor-pointer accent-[#1e3a8a]"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setSubtotal(amt)}
                className={`px-2.5 py-1 rounded-lg text-xs font-tech font-medium border transition-colors ${
                  subtotal === amt
                    ? "bg-[#111827] text-white border-[#111827]"
                    : "bg-[#faf7f2] text-stone-700 border-[#e6e0d4] hover:bg-stone-200/70"
                }`}
              >
                {formatKes(amt, currency)}
              </button>
            ))}
          </div>
          <span className="text-xs font-tech text-teal-800 font-semibold">
            Pays for Pro in {ordersToBreakEven} order{ordersToBreakEven === 1 ? "" : "s"}/mo
          </span>
        </div>
      </div>

      {/* Visual Side-by-Side Comparison Bars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="p-4 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-600">
            <span>Free Plan ({standardFeePct}% Fee)</span>
            <span className="font-tech font-semibold">{formatKes(freeFee, currency)}</span>
          </div>
          <p className="font-tech text-xl font-bold text-[#111827]">
            {formatKes(freeTotal, currency)}
          </p>
          <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
            <div
              className="h-full bg-[#1e3a8a] rounded-full transition-all duration-300"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-300 space-y-2">
          <div className="flex items-center justify-between text-xs text-amber-950 font-medium">
            <span className="inline-flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 text-amber-700" />
              Pro Plan ({(standardFeePct * (1 - proDiscountPct / 100)).toFixed(1)}% Fee)
            </span>
            <span className="font-tech font-bold text-amber-800">
              {formatKes(proFee, currency)}
            </span>
          </div>
          <p className="font-tech text-xl font-bold text-amber-950">
            {formatKes(proTotal, currency)}
          </p>
          <div className="w-full h-2 rounded-full bg-amber-200/60 overflow-hidden">
            <div
              className="h-full bg-[#b45309] rounded-full transition-all duration-300"
              style={{ width: `${Math.max(25, 100 - proDiscountPct)}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-200 flex flex-col justify-between">
          <span className="text-xs font-semibold text-teal-900">
            Instant Escrow Saving
          </span>
          <p className="font-tech text-2xl font-bold text-[#0f766e]">
            -{formatKes(savedPerOrder, currency)}
          </p>
          <span className="text-[11px] text-teal-800">
            Saved on this single booking
          </span>
        </div>
      </div>
    </div>
  );
}

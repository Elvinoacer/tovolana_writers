"use client";

import React, { useState } from "react";
import { Crown } from "lucide-react";
import { formatKes } from "@/components/ui/Badges";
import { HudCard, HudPriceDock } from "@/components/ui/AuroraPrimitives";

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
    <HudCard
      theme="cyan"
      brackets
      dotMatrix="right"
      className="p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-white">
            See what you pay before ordering
          </h2>
          <p className="text-sm text-slate-300">
            Move the slider to compare Free and Pro prices.
          </p>
        </div>
        <div className="text-left sm:text-right shrink-0">
          <p className="text-xs font-medium text-slate-400">Service price</p>
          <p className="font-tech text-3xl font-bold aurora-title leading-tight">
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
          aria-label="Service price in KES"
          className="w-full h-2 bg-white/15 rounded-full appearance-none cursor-pointer accent-cyan-400"
        />
        <div className="flex flex-wrap gap-2">
          {PRESET_AMOUNTS.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setSubtotal(amt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-tech font-medium border transition-colors ${
                subtotal === amt
                  ? "bg-cyan-400/20 text-cyan-200 border-cyan-400/60 shadow-[0_0_12px_rgba(45,212,191,0.25)]"
                  : "bg-white/[0.045] text-slate-300 border-white/[0.12] hover:bg-white/[0.1]"
              }`}
            >
              {formatKes(amt, currency)}
            </button>
          ))}
        </div>
      </div>

      {/* Sculpted HUD Comparison Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.045] border border-cyan-400/25 space-y-4">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
            <span className="font-semibold text-white">Free plan ({standardFeePct}% fee)</span>
            <span className="font-tech text-cyan-300 whitespace-nowrap">
              +{formatKes(freeFee, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="aurora-bar-shimmer h-full bg-gradient-to-r from-cyan-400 to-sky-400 rounded-full transition-all duration-300"
                style={{ width: "100%" }}
              />
            </div>
            <HudPriceDock
              label="Total"
              price={formatKes(freeTotal, currency)}
              theme="cyan"
              size="sm"
            />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-amber-500/[0.08] border border-amber-400/35 space-y-4">
          <div className="flex items-center justify-between gap-2 text-xs text-amber-200">
            <span className="inline-flex items-center gap-1.5 font-semibold text-white">
              <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              Pro plan ({proFeePct}% fee)
            </span>
            <span className="font-tech font-semibold text-amber-300 whitespace-nowrap">
              +{formatKes(proFee, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-amber-400/20 overflow-hidden">
              <div
                className="aurora-bar-shimmer h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(25, 100 - proDiscountPct)}%` }}
              />
            </div>
            <HudPriceDock
              label="Pro total"
              price={formatKes(proTotal, currency)}
              theme="amber"
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* High-Contrast Savings Readout */}
      <div className="rounded-2xl bg-emerald-500/[0.1] border border-emerald-400/40 shadow-[0_0_26px_-10px_rgba(52,211,153,0.42)] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-sm font-medium text-emerald-200">
          You save with Pro
        </span>
        <div className="flex flex-wrap items-baseline justify-between sm:justify-end gap-x-3 gap-y-1">
          <span className="font-tech text-xl font-bold text-emerald-300 whitespace-nowrap shrink-0">
            -{formatKes(savedPerOrder, currency)}
          </span>
          <span className="text-xs font-tech text-emerald-200/90 whitespace-nowrap">
            Pays for itself in {ordersToBreakEven} order
            {ordersToBreakEven === 1 ? "" : "s"} a month
          </span>
        </div>
      </div>
    </HudCard>
  );
}

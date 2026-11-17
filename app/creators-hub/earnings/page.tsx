"use client";

import { CreatorShell } from "@/components/CreatorShell";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, Wallet } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { StatusPill, formatKes, formatShortDate } from "@/components/ui/Badges";

interface LedgerEntryRow {
  id: string;
  grossAmount: number;
  platformFee?: number;
  platformCut?: number;
  netAmount: number;
  status: string;
  createdAt: string;
  booking: {
    bookingRef: string;
    taskTitleSnapshot: string;
    status: string;
  };
}

interface PayoutRow {
  id: string;
  amount: number;
  currency: string;
  destinationPhone: string;
  payoutSpeed?: string;
  expressFee?: number;
  netDisbursed?: number;
  status: string;
  requestedAt: string;
}

export default function CreatorEarningsPage() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState({
    pendingEscrow: 0,
    availableBalance: 0,
    paidOutTotal: 0,
    currency: "KES",
  });
  const [ledger, setLedger] = useState<LedgerEntryRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [phoneOverride, setPhoneOverride] = useState<string | null>(null);
  const [payoutSpeed, setPayoutSpeed] = useState<"STANDARD" | "INSTANT_EXPRESS">(
    "STANDARD"
  );
  const phone = phoneOverride ?? user?.phone ?? "";
  const setPhone = (v: string) => setPhoneOverride(v);
  const [fetched, setFetched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadEarnings = useCallback(async () => {
    try {
      const res = await fetch("/api/creators-hub/earnings", {
        cache: "no-store",
      });
      if (res.ok) {
        const j = await res.json();
        setSummary(j.data.summary);
        setLedger(j.data.ledger ?? []);
        setPayouts(j.data.payouts ?? []);
      }
    } finally {
      setFetched(true);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    fetch("/api/creators-hub/earnings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (!active || !j?.data) return;
        setSummary(j.data.summary);
        setLedger(j.data.ledger ?? []);
        setPayouts(j.data.payouts ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setFetched(true);
      });
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const loading = authLoading || (Boolean(user) && !fetched);

  async function handleRequestPayout(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/creators-hub/earnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationPhone: phone, payoutSpeed }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Payout request failed.");
      setNotice(
        payoutSpeed === "INSTANT_EXPRESS"
          ? "Instant Express M-Pesa B2C payout settled immediately!"
          : "M-Pesa B2C payout request queued cleanly (3–5 business days)."
      );
      await loadEarnings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payout request failed.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading Creator earnings ledger...
        </div>
      </main>
    );
  }

  if (!user || !user.roles.includes("CREATOR")) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <h1 className="text-2xl font-editorial font-semibold">
            Creator access required
          </h1>
          <Link
            href="/creators-hub"
            className="inline-flex px-5 py-2.5 rounded-lg bg-[#0f766e] text-white text-sm font-semibold"
          >
            Creators Hub
          </Link>
        </div>
      </main>
    );
  }

  const totalFlow =
    summary.pendingEscrow + summary.availableBalance + summary.paidOutTotal;
  const escrowPct =
    totalFlow > 0 ? Math.round((summary.pendingEscrow / totalFlow) * 100) : 0;
  const readyPct =
    totalFlow > 0 ? Math.round((summary.availableBalance / totalFlow) * 100) : 0;
  const paidPct = Math.max(0, 100 - escrowPct - readyPct);

  return (
    <CreatorShell
      title="Earnings & M-Pesa B2C"
      subtitle="Escrow releases, net creator revenue, and mobile money withdrawals."
    >
      {error && (
        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
          {notice}
        </div>
      )}

      {/* Visual Escrow-to-M-Pesa Pipeline Breakdown */}
      <div className="editorial-card p-6 bg-white space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-tech uppercase tracking-wider text-stone-500 font-semibold">
            3-Stage Revenue Pipeline
          </span>
          <span className="font-tech text-xs text-[#0f766e] font-semibold">
            Lifetime Volume: {formatKes(totalFlow, summary.currency)}
          </span>
        </div>

        <div className="h-3 rounded-full bg-[#f2ede3] overflow-hidden flex">
          {escrowPct > 0 && (
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: `${escrowPct}%` }}
            />
          )}
          {readyPct > 0 && (
            <div
              className="h-full bg-[#0f766e] transition-all duration-500"
              style={{ width: `${readyPct}%` }}
            />
          )}
          {paidPct > 0 && (
            <div
              className="h-full bg-[#111827] transition-all duration-500"
              style={{ width: `${paidPct}%` }}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="p-4 rounded-2xl bg-[#faf7f2] border border-[#e6e0d4]">
            <p className="text-xs text-stone-500">1. Active Escrow</p>
            <p className="font-tech text-2xl font-bold text-amber-800 mt-1">
              {formatKes(summary.pendingEscrow, summary.currency)}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200">
            <p className="text-xs text-teal-900 font-medium">2. Ready to Withdraw</p>
            <p className="font-tech text-2xl font-bold text-[#0f766e] mt-1">
              {formatKes(summary.availableBalance, summary.currency)}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-[#faf7f2] border border-[#e6e0d4]">
            <p className="text-xs text-stone-500">3. M-Pesa Disbursed</p>
            <p className="font-tech text-2xl font-bold text-[#111827] mt-1">
              {formatKes(summary.paidOutTotal, summary.currency)}
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleRequestPayout}
        className="editorial-card p-6 bg-white space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPayoutSpeed("STANDARD")}
            className={`text-left p-4 rounded-xl border transition-colors ${
              payoutSpeed === "STANDARD"
                ? "border-[#0f766e] bg-teal-50/60"
                : "border-[#e6e0d4] bg-[#faf7f2] hover:bg-white"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-[#111827]">Standard M-Pesa Batch</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-tech">
                KES 0 Fee
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-1">
              Queued in 3–5 business days · 100% net payout
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPayoutSpeed("INSTANT_EXPRESS")}
            className={`text-left p-4 rounded-xl border transition-colors ${
              payoutSpeed === "INSTANT_EXPRESS"
                ? "border-[#b45309] bg-amber-50/70"
                : "border-[#e6e0d4] bg-[#faf7f2] hover:bg-white"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-[#111827]">Instant Express M-Pesa</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 font-tech">
                2.5% (Min KES 50)
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-1">
              Settles immediately to M-Pesa · Net{" "}
              <span className="font-tech font-semibold text-[#111827]">
                {formatKes(
                  Math.max(
                    0,
                    summary.availableBalance -
                      (summary.availableBalance > 0
                        ? Math.max(
                            50,
                            Math.round(summary.availableBalance * 0.025)
                          )
                        : 0)
                  ),
                  summary.currency
                )}
              </span>
            </p>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1.5">
              M-Pesa B2C Phone (Min KES 100)
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254712345678"
              className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm font-tech"
            />
          </div>
          <button
            type="submit"
            disabled={busy || summary.availableBalance < 100}
            className="btn-creator px-6 py-2.5 text-sm gap-2 disabled:opacity-50"
          >
            <ArrowDownRight className="w-4 h-4" />
            {payoutSpeed === "INSTANT_EXPRESS"
              ? `Instant Withdraw ${formatKes(
                  Math.max(
                    0,
                    summary.availableBalance -
                      (summary.availableBalance > 0
                        ? Math.max(
                            50,
                            Math.round(summary.availableBalance * 0.025)
                          )
                        : 0)
                  ),
                  summary.currency
                )}`
              : `Withdraw ${formatKes(summary.availableBalance, summary.currency)}`}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="editorial-card p-5 bg-white space-y-3">
          <h2 className="font-editorial text-lg font-semibold flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#0f766e]" />
            Per-Booking Escrow Ledger
          </h2>
          {ledger.length === 0 ? (
            <p className="text-xs text-stone-500">No ledger entries yet.</p>
          ) : (
            <div className="space-y-2.5 text-xs">
              {ledger.map((e) => (
                <div
                  key={e.id}
                  className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-tech font-medium">
                      {e.booking.bookingRef}
                    </p>
                    <p className="text-stone-600 line-clamp-1">
                      {e.booking.taskTitleSnapshot}
                    </p>
                    <p className="text-stone-400">
                      Gross {formatKes(e.grossAmount)} · Fee{" "}
                      {formatKes(e.platformFee ?? e.platformCut ?? 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-tech font-bold text-[#0f766e]">
                      {formatKes(e.netAmount)}
                    </p>
                    <StatusPill status={e.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="editorial-card p-5 bg-white space-y-3">
          <h2 className="font-editorial text-lg font-semibold">
            Payout History
          </h2>
          {payouts.length === 0 ? (
            <p className="text-xs text-stone-500">
              No withdrawals requested yet.
            </p>
          ) : (
            <div className="space-y-2.5 text-xs">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-tech font-medium">
                        {p.destinationPhone}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          p.payoutSpeed === "INSTANT_EXPRESS"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-stone-200 text-stone-700"
                        }`}
                      >
                        {p.payoutSpeed === "INSTANT_EXPRESS"
                          ? "Express"
                          : "Standard"}
                      </span>
                    </div>
                    <p className="text-stone-500 mt-0.5">
                      {formatShortDate(p.requestedAt)}
                      {typeof p.expressFee === "number" && p.expressFee > 0
                        ? ` · Fee ${formatKes(p.expressFee, p.currency)}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-tech font-bold">
                      {formatKes(p.netDisbursed ?? p.amount, p.currency)}
                    </p>
                    {p.netDisbursed !== undefined &&
                      p.netDisbursed !== p.amount && (
                        <p className="text-[10px] text-stone-400 font-tech">
                          Gross {formatKes(p.amount, p.currency)}
                        </p>
                      )}
                    <StatusPill status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CreatorShell>
  );
}

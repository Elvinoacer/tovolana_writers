"use client";

import { HudCard, RadarAvatar } from "@/components/ui/AuroraPrimitives";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import {
  StatusPill,
  formatKes,
  formatPaymentChannel,
  formatPaymentPurpose,
  formatShortDate,
} from "@/components/ui/Badges";

interface FinanceData {
  transactions: Array<{
    id: string;
    apiRef: string;
    purpose: string;
    channel: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    user: { name: string; email: string };
    booking: { bookingRef: string } | null;
  }>;
  refunds: Array<{
    id: string;
    amount: number;
    reason: string;
    status: string;
    createdAt: string;
    booking: { bookingRef: string } | null;
  }>;
  payouts: Array<{
    id: string;
    amount: number;
    currency: string;
    destinationPhone: string;
    status: string;
    requestedAt: string;
    creator: { displayName: string; username: string };
  }>;
}

export default function AdminFinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFinance = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/finance/reconcile", {
        cache: "no-store",
      });
      if (res.ok) {
        const j = await res.json();
        setData(j.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/finance/reconcile", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (active && j?.data) setData(j.data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function issueRefund(transactionId: string, amount: number) {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/finance/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "REFUND",
        transactionId,
        amount,
        reason: "Admin-approved refund reconciliation",
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error?.message || "Refund failed.");
      return;
    }
    setNotice(`Recorded refund of ${formatKes(amount)}.`);
    await loadFinance();
  }

  async function markPayoutPaid(payoutId: string) {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/finance/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "MARK_PAYOUT_PAID",
        payoutId,
        providerRef: `MPESA_B2C_${payoutId.slice(-8).toUpperCase()}`,
        reason: "Paid via M-Pesa",
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error?.message || "Could not mark payout as paid.");
      return;
    }
    setNotice("Writer payout marked as paid.");
    await loadFinance();
  }

  return (
    <AdminShell
      title="Payments & Payouts"
      subtitle="See incoming payments, send client refunds, and mark writer M-Pesa payouts as paid."
      requiredScope="FINANCE_ADMIN"
    >
      {error && (
        <div className="p-3.5 rounded-lg border border-rose-400/35 bg-rose-500/15 text-rose-200 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-lg border border-emerald-400/35 bg-emerald-500/15 text-emerald-200 text-sm">
          {notice}
        </div>
      )}

      {loading || !data ? (
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading payments and payouts...
        </div>
      ) : (
        <div className="space-y-6">
          <HudCard theme="emerald" className="p-6 space-y-4">
            <h2 className="font-editorial text-lg font-semibold text-white">
              Writer M-Pesa Payout Requests ({data.payouts.length})
            </h2>
            {data.payouts.length === 0 ? (
              <p className="text-xs text-slate-400">
                No payouts requested yet.
              </p>
            ) : (
              <div className="space-y-2.5 text-xs">
                {data.payouts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-white/[0.045] border border-white/[0.11] flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="flex items-center gap-3">
                      <RadarAvatar
                        name={p.creator.displayName}
                        size="sm"
                        theme="emerald"
                      />
                      <div>
                        <p className="font-semibold text-white">
                          {p.creator.displayName} (@{p.creator.username}) ·{" "}
                          <span className="font-tech text-teal-300">
                            {p.destinationPhone}
                          </span>
                        </p>
                        <p className="text-slate-400">
                          Requested {formatShortDate(p.requestedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-tech font-bold text-sm text-white">
                        {formatKes(p.amount, p.currency)}
                      </span>
                      <StatusPill status={p.status} />
                      {p.status !== "PAID" && (
                        <button
                          onClick={() => markPayoutPaid(p.id)}
                          className="btn-creator px-3.5 py-1.5 text-xs gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Paid via M-Pesa
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </HudCard>

          <div className="editorial-card p-6 space-y-4 overflow-x-auto">
            <h2 className="font-editorial text-lg font-semibold text-white">
              All Payments
            </h2>
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.04] border-b border-white/[0.08] text-slate-400">
                <tr>
                  <th className="p-3.5">Payment Ref</th>
                  <th className="p-3.5">Person / Reason</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.08]">
                {data.transactions.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="p-3.5 font-tech text-slate-300">
                      {t.apiRef}
                    </td>
                    <td className="p-3.5">
                      <p className="font-semibold text-white">{t.user.name}</p>
                      <p className="text-slate-400">
                        {formatPaymentPurpose(t.purpose)}{" "}
                        {t.booking ? `(${t.booking.bookingRef})` : ""} ·{" "}
                        {formatPaymentChannel(t.channel)}
                      </p>
                    </td>
                    <td className="p-3.5 font-tech font-bold text-cyan-300">
                      {formatKes(t.amount, t.currency)}
                    </td>
                    <td className="p-3.5">
                      <StatusPill status={t.status} />
                    </td>
                    <td className="p-3.5">
                      {t.status === "COMPLETE" && (
                        <button
                          onClick={() => issueRefund(t.id, t.amount)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-rose-400/35 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 font-semibold transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Issue Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

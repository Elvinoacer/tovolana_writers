"use client";

import { CreatorAvatar } from "@/components/ui/EditorialVisuals";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { StatusPill, formatKes, formatShortDate } from "@/components/ui/Badges";

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
        reason: "Settled via M-Pesa B2C batch",
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error?.message || "Could not mark payout paid.");
      return;
    }
    setNotice("Creator payout marked PAID.");
    await loadFinance();
  }

  return (
    <AdminShell
      title="IntaSend Finance, Refunds & Creator Payouts"
      subtitle="Audit payment webhook transactions, reconcile customer refunds, and settle Creator B2C M-Pesa payouts."
      requiredScope="FINANCE_ADMIN"
    >
      {error && (
        <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
          {notice}
        </div>
      )}

      {loading || !data ? (
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading IntaSend financial ledger...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="editorial-card p-6 bg-white space-y-4">
            <h2 className="font-editorial text-lg font-semibold">
              Creator B2C M-Pesa Payout Requests ({data.payouts.length})
            </h2>
            {data.payouts.length === 0 ? (
              <p className="text-xs text-stone-500">No payouts requested.</p>
            ) : (
              <div className="space-y-2.5 text-xs">
                {data.payouts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="flex items-center gap-3">
                      <CreatorAvatar
                        name={p.creator.displayName}
                        username={p.creator.username}
                        size="sm"
                      />
                      <div>
                        <p className="font-semibold">
                          {p.creator.displayName} (@{p.creator.username}) ·{" "}
                          <span className="font-tech">{p.destinationPhone}</span>
                        </p>
                        <p className="text-stone-500">
                          Requested {formatShortDate(p.requestedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-tech font-bold text-sm">
                        {formatKes(p.amount, p.currency)}
                      </span>
                      <StatusPill status={p.status} />
                      {p.status !== "PAID" && (
                        <button
                          onClick={() => markPayoutPaid(p.id)}
                          className="btn-creator px-3.5 py-1.5 text-xs gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Settle Payout
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="editorial-card p-6 bg-white space-y-4 overflow-x-auto">
            <h2 className="font-editorial text-lg font-semibold">
              IntaSend Payment Ledger
            </h2>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#faf7f2] border-b border-[#e6e0d4] text-stone-600">
                <tr>
                  <th className="p-3.5">Ref</th>
                  <th className="p-3.5">User / Purpose</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Reconcile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e0d4]">
                {data.transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-[#faf7f2]/60 transition-colors">
                    <td className="p-3.5 font-tech">{t.apiRef}</td>
                    <td className="p-3.5">
                      <p className="font-semibold text-[#111827]">{t.user.name}</p>
                      <p className="text-stone-500">
                        {t.purpose}{" "}
                        {t.booking ? `(${t.booking.bookingRef})` : ""} ·{" "}
                        {t.channel}
                      </p>
                    </td>
                    <td className="p-3.5 font-tech font-bold">
                      {formatKes(t.amount, t.currency)}
                    </td>
                    <td className="p-3.5">
                      <StatusPill status={t.status} />
                    </td>
                    <td className="p-3.5">
                      {t.status === "COMPLETE" && (
                        <button
                          onClick={() => issueRefund(t.id, t.amount)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Refund
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

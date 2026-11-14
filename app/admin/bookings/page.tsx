"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import {
  BookingDeadlineTag,
  StatusPill,
  formatKes,
} from "@/components/ui/Badges";

interface AdminBookingRow {
  id: string;
  bookingRef: string;
  status: string;
  totalPayable: number;
  listedPrice: number;
  currency: string;
  agreedDeliveryDeadline: string;
  customer: { name: string; email: string };
  creator: { displayName: string; username: string };
  task: { title: string; status: string };
  dispute: {
    id: string;
    status: string;
    reason: string;
    details: string;
  } | null;
}

export default function AdminBookingsTribunalPage() {
  const [bookings, setBookings] = useState<AdminBookingRow[]>([]);
  const [disputes, setDisputes] = useState<
    Array<{
      id: string;
      reason: string;
      details: string;
      booking: {
        bookingRef: string;
        totalPayable: number;
        listedPrice: number;
        currency: string;
        customer: { name: string };
        creator: { displayName: string };
      };
    }>
  >([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setBookings(j.data?.activeBookings ?? []);
        setDisputes(j.data?.openDisputes ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/overview", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (!active || !j?.data) return;
        setBookings(j.data.activeBookings ?? []);
        setDisputes(j.data.openDisputes ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function resolveDispute(
    disputeId: string,
    outcome:
      | "RESOLVED_REFUND"
      | "RESOLVED_PARTIAL_SPLIT"
      | "RESOLVED_RELEASE_CREATOR",
    totalPayable: number,
    listedPrice: number
  ) {
    setError(null);
    setNotice(null);
    const refundAmount =
      outcome === "RESOLVED_REFUND"
        ? totalPayable
        : outcome === "RESOLVED_PARTIAL_SPLIT"
          ? Math.round(totalPayable / 2)
          : 0;
    const creatorReleaseAmount =
      outcome === "RESOLVED_RELEASE_CREATOR"
        ? Math.round(listedPrice * 0.9)
        : outcome === "RESOLVED_PARTIAL_SPLIT"
          ? Math.round((listedPrice * 0.9) / 2)
          : 0;

    const res = await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outcome,
        refundAmount,
        creatorReleaseAmount,
        resolutionNote:
          notes[disputeId] ||
          `Tribunal determination: ${outcome.replace(/_/g, " ")}`,
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error?.message || "Resolution failed.");
      return;
    }
    setNotice(`Dispute resolved cleanly: ${outcome}`);
    await loadBookings();
  }

  return (
    <AdminShell
      title="Booking Oversight & Dispute Tribunal"
      subtitle="Monitor delivery deadlines across all bookings and arbitrate frozen escrow disputes."
      requiredScope="SUPPORT_ADMIN"
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

      {/* Open Disputes */}
      <div className="editorial-card p-6 space-y-4">
        <h2 className="font-editorial text-xl font-semibold flex items-center gap-2 text-rose-900">
          <Scale className="w-5 h-5" />
          Active Dispute Tribunal Queue ({disputes.length})
        </h2>
        {disputes.length === 0 ? (
          <p className="text-xs text-stone-500">
            No open disputes requiring arbitration.
          </p>
        ) : (
          <div className="space-y-4">
            {disputes.map((d) => (
              <div
                key={d.id}
                className="p-5 rounded-xl border border-rose-200 bg-rose-50/40 space-y-3"
              >
                <div className="flex justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-tech text-xs px-2 py-0.5 rounded bg-white border border-rose-200">
                      {d.booking.bookingRef}
                    </span>
                    <h3 className="font-semibold text-base mt-1">
                      {d.reason}
                    </h3>
                    <p className="text-xs text-stone-600">
                      Customer: {d.booking.customer.name} · Creator:{" "}
                      {d.booking.creator.displayName}
                    </p>
                  </div>
                  <p className="font-tech font-bold text-base">
                    Escrow:{" "}
                    {formatKes(d.booking.totalPayable, d.booking.currency)}
                  </p>
                </div>
                <p className="text-xs text-stone-700 bg-white p-3 rounded border border-rose-100">
                  {d.details}
                </p>
                <input
                  type="text"
                  value={notes[d.id] ?? ""}
                  onChange={(e) =>
                    setNotes((p) => ({ ...p, [d.id]: e.target.value }))
                  }
                  placeholder="Formal arbitration ruling note..."
                  className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      resolveDispute(
                        d.id,
                        "RESOLVED_REFUND",
                        d.booking.totalPayable,
                        d.booking.listedPrice
                      )
                    }
                    className="px-3.5 py-2 rounded-lg bg-rose-700 text-white text-xs font-semibold"
                  >
                    Full Refund to Customer
                  </button>
                  <button
                    onClick={() =>
                      resolveDispute(
                        d.id,
                        "RESOLVED_PARTIAL_SPLIT",
                        d.booking.totalPayable,
                        d.booking.listedPrice
                      )
                    }
                    className="px-3.5 py-2 rounded-lg bg-amber-700 text-white text-xs font-semibold"
                  >
                    50/50 Partial Split
                  </button>
                  <button
                    onClick={() =>
                      resolveDispute(
                        d.id,
                        "RESOLVED_RELEASE_CREATOR",
                        d.booking.totalPayable,
                        d.booking.listedPrice
                      )
                    }
                    className="px-3.5 py-2 rounded-lg bg-[#0f766e] text-white text-xs font-semibold"
                  >
                    Release Escrow to Creator
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Recent Bookings */}
      <div className="editorial-card p-5 space-y-3">
        <h2 className="font-editorial text-lg font-semibold">
          Platform Bookings Register ({bookings.length})
        </h2>
        {loading ? (
          <p className="text-xs text-stone-500">Loading bookings...</p>
        ) : (
          <div className="divide-y divide-[#e6e0d4] text-xs">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-tech px-2 py-0.5 rounded bg-stone-100">
                      {b.bookingRef}
                    </span>
                    <StatusPill status={b.status} />
                    <span className="text-stone-500">
                      Listing Status: {b.task.status}
                    </span>
                  </div>
                  <p className="font-medium text-sm">{b.task.title}</p>
                  <p className="text-stone-500">
                    Customer: {b.customer.name} → Creator:{" "}
                    {b.creator.displayName}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <BookingDeadlineTag
                    deadline={b.agreedDeliveryDeadline}
                    status={b.status}
                  />
                  <span className="font-tech font-bold">
                    {formatKes(b.totalPayable, b.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}

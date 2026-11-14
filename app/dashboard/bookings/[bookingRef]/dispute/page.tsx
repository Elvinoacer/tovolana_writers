"use client";

import { CustomerShell } from "@/components/CustomerShell";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { StatusPill, formatKes } from "@/components/ui/Badges";

interface DisputeBookingContext {
  bookingRef: string;
  taskTitleSnapshot: string;
  status: string;
  totalPayable: number;
  currency: string;
  task?: { cancellationPolicy: string } | null;
}

export default function BookingDisputePage({
  params,
}: {
  params: Promise<{ bookingRef: string }>;
}) {
  const { bookingRef } = use(params);
  const router = useRouter();
  const [booking, setBooking] = useState<DisputeBookingContext | null>(null);
  const [action, setAction] = useState<"CANCEL" | "DISPUTE">("DISPUTE");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/bookings/${encodeURIComponent(bookingRef)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => {
        const b = j.data?.booking ?? null;
        setBooking(b);
        if (
          b &&
          (b.status === "PENDING_PAYMENT" ||
            b.status === "PAID_AWAITING_ACCEPTANCE")
        ) {
          setAction("CANCEL");
        }
      })
      .catch(() => {});
  }, [bookingRef]);

  const canCancelDirectly =
    booking?.status === "PENDING_PAYMENT" ||
    booking?.status === "PAID_AWAITING_ACCEPTANCE";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/bookings/${encodeURIComponent(bookingRef)}/dispute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: canCancelDirectly ? action : "DISPUTE",
            reason,
            details,
          }),
        }
      );
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error?.message || "Failed to file case.");
      }
      router.push(`/dashboard/bookings/${bookingRef}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CustomerShell
      title="Cancel or Escalate Dispute"
      subtitle={
        booking
          ? `${booking.taskTitleSnapshot} · Escrow ${formatKes(booking.totalPayable, booking.currency)}`
          : bookingRef
      }
    >
      <div className="max-w-3xl space-y-5">
        <Link
          href={`/dashboard/bookings/${bookingRef}`}
          className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-[#111827]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Booking Workspace
        </Link>

        <div className="editorial-card p-6 sm:p-8 bg-white space-y-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <span className="font-tech text-xs px-2 py-0.5 rounded bg-[#faf7f2] border border-[#e6e0d4] text-stone-700">
                {bookingRef}
              </span>
              <h2 className="text-xl font-editorial font-semibold mt-1.5 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-700" />
                Escrow Protection &amp; Resolution
              </h2>
            </div>
            {booking && <StatusPill status={booking.status} />}
          </div>

          {booking?.task?.cancellationPolicy && (
            <div className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] text-xs text-stone-700">
              <strong>Policy: </strong>
              {booking.task.cancellationPolicy}
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {canCancelDirectly && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAction("CANCEL")}
                  className={`p-4 rounded-2xl border text-left text-xs transition-all ${
                    action === "CANCEL"
                      ? "border-[#1e3a8a] bg-blue-50/50 ring-2 ring-[#1e3a8a]/20"
                      : "border-[#e6e0d4] bg-[#faf7f2] hover:bg-white"
                  }`}
                >
                  <p className="font-semibold text-sm text-[#111827]">
                    Direct Cancellation
                  </p>
                  <p className="text-stone-600 mt-1">
                    Available prior to Creator active start.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setAction("DISPUTE")}
                  className={`p-4 rounded-2xl border text-left text-xs transition-all ${
                    action === "DISPUTE"
                      ? "border-rose-600 bg-rose-50/50 ring-2 ring-rose-600/20"
                      : "border-[#e6e0d4] bg-[#faf7f2] hover:bg-white"
                  }`}
                >
                  <p className="font-semibold text-sm text-[#111827]">
                    Admin Tribunal
                  </p>
                  <p className="text-stone-600 mt-1">
                    Freezes escrow pending Admin review.
                  </p>
                </button>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">
                Headline Reason
              </label>
              <input
                required
                minLength={5}
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Missed delivery deadline / Scope mismatch"
                className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Evidence &amp; Outcome Requested
              </label>
              <textarea
                required
                minLength={10}
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Concise facts, timestamps, and desired split or refund..."
                className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Link
                href={`/dashboard/bookings/${bookingRef}`}
                className="btn-ghost px-4 py-2 text-sm"
              >
                Back
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-rose-700 text-white text-sm font-semibold hover:bg-rose-800 disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? "Submitting..."
                  : action === "CANCEL" && canCancelDirectly
                    ? "Confirm Cancellation"
                    : "Freeze Escrow & File Dispute"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </CustomerShell>
  );
}

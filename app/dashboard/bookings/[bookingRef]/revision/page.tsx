"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckSquare, Plus, RotateCcw, Trash2 } from "lucide-react";
import { StatusPill } from "@/components/ui/Badges";

interface BookingRevisionContext {
  bookingRef: string;
  taskTitleSnapshot: string;
  status: string;
  revisionCount: number;
  maxRevisions: number;
  task?: { revisionPolicy: string } | null;
}

export default function BookingRevisionPage({
  params,
}: {
  params: Promise<{ bookingRef: string }>;
}) {
  const { bookingRef } = use(params);
  const router = useRouter();
  const [booking, setBooking] = useState<BookingRevisionContext | null>(null);
  const [reason, setReason] = useState("");
  const [checklistInput, setChecklistInput] = useState("");
  const [checklist, setChecklist] = useState<string[]>([
    "Align section headings with the original rubric",
    "Verify APA/citation consistency throughout",
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/bookings/${encodeURIComponent(bookingRef)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => setBooking(j.data?.booking ?? null))
      .catch(() => {});
  }, [bookingRef]);

  function addChecklistItem() {
    if (!checklistInput.trim()) return;
    setChecklist((prev) => [...prev, checklistInput.trim()]);
    setChecklistInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/bookings/${encodeURIComponent(bookingRef)}/revision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason,
            checklist,
          }),
        }
      );
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error?.message || "Revision request failed.");
      }
      router.push(`/dashboard/bookings/${bookingRef}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit revision.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link
        href={`/dashboard/bookings/${bookingRef}`}
        className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-[#111827]"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Booking Workspace
      </Link>

      <div className="editorial-card p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <span className="font-tech text-xs text-stone-500">
              {bookingRef}
            </span>
            <h1 className="text-2xl font-editorial font-semibold mt-0.5">
              Request Structured Revision
            </h1>
            {booking && (
              <p className="text-sm text-stone-600 mt-1">
                {booking.taskTitleSnapshot} — Round{" "}
                <strong>{booking.revisionCount + 1}</strong> of{" "}
                <strong>{booking.maxRevisions}</strong>
              </p>
            )}
          </div>
          {booking && <StatusPill status={booking.status} />}
        </div>

        {booking?.task?.revisionPolicy && (
          <div className="p-4 rounded-lg bg-[#faf7f2] border border-[#e6e0d4] text-xs text-stone-700">
            <strong className="text-[#111827]">Service Revision Policy: </strong>
            {booking.task.revisionPolicy}
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Detailed Revision Summary
            </label>
            <textarea
              required
              minLength={10}
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain clearly which sections need expanding, correction, or formatting updates..."
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="space-y-2.5">
            <label className="block text-sm font-medium">
              Actionable Revision Checklist
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={checklistInput}
                onChange={(e) => setChecklistInput(e.target.value)}
                placeholder="Add a specific checklist item..."
                className="flex-1 rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addChecklistItem}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[#e6e0d4] bg-white text-xs font-semibold hover:bg-stone-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            <ul className="space-y-2 pt-1">
              {checklist.map((item, idx) => (
                <li
                  key={`${item}-${idx}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-stone-50 border border-[#e6e0d4] text-xs"
                >
                  <span className="flex items-center gap-2">
                    <CheckSquare className="w-3.5 h-3.5 text-[#1e3a8a]" />
                    {item}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setChecklist((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-stone-400 hover:text-rose-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link
              href={`/dashboard/bookings/${bookingRef}`}
              className="px-4 py-2 rounded-lg border border-[#e6e0d4] text-sm font-medium text-stone-700"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || reason.trim().length < 10}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-700 text-white text-sm font-semibold hover:bg-orange-800 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              {submitting ? "Sending Revision..." : "Submit Revision Request"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

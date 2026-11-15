"use client";

import {
  CreatorAvatar,
  EscrowStepVisualizer,
} from "@/components/ui/EditorialVisuals";

import React, { useCallback, useEffect, useState } from "react";
import { Download, FileText, Scale, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import {
  BookingDeadlineTag,
  StatusPill,
  formatKes,
} from "@/components/ui/Badges";
import { deleteBookingFileById } from "@/lib/upload-constants";

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

interface AdminDisputeFileRow {
  id: string;
  fileName: string;
  fileCategory: string;
  sizeBytes: number;
  createdAt: string;
  uploader?: { id: string; name: string } | null;
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
        files?: AdminDisputeFileRow[];
      };
    }>
  >([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
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

  async function handleDeleteEvidenceFile(fileId: string) {
    setError(null);
    setNotice(null);
    setDeletingFileId(fileId);
    try {
      await deleteBookingFileById(fileId);
      setNotice("Booking evidence file deleted.");
      await loadBookings();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete evidence file."
      );
    } finally {
      setDeletingFileId(null);
    }
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
      <div className="editorial-card p-6 bg-white space-y-4">
        <h2 className="font-editorial text-xl font-semibold flex items-center gap-2 text-rose-900">
          <Scale className="w-5 h-5" />
          Escrow Dispute Tribunal ({disputes.length})
        </h2>
        {disputes.length === 0 ? (
          <p className="text-xs text-stone-500 py-2">
            Zero open disputes requiring arbitration.
          </p>
        ) : (
          <div className="space-y-4">
            {disputes.map((d) => (
              <div
                key={d.id}
                className="p-5 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-4"
              >
                <div className="flex justify-between flex-wrap gap-3">
                  <div>
                    <span className="font-tech text-xs px-2.5 py-0.5 rounded-full bg-white border border-rose-200">
                      {d.booking.bookingRef}
                    </span>
                    <h3 className="font-editorial text-lg font-semibold mt-1.5">
                      {d.reason}
                    </h3>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {d.booking.customer.name} vs. {d.booking.creator.displayName}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-tech uppercase text-rose-700">
                      Frozen Escrow
                    </span>
                    <p className="font-tech font-bold text-lg text-[#111827]">
                      {formatKes(d.booking.totalPayable, d.booking.currency)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-stone-700 bg-white p-3.5 rounded-xl border border-rose-100">
                  {d.details}
                </p>
                <div className="rounded-xl border border-rose-100 bg-white p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-tech uppercase text-stone-500">
                    <span>Booking &amp; Evidence Files</span>
                    <span>{d.booking.files?.length ?? 0} file(s)</span>
                  </div>
                  {d.booking.files && d.booking.files.length > 0 ? (
                    <ul className="space-y-1.5">
                      {d.booking.files.map((file) => (
                        <li
                          key={file.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e6e0d4] bg-[#fbf9f5] px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-[#111827] truncate">
                                {file.fileName}
                              </p>
                              <p className="text-[11px] text-stone-500">
                                {file.fileCategory.replace(/_/g, " ")} &bull;{" "}
                                {(file.sizeBytes / 1024).toFixed(1)} KB
                                {file.uploader?.name
                                  ? ` • Uploaded by ${file.uploader.name}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={`/api/files/${file.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-[#e6e0d4] bg-white px-2.5 py-1 font-medium text-teal-800 hover:bg-stone-50"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvidenceFile(file.id)}
                              disabled={deletingFileId === file.id}
                              aria-label={`Delete ${file.fileName}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            >
                              <Trash2 className="w-3 h-3" />
                              {deletingFileId === file.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-stone-500">
                      No files attached to this booking.
                    </p>
                  )}
                </div>
                <input
                  type="text"
                  value={notes[d.id] ?? ""}
                  onChange={(e) =>
                    setNotes((p) => ({ ...p, [d.id]: e.target.value }))
                  }
                  placeholder="Formal arbitration ruling note..."
                  className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2 text-xs"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={() =>
                      resolveDispute(
                        d.id,
                        "RESOLVED_REFUND",
                        d.booking.totalPayable,
                        d.booking.listedPrice
                      )
                    }
                    className="p-3 rounded-xl bg-rose-700 text-white text-xs font-semibold hover:bg-rose-800 transition-colors"
                  >
                    100% Customer Refund
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
                    className="p-3 rounded-xl bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 transition-colors"
                  >
                    50 / 50 Equitable Split
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
                    className="p-3 rounded-xl bg-[#0f766e] text-white text-xs font-semibold hover:bg-teal-900 transition-colors"
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
      <div className="editorial-card p-6 bg-white space-y-4">
        <h2 className="font-editorial text-lg font-semibold">
          Platform Bookings Register ({bookings.length})
        </h2>
        {loading ? (
          <p className="text-xs text-stone-500">Loading bookings...</p>
        ) : (
          <div className="space-y-3 text-xs">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-[#faf7f2] border border-[#e6e0d4] space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-tech px-2 py-0.5 rounded bg-white border border-[#e6e0d4]">
                        {b.bookingRef}
                      </span>
                      <StatusPill status={b.status} />
                      <span className="text-stone-500 font-tech">
                        Listing: {b.task.status}
                      </span>
                    </div>
                    <p className="font-editorial font-semibold text-base text-[#111827]">
                      {b.task.title}
                    </p>
                    <div className="flex items-center gap-2 text-stone-600">
                      <CreatorAvatar name={b.customer.name} size="sm" />
                      <span>
                        {b.customer.name} → {b.creator.displayName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <BookingDeadlineTag
                      deadline={b.agreedDeliveryDeadline}
                      status={b.status}
                    />
                    <span className="font-tech font-bold text-sm text-[#111827]">
                      {formatKes(b.totalPayable, b.currency)}
                    </span>
                  </div>
                </div>
                <EscrowStepVisualizer status={b.status} compact />
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}

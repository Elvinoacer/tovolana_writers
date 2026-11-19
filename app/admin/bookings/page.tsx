"use client";

import { EscrowStepVisualizer } from "@/components/ui/EditorialVisuals";
import { HudCard, RadarAvatar } from "@/components/ui/AuroraPrimitives";

import React, { useCallback, useEffect, useState } from "react";
import { Download, FileText, Scale, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import {
  BookingDeadlineTag,
  StatusPill,
  formatFileCategory,
  formatKes,
  formatStatusLabel,
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
  const [confirmDeleteFileId, setConfirmDeleteFileId] = useState<string | null>(
    null
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json().catch(() => null);
        setBookings(j?.data?.activeBookings ?? []);
        setDisputes(j?.data?.openDisputes ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/overview", { cache: "no-store" })
      .then((res) => (res.ok ? res.json().catch(() => null) : null))
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
          `Support decision: ${
            outcome === "RESOLVED_REFUND"
              ? "Full refund to client"
              : outcome === "RESOLVED_PARTIAL_SPLIT"
                ? "Split 50/50 between client and writer"
                : "Paid writer in full"
          }`,
      }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setError(
        j?.error?.message || `Could not save decision (${res.status}).`
      );
      return;
    }
    setNotice("Support case closed and updated.");
    await loadBookings();
  }

  async function handleDeleteEvidenceFile(fileId: string) {
    setError(null);
    setNotice(null);
    setDeletingFileId(fileId);
    try {
      await deleteBookingFileById(fileId);
      setNotice("File removed.");
      await loadBookings();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove file."
      );
    } finally {
      setDeletingFileId(null);
      setConfirmDeleteFileId(null);
    }
  }

  return (
    <AdminShell
      title="Orders & Support Help"
      subtitle="Keep track of active orders and settle any support cases fairly."
      requiredScope="SUPPORT_ADMIN"
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

      {/* Open Support Cases */}
      <HudCard
        theme="rose"
        brackets
        microLabel="DISPUTE TRIBUNAL"
        className="p-6 space-y-4"
      >
        <h2 className="font-editorial text-xl font-semibold flex items-center gap-2 text-rose-200">
          <Scale className="w-5 h-5 text-rose-300" />
          Open Support Cases ({disputes.length})
        </h2>
        {disputes.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">
            No open support cases right now.
          </p>
        ) : (
          <div className="space-y-4">
            {disputes.map((d) => (
              <div
                key={d.id}
                className="p-5 rounded-2xl border border-rose-400/35 bg-rose-500/[0.08] space-y-4"
              >
                <div className="flex justify-between flex-wrap gap-3">
                  <div>
                    <span className="font-tech text-xs px-2.5 py-0.5 rounded-full bg-white/[0.08] border border-rose-400/35 text-rose-200">
                      {d.booking.bookingRef}
                    </span>
                    <h3 className="font-editorial text-lg font-semibold text-white mt-1.5">
                      {d.reason}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {d.booking.customer.name} vs.{" "}
                      {d.booking.creator.displayName}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-tech uppercase text-rose-300">
                      Held Amount
                    </span>
                    <p className="font-tech font-bold text-lg text-white">
                      {formatKes(d.booking.totalPayable, d.booking.currency)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-200 bg-white/[0.045] p-3.5 rounded-xl border border-rose-400/20">
                  {d.details}
                </p>
                <div className="rounded-xl border border-rose-400/20 bg-white/[0.04] p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-tech uppercase text-slate-400">
                    <span>Order &amp; Support Files</span>
                    <span>{d.booking.files?.length ?? 0} file(s)</span>
                  </div>
                  {d.booking.files && d.booking.files.length > 0 ? (
                    <ul className="space-y-1.5">
                      {d.booking.files.map((file) => (
                        <li
                          key={file.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-white truncate">
                                {file.fileName}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {formatFileCategory(file.fileCategory)} &bull;{" "}
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
                              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.14] bg-white/[0.06] px-2.5 py-1 font-medium text-teal-300 hover:bg-white/[0.12] transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </a>
                            {confirmDeleteFileId === file.id ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteEvidenceFile(file.id)
                                  }
                                  disabled={deletingFileId === file.id}
                                  aria-label={`Confirm Delete ${file.fileName}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-400/50 bg-rose-600 px-2.5 py-1 font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  {deletingFileId === file.id
                                    ? "Deleting..."
                                    : "Confirm Remove"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteFileId(null)}
                                  disabled={deletingFileId === file.id}
                                  className="inline-flex items-center rounded-lg border border-white/[0.14] bg-white/[0.06] px-2 py-1 font-medium text-slate-300 hover:bg-white/[0.12] disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteFileId(file.id)}
                                disabled={deletingFileId === file.id}
                                aria-label={`Delete ${file.fileName}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-400/35 bg-rose-500/15 px-2.5 py-1 font-medium text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />
                                Remove
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">
                      No files uploaded on this order.
                    </p>
                  )}
                </div>
                <input
                  type="text"
                  value={notes[d.id] ?? ""}
                  onChange={(e) =>
                    setNotes((p) => ({ ...p, [d.id]: e.target.value }))
                  }
                  placeholder="Write your decision message for both sides..."
                  className="hud-input text-xs py-2"
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
                    className="p-3 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition-colors"
                  >
                    Full Refund to Client
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
                    className="btn-amber p-3 text-xs font-semibold"
                  >
                    Split 50/50
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
                    className="btn-creator p-3 text-xs font-semibold"
                  >
                    Pay Writer in Full
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </HudCard>

      {/* All Orders */}
      <HudCard theme="cyan" className="p-6 space-y-4">
        <h2 className="font-editorial text-lg font-semibold text-white">
          All Orders ({bookings.length})
        </h2>
        {loading ? (
          <p className="text-xs text-slate-400">Loading orders...</p>
        ) : (
          <div className="space-y-3 text-xs">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-white/[0.045] border border-white/[0.11] space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-tech px-2 py-0.5 rounded bg-white/[0.07] border border-white/[0.12] text-slate-200">
                        {b.bookingRef}
                      </span>
                      <StatusPill status={b.status} />
                      <span className="text-slate-400 font-tech">
                        Service: {formatStatusLabel(b.task.status)}
                      </span>
                    </div>
                    <p className="font-editorial font-semibold text-base text-white">
                      {b.task.title}
                    </p>
                    <div className="flex items-center gap-2 text-slate-300">
                      <RadarAvatar
                        name={b.customer.name}
                        size="sm"
                        theme="cyan"
                      />
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
                    <span className="font-tech font-bold text-sm text-cyan-300">
                      {formatKes(b.totalPayable, b.currency)}
                    </span>
                  </div>
                </div>
                <EscrowStepVisualizer status={b.status} compact />
              </div>
            ))}
          </div>
        )}
      </HudCard>
    </AdminShell>
  );
}

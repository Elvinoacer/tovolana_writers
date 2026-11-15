"use client";

import { CustomerShell } from "@/components/CustomerShell";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Paperclip, ShieldAlert, Trash2, Upload } from "lucide-react";
import { StatusPill, formatKes } from "@/components/ui/Badges";
import {
  MAX_BROWSER_UPLOAD_LABEL,
  UploadedBookingFileMeta,
  deleteBookingFileById,
  uploadBookingFile,
} from "@/lib/upload-constants";

interface DisputeBookingContext {
  bookingRef: string;
  taskTitleSnapshot: string;
  status: string;
  totalPayable: number;
  currency: string;
  task?: { cancellationPolicy: string } | null;
}

const MAX_DISPUTE_ATTACHMENTS = 5;

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
  const [attachments, setAttachments] = useState<UploadedBookingFileMeta[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/bookings/${encodeURIComponent(bookingRef)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json().catch(() => null) : null))
      .then((j) => {
        const b = j?.data?.booking ?? null;
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
  const effectiveAction = canCancelDirectly ? action : "DISPUTE";

  async function handleAttachmentUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (attachments.length >= MAX_DISPUTE_ATTACHMENTS) {
      setError(`Maximum ${MAX_DISPUTE_ATTACHMENTS} evidence files allowed per dispute.`);
      return;
    }
    setUploadingAttachment(true);
    setError(null);
    try {
      const uploaded = await uploadBookingFile(
        bookingRef,
        file,
        "DISPUTE_EVIDENCE"
      );
      setAttachments((prev) => [...prev, uploaded]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not upload dispute evidence."
      );
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function handleRemoveAttachment(fileId: string) {
    setDeletingAttachmentId(fileId);
    setError(null);
    try {
      await deleteBookingFileById(fileId);
      setAttachments((prev) => prev.filter((item) => item.id !== fileId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove evidence file."
      );
    } finally {
      setDeletingAttachmentId(null);
    }
  }

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
            action: effectiveAction,
            reason,
            details,
            attachmentFileIds:
              effectiveAction === "DISPUTE" && attachments.length > 0
                ? attachments.map((item) => item.id)
                : undefined,
          }),
        }
      );
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          j?.error?.message || `Failed to file case (${res.status}).`
        );
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

            {effectiveAction === "DISPUTE" && (
              <div className="rounded-xl border border-dashed border-[#d8d0c0] bg-[#fbf9f5] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#111827]">
                      <Paperclip className="w-4 h-4 text-rose-700" />
                      Dispute Evidence Attachments (Optional)
                    </span>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Upload up to {MAX_DISPUTE_ATTACHMENTS} supporting files for tribunal review (PDF, DOCX, TXT, MD, CSV, XLSX, ZIP, JPG, PNG, WEBP — Max {MAX_BROWSER_UPLOAD_LABEL} each).
                    </p>
                  </div>
                  <label
                    className={`inline-flex items-center gap-2 rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2 text-xs font-medium text-[#111827] hover:bg-stone-50 transition-colors ${
                      uploadingAttachment ||
                      attachments.length >= MAX_DISPUTE_ATTACHMENTS
                        ? "opacity-50 pointer-events-none"
                        : "cursor-pointer"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingAttachment ? "Uploading..." : "Attach Evidence"}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.zip,.jpg,.jpeg,.png,.webp,.avif"
                      disabled={
                        uploadingAttachment ||
                        attachments.length >= MAX_DISPUTE_ATTACHMENTS
                      }
                      onChange={handleAttachmentUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {attachments.length > 0 && (
                  <ul className="space-y-1.5">
                    {attachments.map((file) => (
                      <li
                        key={file.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-xs"
                      >
                        <a
                          href={`/api/files/${file.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-teal-800 hover:underline truncate"
                        >
                          {file.fileName}{" "}
                          <span className="text-stone-400 font-normal">
                            ({(file.sizeBytes / 1024).toFixed(1)} KB)
                          </span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(file.id)}
                          disabled={deletingAttachmentId === file.id}
                          aria-label={`Remove ${file.fileName}`}
                          className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-900 disabled:opacity-50"
                        >
                          {deletingAttachmentId === file.id ? (
                            "Removing..."
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Link
                href={`/dashboard/bookings/${bookingRef}`}
                className="btn-ghost px-4 py-2 text-sm"
              >
                Back
              </Link>
              <button
                type="submit"
                disabled={
                  submitting ||
                  uploadingAttachment ||
                  deletingAttachmentId !== null
                }
                className="px-5 py-2.5 rounded-xl bg-rose-700 text-white text-sm font-semibold hover:bg-rose-800 disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? "Submitting..."
                  : effectiveAction === "CANCEL"
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

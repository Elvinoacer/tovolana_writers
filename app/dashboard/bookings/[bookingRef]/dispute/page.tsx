"use client";

import { CustomerShell } from "@/components/CustomerShell";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Paperclip, ShieldAlert, Trash2, Upload } from "lucide-react";
import { StatusPill, formatKes } from "@/components/ui/Badges";
import { NextStepBanner } from "@/components/ui/FlowGuide";
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
      title="Cancel Order or Get Support Help"
      subtitle={
        booking
          ? `${booking.taskTitleSnapshot} · Order ${formatKes(booking.totalPayable, booking.currency)}`
          : bookingRef
      }
    >
      <div className="max-w-3xl space-y-5">
        <Link
          href={`/dashboard/bookings/${bookingRef}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Order
        </Link>

        <NextStepBanner
          tone={effectiveAction === "CANCEL" ? "amber" : "rose"}
          eyebrow={effectiveAction === "CANCEL" ? "Before work starts" : "Support help"}
          now={
            effectiveAction === "CANCEL"
              ? "Your writer has not started yet, so you can cancel this order right away."
              : "Asking Support for help pauses payment to the writer while we check what happened."
          }
          next="Fill in what went wrong below and share any proof or screenshots if needed."
          goal="A quick refund or a fair decision from our Support team."
        />

        <div className="editorial-card p-6 sm:p-8 space-y-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <span className="font-tech text-xs px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.12] text-slate-300">
                {bookingRef}
              </span>
              <h2 className="text-xl font-editorial font-semibold text-white mt-1.5 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                How can Support help?
              </h2>
            </div>
            {booking && <StatusPill status={booking.status} />}
          </div>

          {booking?.task?.cancellationPolicy && (
            <div className="p-3.5 rounded-xl bg-white/[0.045] border border-white/[0.12] text-xs text-slate-300">
              <strong className="text-white">Cancellation Rule: </strong>
              {booking.task.cancellationPolicy}
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {canCancelDirectly && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAction("CANCEL")}
                  className={`p-4 rounded-2xl border text-left text-xs transition-all cursor-pointer ${
                    action === "CANCEL"
                      ? "border-sky-400/60 bg-sky-500/15 ring-1 ring-sky-400/40"
                      : "border-white/[0.11] bg-white/[0.04] hover:bg-white/[0.08]"
                  }`}
                >
                  <p className="font-semibold text-sm text-white">Cancel Now</p>
                  <p className="text-slate-300 mt-1">
                    End this order right away before your writer starts.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setAction("DISPUTE")}
                  className={`p-4 rounded-2xl border text-left text-xs transition-all cursor-pointer ${
                    action === "DISPUTE"
                      ? "border-rose-400/60 bg-rose-500/15 ring-1 ring-rose-400/40"
                      : "border-white/[0.11] bg-white/[0.04] hover:bg-white/[0.08]"
                  }`}
                >
                  <p className="font-semibold text-sm text-white">
                    Ask Support to Step In
                  </p>
                  <p className="text-slate-300 mt-1">
                    Holds your money safely until Support reviews both sides.
                  </p>
                </button>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Short Reason
              </label>
              <input
                required
                minLength={5}
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Missed deadline or work did not match instructions"
                className="hud-input w-full px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
                What happened &amp; what you want done
              </label>
              <textarea
                required
                minLength={10}
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Share clear dates, facts, and whether you want a refund or changes..."
                className="hud-input w-full px-3.5 py-2.5 text-sm"
              />
            </div>

            {effectiveAction === "DISPUTE" && (
              <div className="rounded-xl border border-dashed border-white/25 bg-white/[0.04] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white">
                      <Paperclip className="w-4 h-4 text-rose-300" />
                      Supporting Files or Screenshots (Optional)
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Add up to {MAX_DISPUTE_ATTACHMENTS} files to help Support review your case (PDF, Word, text, spreadsheets, ZIP, images — Max {MAX_BROWSER_UPLOAD_LABEL} each).
                    </p>
                  </div>
                  <label
                    className={`btn-ghost px-3.5 py-2 text-xs ${
                      uploadingAttachment ||
                      attachments.length >= MAX_DISPUTE_ATTACHMENTS
                        ? "opacity-50 pointer-events-none"
                        : "cursor-pointer"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingAttachment ? "Uploading..." : "Attach File"}
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
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 py-2 text-xs"
                      >
                        <a
                          href={`/api/files/${file.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-teal-300 hover:underline truncate"
                        >
                          {file.fileName}{" "}
                          <span className="text-slate-400 font-normal">
                            ({(file.sizeBytes / 1024).toFixed(1)} KB)
                          </span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(file.id)}
                          disabled={deletingAttachmentId === file.id}
                          aria-label={`Remove ${file.fileName}`}
                          className="inline-flex items-center gap-1 text-rose-300 hover:text-rose-200 disabled:opacity-50"
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
                className="px-5 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-400 disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? "Sending..."
                  : effectiveAction === "CANCEL"
                    ? "Cancel Order Now"
                    : "Pause Payment & Ask Support"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </CustomerShell>
  );
}

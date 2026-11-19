"use client";

import { CustomerShell } from "@/components/CustomerShell";
import { ScoreRing } from "@/components/ui/EditorialVisuals";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckSquare,
  Paperclip,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { StatusPill } from "@/components/ui/Badges";
import { FlowSteps } from "@/components/ui/FlowGuide";
import {
  MAX_BROWSER_UPLOAD_LABEL,
  UploadedBookingFileMeta,
  deleteBookingFileById,
  uploadBookingFile,
} from "@/lib/upload-constants";

interface BookingRevisionContext {
  bookingRef: string;
  taskTitleSnapshot: string;
  status: string;
  revisionCount: number;
  maxRevisions: number;
  task?: { revisionPolicy: string } | null;
}

const MAX_REVISION_ATTACHMENTS = 5;

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
    "Follow all sections in my original instructions",
    "Double-check spelling, formatting, and citations",
  ]);
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
      .then((j) => setBooking(j?.data?.booking ?? null))
      .catch(() => {});
  }, [bookingRef]);

  function addChecklistItem() {
    if (!checklistInput.trim()) return;
    setChecklist((prev) => [...prev, checklistInput.trim()]);
    setChecklistInput("");
  }

  async function handleAttachmentUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (attachments.length >= MAX_REVISION_ATTACHMENTS) {
      setError(`Maximum ${MAX_REVISION_ATTACHMENTS} evidence files allowed per revision.`);
      return;
    }
    setUploadingAttachment(true);
    setError(null);
    try {
      const uploaded = await uploadBookingFile(
        bookingRef,
        file,
        "REVISION_ATTACHMENT"
      );
      setAttachments((prev) => [...prev, uploaded]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not upload evidence file."
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
        err instanceof Error ? err.message : "Could not remove attachment."
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
        `/api/bookings/${encodeURIComponent(bookingRef)}/revision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason,
            checklist,
            attachmentFileIds:
              attachments.length > 0
                ? attachments.map((item) => item.id)
                : undefined,
          }),
        }
      );
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          j?.error?.message || `Revision request failed (${res.status}).`
        );
      }
      router.push(`/dashboard/bookings/${bookingRef}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit revision.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CustomerShell
      title="Ask for Free Edits"
      subtitle={
        booking
          ? `${booking.taskTitleSnapshot} · Free Edit ${booking.revisionCount + 1} of ${booking.maxRevisions}`
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

        <FlowSteps
          currentStep={1}
          goalLabel="Goal: Get updated files that match what you asked for"
          steps={[
            { label: "1. List changes", hint: "Say what needs fixing" },
            { label: "2. Writer updates", hint: "Reworks your draft" },
            { label: "3. Check & approve", hint: "Pay writer when happy" },
          ]}
        />

        <div className="editorial-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-tech text-xs px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.12] text-slate-300">
                  {bookingRef}
                </span>
                {booking && <StatusPill status={booking.status} />}
              </div>
              <h2 className="text-xl font-editorial font-semibold text-white">
                What would you like changed?
              </h2>
            </div>

            {booking && (
              <ScoreRing
                score={Math.max(0, booking.maxRevisions - booking.revisionCount)}
                max={Math.max(1, booking.maxRevisions)}
                size={68}
                strokeWidth={6}
                label={`${booking.revisionCount}/${booking.maxRevisions}`}
                sublabel="Edits Used"
                tone="gold"
              />
            )}
          </div>

          {booking?.task?.revisionPolicy && (
            <div className="p-3.5 rounded-xl bg-white/[0.045] border border-white/[0.12] text-xs text-slate-300">
              <strong className="text-white">Edit Rule: </strong>
              {booking.task.revisionPolicy}
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5">
                Explain the changes needed
              </label>
              <textarea
                required
                minLength={10}
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Tell your writer clearly which parts need fixing, adding, or updating..."
                className="hud-input w-full px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="space-y-2.5">
              <label className="block text-sm font-medium text-slate-200">
                To-Do Checklist for Your Writer
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={checklistInput}
                  onChange={(e) => setChecklistInput(e.target.value)}
                  placeholder="Add a clear item to fix..."
                  className="hud-input flex-1 px-3.5 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={addChecklistItem}
                  className="btn-ghost px-3.5 py-2 text-xs gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
              <ul className="space-y-2 pt-1">
                {checklist.map((item, idx) => (
                  <li
                    key={`${item}-${idx}`}
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.045] border border-white/[0.11] text-xs text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <CheckSquare className="w-3.5 h-3.5 text-sky-300" />
                      {item}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setChecklist((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-slate-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-dashed border-white/25 bg-white/[0.04] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white">
                    <Paperclip className="w-4 h-4 text-orange-300" />
                    Marked-Up Draft or Notes (Optional)
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Add up to {MAX_REVISION_ATTACHMENTS} files (PDF, Word, text, spreadsheets, ZIP, images — Max {MAX_BROWSER_UPLOAD_LABEL} each).
                  </p>
                </div>
                <label
                  className={`btn-ghost px-3.5 py-2 text-xs ${
                    uploadingAttachment ||
                    attachments.length >= MAX_REVISION_ATTACHMENTS
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
                      attachments.length >= MAX_REVISION_ATTACHMENTS
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
                        <X className="w-3.5 h-3.5" />
                        {deletingAttachmentId === file.id ? "Removing..." : "Remove"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Link
                href={`/dashboard/bookings/${bookingRef}`}
                className="btn-ghost px-4 py-2 text-sm"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={
                  submitting ||
                  uploadingAttachment ||
                  deletingAttachmentId !== null ||
                  reason.trim().length < 10
                }
                className="btn-amber px-5 py-2.5 text-sm disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                {submitting ? "Sending..." : "Send Edit Request"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </CustomerShell>
  );
}

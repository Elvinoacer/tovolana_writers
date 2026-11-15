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
    "Align section headings with the original rubric",
    "Verify APA/citation consistency throughout",
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
      .then((r) => r.json())
      .then((j) => setBooking(j.data?.booking ?? null))
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
    <CustomerShell
      title="Request Revision"
      subtitle={
        booking
          ? `${booking.taskTitleSnapshot} · Round ${booking.revisionCount + 1} of ${booking.maxRevisions}`
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
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-tech text-xs px-2 py-0.5 rounded bg-[#faf7f2] border border-[#e6e0d4] text-stone-700">
                  {bookingRef}
                </span>
                {booking && <StatusPill status={booking.status} />}
              </div>
              <h2 className="text-xl font-editorial font-semibold">
                Revision Brief &amp; Checklist
              </h2>
            </div>

            {booking && (
              <ScoreRing
                score={Math.max(0, booking.maxRevisions - booking.revisionCount)}
                max={Math.max(1, booking.maxRevisions)}
                size={68}
                strokeWidth={6}
                label={`${booking.revisionCount}/${booking.maxRevisions}`}
                sublabel="Rounds Used"
                tone="gold"
              />
            )}
          </div>

          {booking?.task?.revisionPolicy && (
            <div className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] text-xs text-stone-700">
              <strong className="text-[#111827]">Policy: </strong>
              {booking.task.revisionPolicy}
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Summary of Changes
              </label>
              <textarea
                required
                minLength={10}
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State which sections need revision, data updates, or formatting fixes..."
                className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="space-y-2.5">
              <label className="block text-sm font-medium">
                Action Checklist
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={checklistInput}
                  onChange={(e) => setChecklistInput(e.target.value)}
                  placeholder="Add an actionable item..."
                  className="flex-1 rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
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
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] text-xs"
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

            <div className="rounded-xl border border-dashed border-[#d8d0c0] bg-[#fbf9f5] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#111827]">
                    <Paperclip className="w-4 h-4 text-orange-700" />
                    Annotated Drafts / Rubric Evidence (Optional)
                  </span>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Attach up to {MAX_REVISION_ATTACHMENTS} files (PDF, DOCX, TXT, MD, CSV, XLSX, ZIP, JPG, PNG, WEBP — Max {MAX_BROWSER_UPLOAD_LABEL} each).
                  </p>
                </div>
                <label
                  className={`inline-flex items-center gap-2 rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2 text-xs font-medium text-[#111827] hover:bg-stone-50 transition-colors ${
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-700 text-white text-sm font-semibold hover:bg-orange-800 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {submitting ? "Sending..." : "Submit Revision"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </CustomerShell>
  );
}

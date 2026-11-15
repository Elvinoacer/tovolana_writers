"use client";

import { CreatorShell } from "@/components/CreatorShell";
import {
  CreatorAvatar,
  EscrowStepVisualizer,
} from "@/components/ui/EditorialVisuals";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  MessageSquare,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import {
  BookingDeadlineTag,
  StatusPill,
  formatKes,
  formatShortDate,
} from "@/components/ui/Badges";
import {
  MAX_BROWSER_UPLOAD_LABEL,
  canDeleteBookingFile,
  validateClientBookingFile,
} from "@/lib/upload-constants";

interface CreatorOrderDetail {
  id: string;
  bookingRef: string;
  status: string;
  taskTitleSnapshot: string;
  listedPrice: number;
  currency: string;
  agreedDeliveryDeadline: string;
  revisionCount: number;
  maxRevisions: number;
  requirementsResponses: Record<string, unknown>;
  customer: { id?: string; name: string; avatarUrl?: string | null };
  files: Array<{
    id: string;
    uploaderId: string;
    fileName: string;
    fileCategory: string;
    sizeBytes: number;
    revisionId: string | null;
    disputeId: string | null;
    createdAt: string;
    uploader?: { id: string; name: string; avatarUrl?: string | null };
  }>;
  revisions: Array<{
    id: string;
    revisionNumber: number;
    reason: string;
    checklist: string[];
    resolvedAt: string | null;
  }>;
  messages: Array<{
    id: string;
    body: string;
    isSystemMessage: boolean;
    createdAt: string;
    sender: { id: string; name: string };
  }>;
}

export default function CreatorOrderWorkspacePage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [booking, setBooking] = useState<CreatorOrderDetail | null>(null);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [deliverySummary, setDeliverySummary] = useState("");
  const [uploadedDeliverableId, setUploadedDeliverableId] = useState<
    string | null
  >(null);
  const [uploading, setUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [submittingDelivery, setSubmittingDelivery] = useState(false);
  const [msgText, setMsgText] = useState("");

  const loadOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(ref)}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Order not found.");
      setBooking(j.data.booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order.");
    } finally {
      setFetched(true);
    }
  }, [ref]);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    fetch(`/api/bookings/${encodeURIComponent(ref)}`, { cache: "no-store" })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error?.message || "Order not found.");
        return j.data.booking;
      })
      .then((b) => {
        if (active) setBooking(b);
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : "Failed to load order.");
      })
      .finally(() => {
        if (active) setFetched(true);
      });
    return () => {
      active = false;
    };
  }, [authLoading, user, ref]);

  const loading = authLoading || (Boolean(user) && !fetched);

  async function handleAccept(decision: "ACCEPT" | "DECLINE") {
    setError(null);
    const res = await fetch(`/api/bookings/${encodeURIComponent(ref)}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error?.message || "Action failed.");
      return;
    }
    setNotice(
      decision === "ACCEPT"
        ? "Booking accepted and moved to IN PROGRESS."
        : "Booking declined."
    );
    await loadOrder();
  }

  async function handleDeliverableUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const validationError = validateClientBookingFile(file);
    if (validationError) {
      setError(validationError);
      setNotice(null);
      return;
    }

    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("fileCategory", "CREATOR_DELIVERABLE");
      const res = await fetch(
        `/api/bookings/${encodeURIComponent(ref)}/files/presign`,
        {
          method: "POST",
          body: fd,
        }
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Upload failed.");
      setUploadedDeliverableId(j.data.file.id);
      setNotice(`Uploaded deliverable "${file.name}" securely.`);
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload error.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteFile(fileId: string) {
    setDeletingFileId(fileId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Failed to delete file.");
      if (uploadedDeliverableId === fileId) {
        setUploadedDeliverableId(null);
      }
      setNotice("File removed from booking vault.");
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingFileId(null);
    }
  }

  async function handleSubmitDelivery(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingDelivery(true);
    setError(null);
    try {
      const deliverableIds = uploadedDeliverableId
        ? [uploadedDeliverableId]
        : booking?.files
            .filter((f) => f.fileCategory !== "CUSTOMER_BRIEF")
            .map((f) => f.id) ?? [];

      const res = await fetch(
        `/api/bookings/${encodeURIComponent(ref)}/deliver`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliverySummary,
            fileIds: deliverableIds,
          }),
        }
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Delivery submit failed.");
      setNotice("Completed work submitted! Customer notified for review.");
      setDeliverySummary("");
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deliver work.");
    } finally {
      setSubmittingDelivery(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!msgText.trim()) return;
    await fetch(`/api/bookings/${encodeURIComponent(ref)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: msgText.trim() }),
    });
    setMsgText("");
    await loadOrder();
  }

  if (authLoading || loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading Creator order workspace...
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <h1 className="text-xl font-editorial font-semibold">
            {error || "Booking not found"}
          </h1>
          <Link
            href="/creators-hub"
            className="inline-flex px-4 py-2 rounded-lg bg-[#0f766e] text-white text-sm"
          >
            Back to Creators Hub
          </Link>
        </div>
      </main>
    );
  }

  const canDeliver =
    booking.status === "IN_PROGRESS" || booking.status === "REVISION_REQUESTED";

  return (
    <CreatorShell
      title={booking.taskTitleSnapshot}
      subtitle={`Order ${booking.bookingRef} · Client ${booking.customer.name} · ${formatKes(booking.listedPrice, booking.currency)}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/creators-hub"
            className="btn-ghost px-3 py-1.5 text-xs gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Orders
          </Link>
          <span className="font-tech text-xs px-2.5 py-1 rounded-lg bg-white border border-[#e6e0d4]">
            {booking.bookingRef}
          </span>
          <StatusPill status={booking.status} />
          <div className="inline-flex items-center gap-2 pl-1">
            <CreatorAvatar
              name={booking.customer.name}
              avatarUrl={booking.customer.avatarUrl}
              size="sm"
            />
            <span className="text-xs font-semibold text-[#111827]">
              {booking.customer.name}
            </span>
          </div>
        </div>

        <BookingDeadlineTag
          deadline={booking.agreedDeliveryDeadline}
          status={booking.status}
        />
      </div>

      {/* Escrow Stage Pipeline */}
      <div className="editorial-card p-5 bg-white">
        <EscrowStepVisualizer status={booking.status} />
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
          {notice}
        </div>
      )}

      {booking.status === "PAID_AWAITING_ACCEPTANCE" && (
        <div className="editorial-card p-5 bg-amber-50/70 border-amber-200 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm">
            <p className="font-semibold text-amber-950">
              Customer Escrow Funded — Acceptance Required
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Review the brief below and accept to start active delivery.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleAccept("ACCEPT")}
              className="btn-creator px-4 py-2 text-xs"
            >
              Accept Booking
            </button>
            <button
              onClick={() => handleAccept("DECLINE")}
              className="px-4 py-2 rounded-xl border border-rose-300 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {booking.revisions.length > 0 && (
        <div className="editorial-card p-5 border-orange-200 bg-orange-50/50 space-y-2">
          <h2 className="font-editorial text-base font-semibold text-orange-950">
            Revision Checklist ({booking.revisionCount}/{booking.maxRevisions})
          </h2>
          {booking.revisions.map((r) => (
            <div key={r.id} className="text-xs space-y-1">
              <p className="font-semibold">
                Revision #{r.revisionNumber} ({r.resolvedAt ? "RESOLVED" : "OPEN"}
                ): {r.reason}
              </p>
              {Array.isArray(r.checklist) && r.checklist.length > 0 && (
                <ul className="list-disc pl-5 text-stone-700">
                  {r.checklist.map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Submit Delivery Panel */}
          {canDeliver && (
            <form
              onSubmit={handleSubmitDelivery}
              className="editorial-card p-6 space-y-4 border-teal-200 bg-teal-50/40"
            >
              <h2 className="font-editorial text-lg font-semibold flex items-center gap-2 text-[#0f766e]">
                <CheckCircle2 className="w-5 h-5" />
                Submit Final Deliverable
              </h2>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  1. Upload Manuscript (.pdf, .docx, .md, .zip)
                </label>
                <label className="flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border-2 border-dashed border-teal-400 bg-white text-xs font-semibold text-teal-900 cursor-pointer hover:bg-teal-50 transition-colors">
                  <Upload className="w-4 h-4" />
                  {uploading
                    ? "Uploading Deliverable..."
                    : "Choose or Drop Deliverable File"}
                  <input
                    type="file"
                    disabled={uploading}
                    className="hidden"
                    onChange={handleDeliverableUpload}
                  />
                </label>
                <p className="text-[11px] text-stone-500 mt-1">
                  Max {MAX_BROWSER_UPLOAD_LABEL} · PDF, DOCX, TXT, MD, CSV, ZIP, or images.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  2. Delivery Highlights
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={10}
                  value={deliverySummary}
                  onChange={(e) => setDeliverySummary(e.target.value)}
                  placeholder="Summarize sections completed, word count, and citation format..."
                  className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={submittingDelivery}
                className="btn-creator px-5 py-2.5 text-sm gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {submittingDelivery
                  ? "Submitting..."
                  : "Deliver to Customer"}
              </button>
            </form>
          )}

          {/* Files */}
          <div className="editorial-card p-5 bg-white space-y-3">
            <h2 className="font-editorial text-lg font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0f766e]" />
              Order Files
            </h2>
            {booking.files.length === 0 ? (
              <p className="text-xs text-stone-500">No attachments yet.</p>
            ) : (
              <div className="space-y-2.5 text-xs">
                {booking.files.map((f) => {
                  const deletable = canDeleteBookingFile(f, booking.status, user);
                  return (
                    <div
                      key={f.id}
                      className="p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{f.fileName}</p>
                        <p className="text-stone-500">
                          {f.fileCategory.replace(/_/g, " ")} ·{" "}
                          {Math.max(1, Math.round(f.sizeBytes / 1024))} KB
                          {(f.revisionId || f.disputeId) && " · Linked Evidence"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`/api/files/${f.id}`}
                          className="btn-ghost px-3 py-1.5 text-xs text-[#0f766e] gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </a>
                        {deletable && (
                          <button
                            type="button"
                            disabled={deletingFileId === f.id}
                            onClick={() => handleDeleteFile(f.id)}
                            aria-label={`Delete ${f.fileName}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {deletingFileId === f.id ? "Removing..." : "Delete"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="editorial-card p-5 bg-white space-y-4">
            <h2 className="font-editorial text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#0f766e]" />
              Client Thread
            </h2>
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {booking.messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-xl text-sm ${
                    m.isSystemMessage
                      ? "bg-[#faf7f2] border border-[#e6e0d4] text-xs text-stone-600"
                      : m.sender.id === user?.id
                        ? "bg-teal-50 border border-teal-200 ml-6"
                        : "bg-white border border-[#e6e0d4] mr-6"
                  }`}
                >
                  <div className="flex justify-between text-[11px] text-stone-500 mb-1">
                    <span className="font-semibold text-stone-700">
                      {m.isSystemMessage ? "Milestone" : m.sender.name}
                    </span>
                    <span>{formatShortDate(m.createdAt)}</span>
                  </div>
                  <p>{m.body}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                placeholder="Clarify or update the client..."
                className="flex-1 rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
              />
              <button
                type="submit"
                className="btn-creator px-4 py-2.5 text-xs"
              >
                Send
              </button>
            </form>
          </div>
        </div>

        {/* Right Brief Summary */}
        <aside className="space-y-4">
          <div className="editorial-card p-5 bg-white space-y-3">
            <h2 className="font-editorial text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0f766e]" />
              Customer Brief
            </h2>
            <dl className="space-y-2 text-xs">
              {Object.entries(booking.requirementsResponses || {}).map(
                ([k, v]) => (
                  <div key={k} className="border-b border-[#e6e0d4] pb-2 last:border-0">
                    <dt className="text-stone-500 capitalize">{k}</dt>
                    <dd className="font-medium mt-0.5 whitespace-pre-wrap">
                      {String(v)}
                    </dd>
                  </div>
                )
              )}
            </dl>
          </div>
        </aside>
      </div>
    </CreatorShell>
  );
}

"use client";

import { CustomerShell } from "@/components/CustomerShell";
import { EscrowStepVisualizer } from "@/components/ui/EditorialVisuals";
import { HudCard, RadarAvatar } from "@/components/ui/AuroraPrimitives";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Smartphone,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import {
  BookingDeadlineTag,
  ListingValidityTag,
  StatusPill,
  formatFileCategory,
  formatKes,
  formatShortDate,
  formatStatusLabel,
} from "@/components/ui/Badges";
import { NextStepBanner } from "@/components/ui/FlowGuide";
import {
  MAX_BROWSER_UPLOAD_LABEL,
  canDeleteBookingFile,
  validateClientBookingFile,
} from "@/lib/upload-constants";

interface BookingWorkspaceData {
  id: string;
  bookingRef: string;
  status: string;
  taskTitleSnapshot: string;
  listedPrice: number;
  serviceFee: number;
  proDiscount: number;
  totalPayable: number;
  currency: string;
  agreedDeliveryDeadline: string;
  revisionCount: number;
  maxRevisions: number;
  requirementsResponses: Record<string, unknown>;
  createdAt: string;
  task: {
    id: string;
    slug: string;
    title: string;
    status: string;
    validUntil: string | null;
    revisionPolicy: string;
    cancellationPolicy: string;
    category: { name: string };
  };
  creator: {
    id: string;
    username: string;
    displayName: string;
    ratingAverage: number;
    user?: { avatarUrl: string | null } | null;
  };
  files: Array<{
    id: string;
    uploaderId: string;
    fileName: string;
    fileCategory: string;
    sizeBytes: number;
    revisionId: string | null;
    disputeId: string | null;
    createdAt: string;
    uploader: { id: string; name: string; avatarUrl?: string | null };
  }>;
  revisions: Array<{
    id: string;
    revisionNumber: number;
    reason: string;
    checklist: string[];
    resolvedAt: string | null;
    createdAt: string;
  }>;
  messages: Array<{
    id: string;
    body: string;
    isSystemMessage: boolean;
    createdAt: string;
    sender: { id: string; name: string; roles: string[] };
  }>;
  payments: Array<{
    id: string;
    apiRef: string;
    channel: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
  dispute: {
    id: string;
    status: string;
    reason: string;
    details: string;
    resolutionNote: string | null;
  } | null;
  review: {
    id: string;
    rating: number;
    comment: string | null;
  } | null;
}

function getStepIndex(status: string): number {
  switch (status) {
    case "PENDING_PAYMENT":
      return 0;
    case "PAID_AWAITING_ACCEPTANCE":
      return 1;
    case "IN_PROGRESS":
    case "REVISION_REQUESTED":
      return 2;
    case "DELIVERED":
      return 3;
    case "COMPLETED":
      return 4;
    default:
      return 2;
  }
}

export default function CustomerBookingWorkspacePage({
  params,
}: {
  params: Promise<{ bookingRef: string }>;
}) {
  const { bookingRef } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [booking, setBooking] = useState<BookingWorkspaceData | null>(null);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [msgText, setMsgText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const [payChannel, setPayChannel] = useState<"MPESA_STK" | "CARD">("MPESA_STK");
  const [payPhoneOverride, setPayPhoneOverride] = useState<string | null>(null);
  const payPhone = payPhoneOverride ?? user?.phone ?? "";
  const setPayPhone = (v: string) => setPayPhoneOverride(v);
  const [pendingApiRef, setPendingApiRef] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/bookings/${encodeURIComponent(bookingRef)}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.error?.message || `Failed to load booking (${res.status}).`
        );
      }
      if (!json?.data?.booking) {
        throw new Error("Invalid booking payload.");
      }
      setBooking(json.data.booking);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load error.");
    } finally {
      setFetched(true);
    }
  }, [bookingRef]);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    fetch(`/api/bookings/${encodeURIComponent(bookingRef)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            json?.error?.message || `Failed to load booking (${res.status}).`
          );
        }
        if (!json?.data?.booking) {
          throw new Error("Invalid booking payload.");
        }
        return json.data.booking;
      })
      .then((b) => {
        if (active) setBooking(b);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Load error.");
      })
      .finally(() => {
        if (active) setFetched(true);
      });
    return () => {
      active = false;
    };
  }, [authLoading, user, bookingRef]);

  const loading = authLoading || (Boolean(user) && !fetched);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!msgText.trim()) return;
    setSendingMsg(true);
    try {
      const res = await fetch(
        `/api/bookings/${encodeURIComponent(bookingRef)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: msgText.trim() }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(
          j?.error?.message || `Failed to send message (${res.status}).`
        );
      }
      setMsgText("");
      await loadBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSendingMsg(false);
    }
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
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
      fd.append("fileCategory", "CUSTOMER_BRIEF");
      const res = await fetch(
        `/api/bookings/${encodeURIComponent(bookingRef)}/files/presign`,
        {
          method: "POST",
          body: fd,
        }
      );
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error?.message || `Upload failed (${res.status}).`);
      }
      setNotice(`Uploaded ${file.name} safely.`);
      await loadBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
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
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          j?.error?.message || `Could not delete file (${res.status}).`
        );
      }
      setNotice("File removed from project files.");
      await loadBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingFileId(null);
    }
  }

  async function handleInitiateCheckout() {
    setError(null);
    try {
      const res = await fetch(
        `/api/bookings/${encodeURIComponent(bookingRef)}/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: payChannel,
            phone: payChannel === "MPESA_STK" ? payPhone : undefined,
          }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.error?.message || `Checkout failed (${res.status}).`
        );
      }
      setPendingApiRef(json?.data?.transaction?.apiRef ?? null);
      setNotice("Payment request sent. Complete it below to lock in your order.");
      await loadBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    }
  }

  async function handleSimulateComplete() {
    const ref = pendingApiRef || booking?.payments?.[0]?.apiRef;
    if (!ref) return;
    const res = await fetch("/api/payments/simulate-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiRef: ref, state: "COMPLETE" }),
    });
    if (res.ok) {
      setPendingApiRef(null);
      setNotice("Payment confirmed! Your money is held safely and your writer has been notified.");
      await loadBooking();
    }
  }

  async function handleCompleteBooking() {
    setCompleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/bookings/${encodeURIComponent(bookingRef)}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rating,
            comment: reviewComment.trim() || undefined,
          }),
        }
      );
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          j?.error?.message || `Could not finish order (${res.status}).`
        );
      }
      setNotice("Work approved! Your writer has been paid.");
      await loadBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve work.");
    } finally {
      setCompleting(false);
    }
  }

  if (loading || authLoading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading your order details...
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
          <h1 className="text-xl font-editorial font-semibold text-white">
            {error || "Order not found"}
          </h1>
          <Link href="/dashboard" className="btn-primary px-4 py-2 text-sm">
            Back to My Orders
          </Link>
        </div>
      </main>
    );
  }

  const activeStep = getStepIndex(booking.status);
  const canRequestRevision =
    booking.status === "DELIVERED" &&
    booking.revisionCount < booking.maxRevisions;

  const statusGuide: Record<
    string,
    {
      tone: "blue" | "teal" | "amber" | "emerald" | "rose" | "stone";
      now: string;
      next: string;
      goal: string;
    }
  > = {
    PENDING_PAYMENT: {
      tone: "amber",
      now: "Your order is saved, but payment is not completed yet.",
      next: "Pay using M-Pesa or Card below so your writer can start.",
      goal: "Your money stays safely held until you approve finished work.",
    },
    PAID_AWAITING_ACCEPTANCE: {
      tone: "blue",
      now: "We received your payment and notified your writer.",
      next: `${booking.creator.displayName} will accept your order shortly and begin writing.`,
      goal: `Get your finished work on or before ${formatShortDate(booking.agreedDeliveryDeadline)}.`,
    },
    IN_PROGRESS: {
      tone: "blue",
      now: `${booking.creator.displayName} is working on your project right now.`,
      next: "You can send messages or upload extra files anytime below.",
      goal: `Check and approve finished files by ${formatShortDate(booking.agreedDeliveryDeadline)}.`,
    },
    DELIVERED: {
      tone: "teal",
      now: "Your finished files are uploaded and ready for you to check!",
      next: "Download the files under Project Files below. Approve if happy, or ask for a free edit.",
      goal: "Only approve and pay the writer once the work matches your instructions.",
    },
    REVISION_REQUESTED: {
      tone: "amber",
      now: "Your edit request was sent to your writer.",
      next: `${booking.creator.displayName} is updating the work and will upload the new version soon.`,
      goal: "Check the updated files once uploaded and approve when ready.",
    },
    COMPLETED: {
      tone: "emerald",
      now: "This order is complete and your writer has been paid.",
      next: "Your finished files stay saved below whenever you need to download them again.",
      goal: "Order completed safely.",
    },
    DISPUTED: {
      tone: "rose",
      now: "Support is reviewing this order.",
      next: "Check the Support Case box below or reply in Messages if we ask for details.",
      goal: "Reach a fair refund or completion decision.",
    },
    CANCELLED: {
      tone: "stone",
      now: "This order was cancelled.",
      next: "You can browse other writers or post a free job anytime.",
      goal: "Start a new order whenever you need writing help.",
    },
    REFUNDED: {
      tone: "stone",
      now: "This order was refunded.",
      next: "Check your payment summary below for details.",
      goal: "Start a new order whenever you need writing help.",
    },
  };
  const guide = statusGuide[booking.status] ?? statusGuide.IN_PROGRESS;

  return (
    <CustomerShell
      title={booking.taskTitleSnapshot}
      subtitle={`Order ${booking.bookingRef} · Total ${formatKes(booking.totalPayable, booking.currency)}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/dashboard"
            className="btn-ghost px-3 py-1.5 text-xs gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Orders
          </Link>
          <span className="font-tech text-xs px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.12] text-slate-200">
            {booking.bookingRef}
          </span>
          <StatusPill status={booking.status} />
          <div className="inline-flex items-center gap-2 pl-1">
            <RadarAvatar
              name={booking.creator.displayName}
              avatarUrl={booking.creator.user?.avatarUrl}
              theme="cyan"
              size="sm"
            />
            <Link
              href={`/creators/${booking.creator.username}`}
              className="text-xs font-semibold text-teal-300 hover:underline"
            >
              {booking.creator.displayName}
            </Link>
            <span className="text-xs text-slate-400">
              · {formatShortDate(booking.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <BookingDeadlineTag
            deadline={booking.agreedDeliveryDeadline}
            status={booking.status}
          />
          <ListingValidityTag validUntil={booking.task.validUntil} />
          <button
            onClick={loadBooking}
            className="btn-ghost px-3 py-1 text-xs gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Live Progress Bar */}
      <div
        className="editorial-card p-5"
        aria-label={`Step ${activeStep + 1} of 5`}
      >
        <EscrowStepVisualizer status={booking.status} />
      </div>

      {/* Clear Next-Step Banner */}
      <NextStepBanner
        tone={guide.tone}
        eyebrow="Where things stand"
        now={guide.now}
        next={guide.next}
        goal={guide.goal}
      />

      {error && (
        <div className="p-3.5 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-xl border border-emerald-400/35 bg-emerald-500/15 text-emerald-200 text-sm">
          {notice}
        </div>
      )}

      {/* Pending Payment Banner */}
      {booking.status === "PENDING_PAYMENT" && (
        <HudCard theme="amber" brackets className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-editorial text-xl font-semibold text-white">
              Complete Payment ({formatKes(booking.totalPayable, booking.currency)})
            </h2>
            <span className="text-xs font-tech text-amber-200 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-400/40">
              Payment Held Safely
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => setPayChannel("MPESA_STK")}
                className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  payChannel === "MPESA_STK"
                    ? "bg-teal-400/25 text-teal-100 border-teal-400/60"
                    : "bg-white/[0.05] text-slate-300 border-white/[0.12]"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                M-Pesa
              </button>
              <button
                onClick={() => setPayChannel("CARD")}
                className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  payChannel === "CARD"
                    ? "bg-sky-500/25 text-sky-100 border-sky-400/60"
                    : "bg-white/[0.05] text-slate-300 border-white/[0.12]"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Card
              </button>
            </div>
            {payChannel === "MPESA_STK" && (
              <input
                type="tel"
                value={payPhone}
                onChange={(e) => setPayPhone(e.target.value)}
                placeholder="+254712345678"
                className="hud-input px-3.5 py-2 text-xs font-tech"
              />
            )}
            <button
              onClick={handleInitiateCheckout}
              className="btn-primary px-4 py-2 text-xs"
            >
              {payChannel === "MPESA_STK" ? "Pay via M-Pesa" : "Pay by Card"}
            </button>
            {(pendingApiRef || booking.payments.length > 0) && (
              <button
                onClick={handleSimulateComplete}
                className="px-4 py-2 rounded-xl bg-emerald-400 text-slate-950 text-xs font-bold hover:bg-emerald-300 transition-colors"
              >
                Mark as Paid (Demo)
              </button>
            )}
          </div>
        </HudCard>
      )}

      {/* Delivery Acceptance Panel */}
      {booking.status === "DELIVERED" && (
        <HudCard theme="emerald" brackets className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-editorial text-xl font-semibold text-white">
                Your finished work is ready!
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Download your files below to check them. Approve when happy, or ask for a free edit.
              </p>
            </div>
            {canRequestRevision ? (
              <Link
                href={`/dashboard/bookings/${booking.bookingRef}/revision`}
                className="shrink-0 px-4 py-2 rounded-xl border border-orange-400/45 bg-orange-500/15 text-orange-200 text-xs font-semibold hover:bg-orange-500/25"
              >
                Ask for Free Edit ({booking.revisionCount}/{booking.maxRevisions} used)
              </Link>
            ) : (
              <span className="text-xs font-tech text-slate-400">
                Free edits used: {booking.revisionCount}/{booking.maxRevisions}
              </span>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.045] border border-white/[0.12] space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs font-semibold text-slate-200">
                Rate Your Writer &amp; Release Payment
              </p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    className="p-1"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        s <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-600"
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-tech text-slate-300 ml-1.5">{rating}/5</span>
              </div>
            </div>
            <textarea
              rows={2}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Optional public review about quality and speed..."
              className="hud-input w-full px-3.5 py-2 text-xs"
            />
            <button
              disabled={completing}
              onClick={handleCompleteBooking}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-400 text-slate-950 text-xs font-bold hover:bg-emerald-300 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              {completing ? "Finishing..." : "Approve & Pay Writer"}
            </button>
          </div>
        </HudCard>
      )}

      {booking.dispute && (
        <div className="editorial-card p-5 border-rose-400/35 bg-rose-500/15 space-y-1.5">
          <div className="flex items-center gap-2 text-rose-200 font-semibold text-sm">
            <ShieldAlert className="w-4 h-4" />
            Support Case ({formatStatusLabel(booking.dispute.status)}) — {booking.dispute.reason}
          </div>
          <p className="text-xs text-rose-200/90">{booking.dispute.details}</p>
          {booking.dispute.resolutionNote && (
            <p className="text-xs font-medium text-emerald-200 bg-emerald-500/15 p-2.5 rounded-lg border border-emerald-400/35">
              Support Decision: {booking.dispute.resolutionNote}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Project Files */}
          <div className="editorial-card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-editorial text-lg font-semibold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-300" />
                  Project Files
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Max {MAX_BROWSER_UPLOAD_LABEL} · PDF, Word, text, spreadsheets, ZIP, or photos.
                </p>
              </div>
              <label
                className={`btn-primary px-3.5 py-1.5 text-xs gap-1.5 cursor-pointer ${
                  uploading ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading ? "Uploading..." : "Add File"}
                <input
                  type="file"
                  disabled={uploading}
                  className="hidden"
                  onChange={handleUploadFile}
                />
              </label>
            </div>

            {booking.files.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No files uploaded yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {booking.files.map((f) => {
                  const deletable = canDeleteBookingFile(f, booking.status, user);
                  return (
                    <div
                      key={f.id}
                      className="p-3 rounded-xl bg-white/[0.045] border border-white/[0.11] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {f.fileName}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatFileCategory(f.fileCategory)} · {f.uploader.name} ·{" "}
                          {Math.max(1, Math.round(f.sizeBytes / 1024))} KB
                          {(f.revisionId || f.disputeId) && " · Support attachment"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`/api/files/${f.id}`}
                          className="btn-ghost px-3 py-1.5 text-xs gap-1"
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
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-xs font-semibold hover:bg-rose-500/25 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {deletingFileId === f.id ? "Removing..." : "Remove"}
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
          <div className="editorial-card p-5 space-y-4">
            <h2 className="font-editorial text-lg font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-sky-300" />
              Messages
            </h2>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {booking.messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-xl text-sm ${
                    m.isSystemMessage
                      ? "bg-white/[0.05] border border-white/[0.11] text-slate-300 text-xs"
                      : m.sender.id === user?.id
                        ? "bg-sky-500/[0.15] border border-sky-400/35 text-slate-100 ml-6"
                        : "bg-white/[0.04] border border-white/[0.1] text-slate-200 mr-6"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span className="font-semibold text-white">
                      {m.isSystemMessage ? "Order Update" : m.sender.name}
                    </span>
                    <span>{formatShortDate(m.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                placeholder="Write a message to your writer..."
                className="hud-input flex-1 px-3.5 py-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={sendingMsg || !msgText.trim()}
                className="btn-primary px-4 py-2.5 text-xs gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </form>
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="space-y-5">
          <div className="editorial-card p-5 space-y-3">
            <h2 className="font-editorial text-base font-semibold text-white">
              Your Instructions
            </h2>
            <dl className="space-y-2 text-xs">
              {Object.entries(booking.requirementsResponses || {}).map(
                ([k, v]) => (
                  <div
                    key={k}
                    className="border-b border-white/[0.1] pb-2 last:border-0"
                  >
                    <dt className="text-slate-400 capitalize">
                      {k.replace(/([A-Z])/g, " $1")}
                    </dt>
                    <dd className="text-slate-100 font-medium mt-0.5 whitespace-pre-wrap">
                      {String(v)}
                    </dd>
                  </div>
                )
              )}
            </dl>
          </div>

          <div className="editorial-card p-5 space-y-3 text-xs">
            <h2 className="font-editorial text-base font-semibold text-white">
              Payment Summary
            </h2>
            <div className="flex justify-between">
              <span className="text-slate-400">Service Price</span>
              <span className="font-tech text-slate-200">
                {formatKes(booking.listedPrice, booking.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Service Fee</span>
              <span className="font-tech text-slate-200">
                {formatKes(booking.serviceFee, booking.currency)}
              </span>
            </div>
            <div className="flex justify-between font-bold text-sm border-t border-white/[0.1] pt-2 text-white">
              <span>Total Paid</span>
              <span className="font-tech text-cyan-300">
                {formatKes(booking.totalPayable, booking.currency)}
              </span>
            </div>
            {booking.revisions.length > 0 && (
              <div className="pt-2 border-t border-white/[0.1] space-y-1.5">
                <p className="font-semibold text-white">Edit Requests</p>
                {booking.revisions.map((r) => (
                  <p key={r.id} className="text-slate-300">
                    <strong className="text-amber-300">Edit #{r.revisionNumber}</strong> (
                    {r.resolvedAt ? "Done" : "Open"}): {r.reason}
                  </p>
                ))}
              </div>
            )}
            {!["CANCELLED", "REFUNDED", "DISPUTED"].includes(booking.status) && (
              <div className="pt-2 border-t border-white/[0.1]">
                <Link
                  href={`/dashboard/bookings/${booking.bookingRef}/dispute`}
                  className="inline-flex items-center gap-1.5 text-rose-300 hover:underline font-medium"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Cancel or Get Support Help
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </CustomerShell>
  );
}

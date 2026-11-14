"use client";

import { CustomerShell } from "@/components/CustomerShell";
import {
  CreatorAvatar,
  EscrowStepVisualizer,
} from "@/components/ui/EditorialVisuals";

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
  Upload,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import {
  BookingDeadlineTag,
  ListingValidityTag,
  StatusPill,
  formatKes,
  formatShortDate,
} from "@/components/ui/Badges";

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
  };
  files: Array<{
    id: string;
    fileName: string;
    fileCategory: string;
    sizeBytes: number;
    createdAt: string;
    uploader: { id: string; name: string };
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
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to load booking.");
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
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error?.message || "Failed to load booking.");
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
        const j = await res.json();
        throw new Error(j.error?.message || "Failed to send message.");
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
    if (!file) return;
    setUploading(true);
    setError(null);
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
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Upload failed.");
      setNotice(`Uploaded ${file.name} securely to booking vault.`);
      await loadBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Checkout failed.");
      setPendingApiRef(json.data.transaction?.apiRef ?? null);
      setNotice("IntaSend escrow checkout initiated.");
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
      setNotice("Escrow payment confirmed via IntaSend webhook!");
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
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Completion failed.");
      setNotice("Delivery approved! Creator escrow released.");
      await loadBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve delivery.");
    } finally {
      setCompleting(false);
    }
  }

  if (loading || authLoading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading booking workspace...
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
          <h1 className="text-xl font-editorial font-semibold">
            {error || "Booking not accessible"}
          </h1>
          <Link
            href="/dashboard"
            className="inline-flex px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-sm"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const activeStep = getStepIndex(booking.status);
  const canRequestRevision =
    booking.status === "DELIVERED" &&
    booking.revisionCount < booking.maxRevisions;

  return (
    <CustomerShell
      title={booking.taskTitleSnapshot}
      subtitle={`Booking ${booking.bookingRef} · Escrow ${formatKes(booking.totalPayable, booking.currency)}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/dashboard"
            className="btn-ghost px-3 py-1.5 text-xs gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Bookings
          </Link>
          <span className="font-tech text-xs px-2.5 py-1 rounded-lg bg-white border border-[#e6e0d4]">
            {booking.bookingRef}
          </span>
          <StatusPill status={booking.status} />
          <div className="inline-flex items-center gap-2 pl-1">
            <CreatorAvatar
              name={booking.creator.displayName}
              username={booking.creator.username}
              size="sm"
            />
            <Link
              href={`/creators/${booking.creator.username}`}
              className="text-xs font-semibold text-[#0f766e] hover:underline"
            >
              {booking.creator.displayName}
            </Link>
            <span className="text-xs text-stone-500">
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
            Sync
          </button>
        </div>
      </div>

      {/* Live Escrow Stage Stepper */}
      <div
        className="editorial-card p-5 bg-white"
        aria-label={`Stage ${activeStep + 1} of 5`}
      >
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

      {/* Pending Payment Banner */}
      {booking.status === "PENDING_PAYMENT" && (
        <div className="editorial-card p-6 bg-amber-50/70 border-amber-200 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-editorial text-xl font-semibold text-amber-950">
              Fund Escrow ({formatKes(booking.totalPayable, booking.currency)})
            </h2>
            <span className="text-xs font-tech text-amber-900 bg-white px-2.5 py-1 rounded-full border border-amber-200">
              IntaSend Protected
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => setPayChannel("MPESA_STK")}
                className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  payChannel === "MPESA_STK"
                    ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                    : "bg-white text-stone-700 border-[#e6e0d4]"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                M-Pesa STK
              </button>
              <button
                onClick={() => setPayChannel("CARD")}
                className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  payChannel === "CARD"
                    ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                    : "bg-white text-stone-700 border-[#e6e0d4]"
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
                className="px-3.5 py-2 rounded-xl border border-[#e6e0d4] bg-white text-xs font-tech"
              />
            )}
            <button
              onClick={handleInitiateCheckout}
              className="btn-primary px-4 py-2 text-xs"
            >
              Initiate Escrow Payment
            </button>
            {(pendingApiRef || booking.payments.length > 0) && (
              <button
                onClick={handleSimulateComplete}
                className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors"
              >
                Simulate Webhook Complete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delivery Acceptance Panel */}
      {booking.status === "DELIVERED" && (
        <div className="editorial-card p-6 border-indigo-200 bg-indigo-50/50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-editorial text-xl font-semibold text-indigo-950">
                Deliverables Submitted — Ready for Review
              </h2>
              <p className="text-xs text-indigo-900/80 mt-0.5">
                Inspect files below, then approve to release escrow or request a revision.
              </p>
            </div>
            {canRequestRevision ? (
              <Link
                href={`/dashboard/bookings/${booking.bookingRef}/revision`}
                className="shrink-0 px-4 py-2 rounded-xl border border-orange-300 bg-white text-orange-800 text-xs font-semibold hover:bg-orange-50"
              >
                Request Revision ({booking.revisionCount}/{booking.maxRevisions})
              </Link>
            ) : (
              <span className="text-xs font-tech text-stone-600">
                Revisions {booking.revisionCount}/{booking.maxRevisions}
              </span>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-white border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs font-semibold text-stone-700">
                Rate Creator &amp; Release Escrow
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
                          ? "fill-amber-400 text-amber-500"
                          : "text-stone-300"
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-tech text-stone-600 ml-1.5">{rating}/5</span>
              </div>
            </div>
            <textarea
              rows={2}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Optional public feedback on quality & timeliness..."
              className="w-full rounded-xl border border-[#e6e0d4] px-3.5 py-2 text-xs"
            />
            <button
              disabled={completing}
              onClick={handleCompleteBooking}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              {completing ? "Approving..." : "Approve Delivery & Release Escrow"}
            </button>
          </div>
        </div>
      )}

      {booking.dispute && (
        <div className="editorial-card p-5 border-rose-200 bg-rose-50/60 space-y-1.5">
          <div className="flex items-center gap-2 text-rose-900 font-semibold text-sm">
            <ShieldAlert className="w-4 h-4" />
            Dispute ({booking.dispute.status}) — {booking.dispute.reason}
          </div>
          <p className="text-xs text-rose-800">{booking.dispute.details}</p>
          {booking.dispute.resolutionNote && (
            <p className="text-xs font-medium text-emerald-900 bg-white/80 p-2.5 rounded-lg border border-emerald-200">
              Tribunal Note: {booking.dispute.resolutionNote}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* File Vault */}
          <div className="editorial-card p-5 bg-white space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-editorial text-lg font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1e3a8a]" />
                Secure File Vault
              </h2>
              <label className="btn-primary px-3.5 py-1.5 text-xs gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                {uploading ? "Uploading..." : "Upload Brief"}
                <input
                  type="file"
                  className="hidden"
                  onChange={handleUploadFile}
                />
              </label>
            </div>

            {booking.files.length === 0 ? (
              <p className="text-xs text-stone-500 py-4 text-center">
                No files uploaded yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {booking.files.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#111827] truncate">
                        {f.fileName}
                      </p>
                      <p className="text-[11px] text-stone-500">
                        {f.fileCategory.replace(/_/g, " ")} · {f.uploader.name} ·{" "}
                        {Math.max(1, Math.round(f.sizeBytes / 1024))} KB
                      </p>
                    </div>
                    <a
                      href={`/api/files/${f.id}`}
                      className="btn-ghost px-3 py-1.5 text-xs gap-1 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Messaging Thread */}
          <div className="editorial-card p-5 bg-white space-y-4">
            <h2 className="font-editorial text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#1e3a8a]" />
              Workspace Thread
            </h2>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {booking.messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-xl text-sm ${
                    m.isSystemMessage
                      ? "bg-[#faf7f2] border border-[#e6e0d4] text-stone-700 text-xs"
                      : m.sender.id === user?.id
                        ? "bg-blue-50 border border-blue-200 ml-6"
                        : "bg-white border border-[#e6e0d4] mr-6"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                    <span className="font-semibold text-stone-700">
                      {m.isSystemMessage ? "Milestone" : m.sender.name}
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
                placeholder="Message your Creator..."
                className="flex-1 rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
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

        {/* Right Sidebar: Brief & Financials */}
        <aside className="space-y-5">
          <div className="editorial-card p-5 bg-white space-y-3">
            <h2 className="font-editorial text-base font-semibold">
              Requirements Brief
            </h2>
            <dl className="space-y-2 text-xs">
              {Object.entries(booking.requirementsResponses || {}).map(
                ([k, v]) => (
                  <div
                    key={k}
                    className="border-b border-[#e6e0d4] pb-2 last:border-0"
                  >
                    <dt className="text-stone-500 capitalize">
                      {k.replace(/([A-Z])/g, " $1")}
                    </dt>
                    <dd className="text-[#111827] font-medium mt-0.5 whitespace-pre-wrap">
                      {String(v)}
                    </dd>
                  </div>
                )
              )}
            </dl>
          </div>

          <div className="editorial-card p-5 bg-white space-y-3 text-xs">
            <h2 className="font-editorial text-base font-semibold">
              Escrow Ledger
            </h2>
            <div className="flex justify-between">
              <span className="text-stone-600">Listed Price</span>
              <span className="font-tech">
                {formatKes(booking.listedPrice, booking.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Service Fee</span>
              <span className="font-tech">
                {formatKes(booking.serviceFee, booking.currency)}
              </span>
            </div>
            <div className="flex justify-between font-bold text-sm border-t border-[#e6e0d4] pt-2">
              <span>Total Escrow</span>
              <span className="font-tech text-[#1e3a8a]">
                {formatKes(booking.totalPayable, booking.currency)}
              </span>
            </div>
            {booking.revisions.length > 0 && (
              <div className="pt-2 border-t border-[#e6e0d4] space-y-1.5">
                <p className="font-semibold text-stone-800">Revision Log</p>
                {booking.revisions.map((r) => (
                  <p key={r.id} className="text-stone-600">
                    <strong>#{r.revisionNumber}</strong> (
                    {r.resolvedAt ? "RESOLVED" : "OPEN"}): {r.reason}
                  </p>
                ))}
              </div>
            )}
            {!["CANCELLED", "REFUNDED", "DISPUTED"].includes(booking.status) && (
              <div className="pt-2 border-t border-[#e6e0d4]">
                <Link
                  href={`/dashboard/bookings/${booking.bookingRef}/dispute`}
                  className="inline-flex items-center gap-1.5 text-rose-700 hover:underline font-medium"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Cancel / Dispute
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </CustomerShell>
  );
}

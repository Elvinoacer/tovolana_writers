"use client";

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

const TIMELINE_STEPS = [
  "Booked",
  "Escrow Funded",
  "In Progress",
  "Delivered",
  "Completed",
];

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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-[#111827] mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Customer Bookings
          </Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-tech text-xs px-2.5 py-0.5 rounded bg-stone-100 border border-stone-200">
              {booking.bookingRef}
            </span>
            <StatusPill status={booking.status} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-editorial font-semibold mt-1.5">
            {booking.taskTitleSnapshot}
          </h1>
          <p className="text-xs text-stone-600 mt-1">
            Creator:{" "}
            <Link
              href={`/creators/${booking.creator.username}`}
              className="text-[#0f766e] font-semibold hover:underline"
            >
              {booking.creator.displayName}
            </Link>{" "}
            · Booked {formatShortDate(booking.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <BookingDeadlineTag
            deadline={booking.agreedDeliveryDeadline}
            status={booking.status}
          />
          <ListingValidityTag validUntil={booking.task.validUntil} />
          <button
            onClick={loadBooking}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-[#e6e0d4] bg-white text-xs text-stone-700 hover:bg-stone-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync
          </button>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="editorial-card p-4 overflow-x-auto">
        <div className="grid grid-cols-5 gap-2 min-w-[540px]">
          {TIMELINE_STEPS.map((label, idx) => {
            const done = idx <= activeStep;
            return (
              <div key={label} className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-full text-xs font-tech flex items-center justify-center shrink-0 ${
                    done
                      ? "bg-[#1e3a8a] text-white"
                      : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {idx + 1}
                </span>
                <span
                  className={`text-xs font-medium ${
                    done ? "text-[#111827]" : "text-stone-400"
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

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

      {/* Pending Payment Banner */}
      {booking.status === "PENDING_PAYMENT" && (
        <div className="editorial-card p-6 bg-amber-50/60 border-amber-200 space-y-4">
          <h2 className="font-editorial text-lg font-semibold text-amber-950">
            Escrow Funding Required ({formatKes(booking.totalPayable, booking.currency)})
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => setPayChannel("MPESA_STK")}
                className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
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
                className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
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
                className="px-3 py-2 rounded-lg border border-[#e6e0d4] bg-white text-xs font-tech"
              />
            )}
            <button
              onClick={handleInitiateCheckout}
              className="px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-xs font-semibold hover:bg-[#172554]"
            >
              Initiate Escrow Payment
            </button>
            {(pendingApiRef || booking.payments.length > 0) && (
              <button
                onClick={handleSimulateComplete}
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800"
              >
                Simulate Sandbox Webhook Complete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delivery Acceptance Panel */}
      {booking.status === "DELIVERED" && (
        <div className="editorial-card p-6 border-indigo-200 bg-indigo-50/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-editorial text-xl font-semibold text-indigo-950">
                Work Delivered — Review Deliverables
              </h2>
              <p className="text-sm text-indigo-900/80 mt-0.5">
                Your Creator has submitted the completed deliverables in the File
                Exchange Vault and messaging log below.
              </p>
            </div>
            {canRequestRevision ? (
              <Link
                href={`/dashboard/bookings/${booking.bookingRef}/revision`}
                className="shrink-0 px-4 py-2 rounded-lg border border-orange-300 bg-white text-orange-800 text-xs font-semibold hover:bg-orange-50"
              >
                Request Revision ({booking.revisionCount}/{booking.maxRevisions}{" "}
                used)
              </Link>
            ) : (
              <span className="text-xs text-stone-600">
                Revision quota used ({booking.revisionCount}/
                {booking.maxRevisions})
              </span>
            )}
          </div>

          <div className="p-4 rounded-lg bg-white border border-indigo-100 space-y-3">
            <p className="text-xs font-semibold text-stone-700">
              Approve Delivery & Rate Creator (Releases Escrow)
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
              <span className="text-xs text-stone-500 ml-2">{rating}/5 stars</span>
            </div>
            <textarea
              rows={2}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Optional public feedback on writing quality and timeliness..."
              className="w-full rounded-lg border border-[#e6e0d4] px-3 py-2 text-xs"
            />
            <button
              disabled={completing}
              onClick={handleCompleteBooking}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {completing
                ? "Approving..."
                : "Approve Final Delivery & Release Escrow"}
            </button>
          </div>
        </div>
      )}

      {booking.dispute && (
        <div className="editorial-card p-5 border-rose-200 bg-rose-50/60 space-y-1.5">
          <div className="flex items-center gap-2 text-rose-900 font-semibold text-sm">
            <ShieldAlert className="w-4 h-4" />
            Dispute Case ({booking.dispute.status}) — {booking.dispute.reason}
          </div>
          <p className="text-xs text-rose-800">{booking.dispute.details}</p>
          {booking.dispute.resolutionNote && (
            <p className="text-xs font-medium text-emerald-900 bg-white/80 p-2 rounded border border-emerald-200">
              Admin Resolution: {booking.dispute.resolutionNote}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* File Vault */}
          <div className="editorial-card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-editorial text-lg font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1e3a8a]" />
                Secure File Exchange Vault
              </h2>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e3a8a] text-white text-xs font-medium cursor-pointer hover:bg-[#172554]">
                <Upload className="w-3.5 h-3.5" />
                {uploading ? "Uploading..." : "Upload Brief / Reference"}
                <input
                  type="file"
                  className="hidden"
                  onChange={handleUploadFile}
                />
              </label>
            </div>

            {booking.files.length === 0 ? (
              <p className="text-xs text-stone-500 py-3">
                No files uploaded yet.
              </p>
            ) : (
              <div className="divide-y divide-[#e6e0d4]">
                {booking.files.map((f) => (
                  <div
                    key={f.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#111827]">
                        {f.fileName}
                      </p>
                      <p className="text-[11px] text-stone-500">
                        {f.fileCategory.replace(/_/g, " ")} · Uploaded by{" "}
                        {f.uploader.name} ·{" "}
                        {Math.max(1, Math.round(f.sizeBytes / 1024))} KB
                      </p>
                    </div>
                    <a
                      href={`/api/files/${f.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e6e0d4] text-xs font-medium text-[#1e3a8a] hover:bg-stone-50"
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
          <div className="editorial-card p-5 space-y-4">
            <h2 className="font-editorial text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#1e3a8a]" />
              Workspace Messaging Thread
            </h2>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {booking.messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-lg text-sm ${
                    m.isSystemMessage
                      ? "bg-stone-100 border border-stone-200 text-stone-700 text-xs"
                      : m.sender.id === user?.id
                        ? "bg-blue-50 border border-blue-200 ml-6"
                        : "bg-white border border-[#e6e0d4] mr-6"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                    <span className="font-semibold text-stone-700">
                      {m.isSystemMessage ? "System Milestone" : m.sender.name}
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
                placeholder="Write a message or clarification to your Creator..."
                className="flex-1 rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={sendingMsg || !msgText.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-xs font-semibold hover:bg-[#172554] disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </form>
          </div>
        </div>

        {/* Right Sidebar: Brief & Financials */}
        <aside className="space-y-5">
          <div className="editorial-card p-5 space-y-3">
            <h2 className="font-editorial text-base font-semibold">
              Submitted Requirements Brief
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

          <div className="editorial-card p-5 space-y-3 text-xs">
            <h2 className="font-editorial text-base font-semibold">
              Escrow & Policy Record
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
                  Cancel Booking / Open Dispute
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

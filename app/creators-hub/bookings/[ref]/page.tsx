"use client";

import { CreatorShell } from "@/components/CreatorShell";
import { EscrowStepVisualizer } from "@/components/ui/EditorialVisuals";
import { HudCard, RadarAvatar } from "@/components/ui/AuroraPrimitives";

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
  formatFileCategory,
  formatKes,
  formatShortDate,
} from "@/components/ui/Badges";
import { NextStepBanner } from "@/components/ui/FlowGuide";
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
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          j?.error?.message || `Order not found (${res.status}).`
        );
      }
      if (!j?.data?.booking) {
        throw new Error("Invalid booking response.");
      }
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
        const j = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            j?.error?.message || `Order not found (${res.status}).`
          );
        }
        if (!j?.data?.booking) {
          throw new Error("Invalid booking response.");
        }
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
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setError(j?.error?.message || `Action failed (${res.status}).`);
      return;
    }
    setNotice(
      decision === "ACCEPT"
        ? "Order accepted! You can start writing now."
        : "Order declined."
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
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error?.message || `Upload failed (${res.status}).`);
      }
      setUploadedDeliverableId(j?.data?.file?.id ?? null);
      setNotice(`Uploaded "${file.name}" safely.`);
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
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          j?.error?.message || `Could not remove file (${res.status}).`
        );
      }
      if (uploadedDeliverableId === fileId) {
        setUploadedDeliverableId(null);
      }
      setNotice("File removed from project files.");
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
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          j?.error?.message || `Could not send work (${res.status}).`
        );
      }
      setNotice("Finished work sent! Your client has been notified to check it.");
      setDeliverySummary("");
      await loadOrder();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send finished work."
      );
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
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading order details...
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <HudCard theme="rose" brackets className="p-8 text-center space-y-4">
          <h1 className="text-xl font-editorial font-semibold text-white">
            {error || "Order not found"}
          </h1>
          <Link
            href="/creators-hub"
            className="btn-creator inline-flex px-4 py-2 text-sm"
          >
            Back to Writer Hub
          </Link>
        </HudCard>
      </main>
    );
  }

  const canDeliver =
    booking.status === "IN_PROGRESS" || booking.status === "REVISION_REQUESTED";

  const writerGuide: Record<
    string,
    {
      tone: "blue" | "teal" | "amber" | "emerald" | "rose" | "stone";
      now: string;
      next: string;
      goal: string;
    }
  > = {
    PAID_AWAITING_ACCEPTANCE: {
      tone: "amber",
      now: "The client paid and is waiting for you to accept this order.",
      next: "Read the client instructions below, then click Accept Order if you can meet the deadline.",
      goal: "Start writing and deliver before the due date.",
    },
    IN_PROGRESS: {
      tone: "teal",
      now: "Order is active. Write the work to match the client's instructions.",
      next: "Upload your finished file under Send Finished Work below before the deadline.",
      goal: "Get paid to your Writer Hub balance as soon as the client approves.",
    },
    REVISION_REQUESTED: {
      tone: "amber",
      now: "The client asked for free edits on the work you sent.",
      next: "Check the Client Edit Request box below, update the file, and upload the new version.",
      goal: "Fix the points listed so the client approves and releases payment.",
    },
    DELIVERED: {
      tone: "blue",
      now: "You sent the finished files. The client is reviewing them now.",
      next: "Wait for the client to approve (or message you below if they have questions).",
      goal: "Your earnings unlock automatically upon client approval.",
    },
    COMPLETED: {
      tone: "emerald",
      now: "Client approved your work! Your earnings have been added to your balance.",
      next: "Go to Earnings to withdraw to your M-Pesa phone whenever you want.",
      goal: "Earned and ready for payout.",
    },
    DISPUTED: {
      tone: "rose",
      now: "Support is reviewing this order.",
      next: "Check messages below or share any helpful files if Support asks.",
      goal: "Fair decision from the Support team.",
    },
  };
  const guide = writerGuide[booking.status] ?? {
    tone: "stone" as const,
    now: `Order ${booking.bookingRef} is currently closed.`,
    next: "Return to Writer Hub for other orders or Open Jobs.",
    goal: "Keep delivering great writing on time.",
  };

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
          <span className="font-tech text-xs px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.12] text-slate-200">
            {booking.bookingRef}
          </span>
          <StatusPill status={booking.status} />
          <div className="inline-flex items-center gap-2 pl-1">
            <RadarAvatar
              name={booking.customer.name}
              avatarUrl={booking.customer.avatarUrl}
              size="sm"
              theme="cyan"
            />
            <span className="text-xs font-semibold text-white">
              {booking.customer.name}
            </span>
          </div>
        </div>

        <BookingDeadlineTag
          deadline={booking.agreedDeliveryDeadline}
          status={booking.status}
        />
      </div>

      {/* Progress Pipeline */}
      <div className="editorial-card p-5">
        <EscrowStepVisualizer status={booking.status} />
      </div>

      {/* Clear Next-Step Banner */}
      <NextStepBanner
        tone={guide.tone}
        eyebrow="What to do next"
        now={guide.now}
        next={guide.next}
        goal={guide.goal}
        actionLabel={
          booking.status === "COMPLETED" ? "Go to Earnings" : undefined
        }
        actionHref={
          booking.status === "COMPLETED" ? "/creators-hub/earnings" : undefined
        }
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

      {booking.status === "PAID_AWAITING_ACCEPTANCE" && (
        <HudCard
          theme="amber"
          brackets
          className="p-5 flex items-center justify-between gap-4 flex-wrap"
        >
          <div className="text-sm">
            <p className="font-semibold text-white">
              Client Paid — Accept Order to Start
            </p>
            <p className="text-xs text-amber-200/90 mt-0.5">
              Check the instructions on the right and click Accept if you can
              deliver by the due date.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleAccept("ACCEPT")}
              className="btn-creator px-4 py-2 text-xs"
            >
              Accept Order
            </button>
            <button
              onClick={() => handleAccept("DECLINE")}
              className="px-4 py-2 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-xs font-semibold hover:bg-rose-500/25 transition-colors"
            >
              Decline
            </button>
          </div>
        </HudCard>
      )}

      {booking.revisions.length > 0 && (
        <div className="editorial-card p-5 border-amber-400/35 bg-amber-500/[0.09] space-y-2">
          <h2 className="font-editorial text-base font-semibold text-amber-200">
            Client Edit Requests ({booking.revisionCount}/{booking.maxRevisions})
          </h2>
          {booking.revisions.map((r) => (
            <div key={r.id} className="text-xs space-y-1 text-slate-200">
              <p className="font-semibold text-white">
                Edit #{r.revisionNumber} ({r.resolvedAt ? "Done" : "Needs Fix"}
                ): {r.reason}
              </p>
              {Array.isArray(r.checklist) && r.checklist.length > 0 && (
                <ul className="list-disc pl-5 text-slate-300">
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
          {/* Send Finished Work Panel */}
          {canDeliver && (
            <HudCard theme="emerald" brackets className="p-6">
              <form onSubmit={handleSubmitDelivery} className="space-y-4">
                <h2 className="font-editorial text-lg font-semibold flex items-center gap-2 text-teal-300">
                  <CheckCircle2 className="w-5 h-5" />
                  Send Finished Work
                </h2>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    1. Upload your finished file (.pdf, .docx, .txt, .zip)
                  </label>
                  <label className="flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border-2 border-dashed border-teal-400/45 bg-teal-500/[0.07] text-xs font-semibold text-teal-200 cursor-pointer hover:bg-teal-500/15 transition-colors">
                    <Upload className="w-4 h-4 text-teal-300" />
                    {uploading
                      ? "Uploading File..."
                      : "Choose File to Upload"}
                    <input
                      type="file"
                      disabled={uploading}
                      className="hidden"
                      onChange={handleDeliverableUpload}
                    />
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Max {MAX_BROWSER_UPLOAD_LABEL} · PDF, Word, text,
                    spreadsheets, ZIP, or photos.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    2. Short note for the client
                  </label>
                  <textarea
                    rows={4}
                    required
                    minLength={10}
                    value={deliverySummary}
                    onChange={(e) => setDeliverySummary(e.target.value)}
                    placeholder="Briefly explain what you completed and any helpful notes for the client..."
                    className="hud-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingDelivery}
                  className="btn-creator px-5 py-2.5 text-sm gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submittingDelivery ? "Sending..." : "Send Finished Work"}
                </button>
              </form>
            </HudCard>
          )}

          {/* Project Files */}
          <div className="editorial-card p-5 space-y-3">
            <h2 className="font-editorial text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-300" />
              Project Files
            </h2>
            {booking.files.length === 0 ? (
              <p className="text-xs text-slate-400">No files uploaded yet.</p>
            ) : (
              <div className="space-y-2.5 text-xs">
                {booking.files.map((f) => {
                  const deletable = canDeleteBookingFile(
                    f,
                    booking.status,
                    user
                  );
                  return (
                    <div
                      key={f.id}
                      className="p-3 rounded-xl bg-white/[0.045] border border-white/[0.11] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-white truncate">
                          {f.fileName}
                        </p>
                        <p className="text-slate-400">
                          {formatFileCategory(f.fileCategory)} ·{" "}
                          {Math.max(1, Math.round(f.sizeBytes / 1024))} KB
                          {(f.revisionId || f.disputeId) &&
                            " · Support attachment"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`/api/files/${f.id}`}
                          className="btn-ghost px-3 py-1.5 text-xs text-teal-300 gap-1"
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
              <MessageSquare className="w-4 h-4 text-teal-300" />
              Messages
            </h2>
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {booking.messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-xl text-sm ${
                    m.isSystemMessage
                      ? "bg-white/[0.04] border border-white/[0.1] text-xs text-slate-300"
                      : m.sender.id === user?.id
                        ? "bg-teal-500/15 border border-teal-400/35 text-slate-100 ml-6"
                        : "bg-white/[0.06] border border-white/[0.12] text-slate-100 mr-6"
                  }`}
                >
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span className="font-semibold text-slate-200">
                      {m.isSystemMessage ? "Order Update" : m.sender.name}
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
                placeholder="Write a message to your client..."
                className="hud-input flex-1"
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

        {/* Right Instructions Summary */}
        <aside className="space-y-4">
          <HudCard theme="sky" className="p-5 space-y-3">
            <h2 className="font-editorial text-base font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-300" />
              Client Instructions
            </h2>
            <dl className="space-y-2 text-xs">
              {Object.entries(booking.requirementsResponses || {}).map(
                ([k, v]) => (
                  <div
                    key={k}
                    className="border-b border-white/[0.08] pb-2 last:border-0"
                  >
                    <dt className="text-slate-400 capitalize">
                      {k.replace(/([A-Z])/g, " $1")}
                    </dt>
                    <dd className="font-medium text-slate-100 mt-0.5 whitespace-pre-wrap">
                      {String(v)}
                    </dd>
                  </div>
                )
              )}
            </dl>
          </HudCard>
        </aside>
      </div>
    </CreatorShell>
  );
}

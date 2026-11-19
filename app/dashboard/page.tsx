"use client";

import { CustomerShell } from "@/components/CustomerShell";
import { EscrowStepVisualizer } from "@/components/ui/EditorialVisuals";
import { RadarAvatar } from "@/components/ui/AuroraPrimitives";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  Clock,
  Crown,
  FileText,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import {
  BookingDeadlineTag,
  ListingValidityTag,
  StatusPill,
  formatKes,
  formatShortDate,
} from "@/components/ui/Badges";
import { NextStepBanner } from "@/components/ui/FlowGuide";

interface BookingSummary {
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
  createdAt: string;
  payments: Array<{ status: string; channel: string }>;
  task: {
    id: string;
    slug: string;
    title: string;
    status: string;
    validUntil: string | null;
  };
  creator: {
    id: string;
    username: string;
    displayName: string;
    ratingAverage: number;
    user?: { avatarUrl: string | null } | null;
  };
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

const FILTER_TABS = [
  { id: "ALL", label: "All Orders" },
  { id: "PENDING_PAYMENT", label: "Needs Payment" },
  { id: "ACTIVE", label: "In Progress" },
  { id: "DELIVERED", label: "Ready to Check" },
  { id: "COMPLETED", label: "Done" },
];

export default function CustomerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [fetched, setFetched] = useState(false);
  const [filter, setFilter] = useState("ALL");

  const loadData = useCallback(async () => {
    try {
      const [bRes, nRes] = await Promise.all([
        fetch("/api/bookings?scope=customer", { cache: "no-store" }),
        fetch("/api/notifications", { cache: "no-store" }),
      ]);
      if (bRes.ok) {
        const bJson = await bRes.json();
        setBookings(bJson.data?.bookings ?? []);
      }
      if (nRes.ok) {
        const nJson = await nRes.json();
        setNotifications(nJson.data?.notifications ?? []);
      }
    } finally {
      setFetched(true);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    Promise.all([
      fetch("/api/bookings?scope=customer", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch("/api/notifications", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([bJson, nJson]) => {
        if (!active) return;
        if (bJson) setBookings(bJson.data?.bookings ?? []);
        if (nJson) setNotifications(nJson.data?.notifications ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setFetched(true);
      });
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const loading = authLoading || (Boolean(user) && !fetched);

  if (authLoading || loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="editorial-card p-8 animate-pulse text-slate-400 text-sm">
          Loading your customer workspace...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <ShieldCheck className="w-10 h-10 text-sky-400 mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Sign in to see your orders
          </h1>
          <p className="text-slate-300 text-sm">
            Check order progress, pay safely, ask for free edits, and download
            your finished files in one place.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link href="/auth?next=/dashboard" className="btn-primary px-5 py-2.5 text-sm">
              Sign In / Create Account
            </Link>
            <Link href="/explore" className="btn-ghost px-5 py-2.5 text-sm">
              Find a Writer
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isPro =
    user.membershipTier === "PRO" &&
    (!user.proExpiresAt || new Date(user.proExpiresAt) > new Date());

  const activeCount = bookings.filter((b) =>
    [
      "PAID_AWAITING_ACCEPTANCE",
      "IN_PROGRESS",
      "REVISION_REQUESTED",
    ].includes(b.status)
  ).length;
  const pendingPayCount = bookings.filter(
    (b) => b.status === "PENDING_PAYMENT"
  ).length;
  const deliveredCount = bookings.filter(
    (b) => b.status === "DELIVERED"
  ).length;
  const completedCount = bookings.filter(
    (b) => b.status === "COMPLETED"
  ).length;

  const firstPendingPay = bookings.find((b) => b.status === "PENDING_PAYMENT");
  const firstDelivered = bookings.find((b) => b.status === "DELIVERED");

  const filtered = bookings.filter((b) => {
    if (filter === "ALL") return true;
    if (filter === "ACTIVE") {
      return [
        "PAID_AWAITING_ACCEPTANCE",
        "IN_PROGRESS",
        "REVISION_REQUESTED",
        "DISPUTED",
      ].includes(b.status);
    }
    return b.status === filter;
  });

  return (
    <CustomerShell
      title={`Welcome back, ${user.name.split(" ")[0]}`}
      subtitle="See your orders, chat with writers, and download finished files."
    >
      {/* Smart Next-Step Guidance */}
      {firstPendingPay ? (
        <NextStepBanner
          tone="amber"
          eyebrow="Action needed"
          now={`You have ${pendingPayCount} order${pendingPayCount > 1 ? "s" : ""} waiting for payment (${firstPendingPay.bookingRef}).`}
          next="Open the order and complete payment via M-Pesa or Card so your writer can start."
          goal="Your payment stays safe with us until you check and approve the finished work."
          actionLabel="Pay Now"
          actionHref={`/dashboard/bookings/${firstPendingPay.bookingRef}`}
        />
      ) : firstDelivered ? (
        <NextStepBanner
          tone="teal"
          eyebrow="Work ready to check"
          now={`Your writer finished "${firstDelivered.taskTitleSnapshot}" and uploaded your files.`}
          next="Open the order to download your files. Approve it if you're happy, or ask for a free edit."
          goal="We only pay the writer after you approve your finished work."
          actionLabel="Check Finished Work"
          actionHref={`/dashboard/bookings/${firstDelivered.bookingRef}`}
        />
      ) : activeCount > 0 ? (
        <NextStepBanner
          tone="blue"
          eyebrow="In progress"
          now={`You have ${activeCount} active order${activeCount > 1 ? "s" : ""} being worked on right now.`}
          next="Open an order anytime to message your writer or share extra instructions."
          goal="Receive finished work by your deadline and approve when ready."
        />
      ) : (
        <NextStepBanner
          tone="stone"
          eyebrow="Ready when you are"
          now="You do not have any active writing orders right now."
          next="Browse tested writers for fixed-price help, or post a free job so writers send offers."
          goal="Get quality writing delivered on time with safe payment protection."
          actionLabel="Find a Writer"
          actionHref="/explore"
        />
      )}

      {/* Quick Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                filter === tab.id
                  ? "bg-cyan-400/20 text-cyan-100 border-cyan-400/55"
                  : "bg-white/[0.045] border-white/[0.11] text-slate-300 hover:bg-white/[0.09] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            className="btn-ghost px-3.5 py-2 text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link
            href="/explore"
            className="btn-primary px-4 py-2 text-xs gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            Order Writing
          </Link>
        </div>
      </div>

      {/* Action Notices */}
      {(!user.phoneVerified || !isPro) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!isPro && (
            <div className="editorial-card p-4 border-amber-400/35 bg-amber-500/[0.09] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">
                    Save 50% on Service Fees
                  </p>
                  <p className="text-xs text-amber-200/90">
                    Pro cuts your fee to 5% and gives 48h early access to new services.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/membership"
                className="btn-amber shrink-0 px-3.5 py-2 text-xs"
              >
                Try Pro
              </Link>
            </div>
          )}

          {!user.phoneVerified && (
            <div className="editorial-card p-4 border-sky-400/35 bg-sky-500/[0.09] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-300 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">
                    Confirm Your M-Pesa Phone
                  </p>
                  <p className="text-xs text-slate-300">
                    Get instant M-Pesa prompts and SMS deadline alerts.
                  </p>
                </div>
              </div>
              <Link
                href="/auth/verify"
                className="btn-ghost shrink-0 px-3.5 py-2 text-xs border-sky-400/40 text-sky-200"
              >
                Confirm Phone
              </Link>
            </div>
          )}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="editorial-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>In Progress</span>
            <BookOpen className="w-4 h-4 text-sky-300" />
          </div>
          <p className="text-3xl font-tech font-bold text-white">
            {activeCount}
          </p>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-sky-400 rounded-full w-2/3" />
          </div>
        </div>

        <div className="editorial-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Ready to Check</span>
            <FileText className="w-4 h-4 text-violet-300" />
          </div>
          <p className="text-3xl font-tech font-bold text-violet-300">
            {deliveredCount}
          </p>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-violet-400 rounded-full w-1/2" />
          </div>
        </div>

        <div className="editorial-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Needs Payment</span>
            <Clock className="w-4 h-4 text-amber-300" />
          </div>
          <p className="text-3xl font-tech font-bold text-amber-300">
            {pendingPayCount}
          </p>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full w-1/3" />
          </div>
        </div>

        <div className="editorial-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Done</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          </div>
          <p className="text-3xl font-tech font-bold text-emerald-300">
            {completedCount}
          </p>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full w-full" />
          </div>
        </div>
      </div>

      {/* Main Content + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {filtered.length === 0 ? (
            <div className="editorial-card p-10 text-center space-y-4">
              <FileText className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="font-editorial text-xl font-semibold text-white">
                  No orders here yet
                </h3>
                <p className="text-xs text-slate-400">
                  Pick a tested writer with clear pricing and a guaranteed deadline.
                </p>
              </div>
              <Link
                href="/explore"
                className="btn-primary inline-flex items-center gap-1.5 px-5 py-2.5 text-sm"
              >
                Find a Writer
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((booking) => {
                const listingExpired =
                  booking.task.status === "EXPIRED" ||
                  booking.task.status === "ARCHIVED";
                const latestPayStatus =
                  booking.payments?.[0]?.status ?? "PENDING";
                const paymentLabel =
                  latestPayStatus === "ESCROW_HELD" || latestPayStatus === "PAID"
                    ? "Paid (held safely)"
                    : latestPayStatus === "RELEASED"
                      ? "Paid to writer"
                      : latestPayStatus === "REFUNDED"
                        ? "Refunded"
                        : "Waiting for payment";

                return (
                  <div
                    key={booking.id}
                    className="editorial-card-interactive p-5 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <RadarAvatar
                          name={booking.creator.displayName}
                          avatarUrl={booking.creator.user?.avatarUrl}
                          theme="cyan"
                          size="md"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-tech text-[11px] px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-300 border border-white/[0.12]">
                              {booking.bookingRef}
                            </span>
                            <StatusPill status={booking.status} />
                            <span className="text-[11px] text-slate-400">
                              {formatShortDate(booking.createdAt)}
                            </span>
                          </div>
                          <Link
                            href={`/dashboard/bookings/${booking.bookingRef}`}
                            className="block font-editorial text-lg font-semibold text-white hover:text-cyan-300"
                          >
                            {booking.taskTitleSnapshot}
                          </Link>
                          <p className="text-xs text-slate-300">
                            <Link
                              href={`/creators/${booking.creator.username}`}
                              className="font-semibold text-teal-300 hover:underline"
                            >
                              {booking.creator.displayName}
                            </Link>
                            {" · "}
                            Free edits used: {booking.revisionCount}/{booking.maxRevisions}
                          </p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <p className="font-tech text-lg font-bold text-cyan-300">
                          {formatKes(booking.totalPayable, booking.currency)}
                        </p>
                        <p className="text-[11px] font-tech text-slate-400">
                          Service fee {formatKes(booking.serviceFee)}
                          {booking.proDiscount > 0
                            ? ` (-${formatKes(booking.proDiscount)} Pro)`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <EscrowStepVisualizer status={booking.status} compact />

                    <div className="flex flex-wrap items-center gap-2">
                      <BookingDeadlineTag
                        deadline={booking.agreedDeliveryDeadline}
                        status={booking.status}
                      />
                      <ListingValidityTag validUntil={booking.task.validUntil} />
                    </div>

                    {listingExpired && (
                      <p className="text-[11px] text-teal-200 bg-teal-500/15 border border-teal-400/35 rounded-lg px-3 py-1.5 font-medium">
                        This service closed for new orders later, but your order and deadline are still 100% protected.
                      </p>
                    )}

                    <div className="pt-3 border-t border-white/[0.1] flex items-center justify-between gap-3">
                      <span className="text-[11px] font-tech text-slate-400">
                        Payment: {paymentLabel}
                      </span>
                      <Link
                        href={`/dashboard/bookings/${booking.bookingRef}`}
                        className="btn-ghost px-3.5 py-1.5 text-xs text-cyan-200"
                      >
                        {booking.status === "PENDING_PAYMENT"
                          ? "Pay Now"
                          : booking.status === "DELIVERED"
                            ? "Check Finished Work"
                            : "Open Order"}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Updates Sidebar */}
        <aside className="space-y-4">
          <div className="editorial-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-editorial text-base font-semibold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-sky-300" />
                Recent Updates
              </h2>
              <Link
                href="/dashboard/settings"
                className="text-xs font-semibold text-sky-300 hover:underline"
              >
                Alert Settings
              </Link>
            </div>
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Payment receipts, finished work alerts, and edit updates show up here.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {notifications.slice(0, 6).map((n) => (
                  <Link
                    key={n.id}
                    href={n.linkUrl || "/dashboard"}
                    className={`block p-3 rounded-xl border text-xs transition-colors ${
                      n.readAt
                        ? "bg-white/[0.04] border-white/[0.1]"
                        : "bg-sky-500/[0.12] border-sky-400/35"
                    }`}
                  >
                    <p className="font-semibold text-white">{n.title}</p>
                    <p className="text-slate-300 mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </CustomerShell>
  );
}

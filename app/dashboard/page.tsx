"use client";

import { CustomerShell } from "@/components/CustomerShell";
import {
  CreatorAvatar,
  EscrowStepVisualizer,
} from "@/components/ui/EditorialVisuals";

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
  { id: "ALL", label: "All Bookings" },
  { id: "PENDING_PAYMENT", label: "Pending Payment" },
  { id: "ACTIVE", label: "In Progress" },
  { id: "DELIVERED", label: "Delivered" },
  { id: "COMPLETED", label: "Completed" },
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
        <div className="editorial-card p-8 animate-pulse text-stone-500 text-sm">
          Loading your customer workspace...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <ShieldCheck className="w-10 h-10 text-[#1e3a8a] mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold">
            Sign in to view your Customer Workspace
          </h1>
          <p className="text-stone-600 text-sm">
            Track bookings, escrow payments, revisions, and downloadable
            deliverables in one structured dashboard.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/auth?next=/dashboard"
              className="px-5 py-2.5 rounded-lg bg-[#1e3a8a] text-white text-sm font-medium hover:bg-[#172554]"
            >
              Sign In / Create Account
            </Link>
            <Link
              href="/explore"
              className="px-5 py-2.5 rounded-lg border border-[#e6e0d4] bg-white text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Browse Services
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
      subtitle="Escrow milestones, deliverables, and creator messages in one view."
    >
      {/* Quick Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filter === tab.id
                  ? "bg-[#111827] text-white shadow-xs"
                  : "bg-white border border-[#e6e0d4] text-stone-700 hover:bg-stone-50"
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
            Sync
          </button>
          <Link
            href="/explore"
            className="btn-primary px-4 py-2 text-xs gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            New Booking
          </Link>
        </div>
      </div>

      {/* Action Notices */}
      {(!user.phoneVerified || !isPro) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!isPro && (
            <div className="editorial-card p-4 bg-gradient-to-r from-amber-50/90 to-white border-amber-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-amber-950">
                    Cut Service Fees by 50%
                  </p>
                  <p className="text-xs text-amber-800">
                    Pro drops fees to 5% + unlocks 48h early access.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/membership"
                className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 transition-colors"
              >
                Go Pro
              </Link>
            </div>
          )}

          {!user.phoneVerified && (
            <div className="editorial-card p-4 bg-blue-50/50 border-blue-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#1e3a8a] flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#111827]">
                    Verify M-Pesa Phone
                  </p>
                  <p className="text-xs text-stone-600">
                    Enable instant STK prompts & SMS deadline alerts.
                  </p>
                </div>
              </div>
              <Link
                href="/auth/verify"
                className="shrink-0 px-3.5 py-2 rounded-xl border border-blue-300 bg-white text-[#1e3a8a] text-xs font-semibold hover:bg-blue-50 transition-colors"
              >
                Verify OTP
              </Link>
            </div>
          )}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="editorial-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-stone-500">
            <span>Active Work</span>
            <BookOpen className="w-4 h-4 text-[#1e3a8a]" />
          </div>
          <p className="text-3xl font-tech font-bold text-[#111827]">
            {activeCount}
          </p>
          <div className="h-1 rounded-full bg-stone-100 overflow-hidden">
            <div className="h-full bg-[#1e3a8a] rounded-full w-2/3" />
          </div>
        </div>

        <div className="editorial-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-stone-500">
            <span>Ready for Review</span>
            <FileText className="w-4 h-4 text-indigo-700" />
          </div>
          <p className="text-3xl font-tech font-bold text-indigo-900">
            {deliveredCount}
          </p>
          <div className="h-1 rounded-full bg-stone-100 overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full w-1/2" />
          </div>
        </div>

        <div className="editorial-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-stone-500">
            <span>Awaiting Escrow</span>
            <Clock className="w-4 h-4 text-amber-700" />
          </div>
          <p className="text-3xl font-tech font-bold text-amber-800">
            {pendingPayCount}
          </p>
          <div className="h-1 rounded-full bg-stone-100 overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full w-1/3" />
          </div>
        </div>

        <div className="editorial-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-stone-500">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="text-3xl font-tech font-bold text-emerald-800">
            {completedCount}
          </p>
          <div className="h-1 rounded-full bg-stone-100 overflow-hidden">
            <div className="h-full bg-emerald-600 rounded-full w-full" />
          </div>
        </div>
      </div>

      {/* Main Content + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {filtered.length === 0 ? (
            <div className="editorial-card p-10 text-center space-y-4">
              <FileText className="w-10 h-10 text-stone-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="font-editorial text-xl font-semibold text-[#111827]">
                  No bookings here yet
                </h3>
                <p className="text-xs text-stone-600">
                  Browse fixed-price writing services with protected delivery deadlines.
                </p>
              </div>
              <Link
                href="/explore"
                className="btn-primary inline-flex items-center gap-1.5 px-5 py-2.5 text-sm"
              >
                Explore Services
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((booking) => {
                const listingExpired =
                  booking.task.status === "EXPIRED" ||
                  booking.task.status === "ARCHIVED";

                return (
                  <div
                    key={booking.id}
                    className="editorial-card-interactive p-5 space-y-4 bg-white"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <CreatorAvatar
                          name={booking.creator.displayName}
                          username={booking.creator.username}
                          avatarUrl={booking.creator.user?.avatarUrl}
                          size="md"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-tech text-[11px] px-2 py-0.5 rounded-md bg-[#faf7f2] text-stone-700 border border-[#e6e0d4]">
                              {booking.bookingRef}
                            </span>
                            <StatusPill status={booking.status} />
                            <span className="text-[11px] text-stone-500">
                              {formatShortDate(booking.createdAt)}
                            </span>
                          </div>
                          <Link
                            href={`/dashboard/bookings/${booking.bookingRef}`}
                            className="block font-editorial text-lg font-semibold text-[#111827] hover:text-[#1e3a8a]"
                          >
                            {booking.taskTitleSnapshot}
                          </Link>
                          <p className="text-xs text-stone-600">
                            <Link
                              href={`/creators/${booking.creator.username}`}
                              className="font-semibold text-[#0f766e] hover:underline"
                            >
                              {booking.creator.displayName}
                            </Link>
                            {" · "}
                            Revisions {booking.revisionCount}/{booking.maxRevisions}
                          </p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <p className="font-tech text-lg font-bold text-[#111827]">
                          {formatKes(booking.totalPayable, booking.currency)}
                        </p>
                        <p className="text-[11px] font-tech text-stone-500">
                          Fee {formatKes(booking.serviceFee)}
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
                      <p className="text-[11px] text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 font-medium">
                        Public listing expired after confirmation — your booking &amp; deadline remain fully protected.
                      </p>
                    )}

                    <div className="pt-3 border-t border-[#e6e0d4] flex items-center justify-between gap-3">
                      <span className="text-[11px] font-tech text-stone-500 uppercase">
                        Escrow:{" "}
                        {(booking.payments?.[0]?.status ?? "PENDING").replace(
                          /_/g,
                          " "
                        )}
                      </span>
                      <Link
                        href={`/dashboard/bookings/${booking.bookingRef}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] text-xs font-semibold text-[#1e3a8a] hover:bg-blue-50 transition-colors"
                      >
                        {booking.status === "PENDING_PAYMENT"
                          ? "Fund Escrow"
                          : booking.status === "DELIVERED"
                            ? "Review Delivery"
                            : "Open Workspace"}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alerts Sidebar */}
        <aside className="space-y-4">
          <div className="editorial-card p-5 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <h2 className="font-editorial text-base font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#1e3a8a]" />
                Recent Alerts
              </h2>
              <Link
                href="/dashboard/settings"
                className="text-xs font-semibold text-[#1e3a8a] hover:underline"
              >
                Channels
              </Link>
            </div>
            {notifications.length === 0 ? (
              <p className="text-xs text-stone-500 py-4 text-center">
                Receipts, deliveries, and revision updates appear here.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {notifications.slice(0, 6).map((n) => (
                  <Link
                    key={n.id}
                    href={n.linkUrl || "/dashboard"}
                    className={`block p-3 rounded-xl border text-xs transition-colors ${
                      n.readAt
                        ? "bg-[#faf7f2] border-[#e6e0d4]"
                        : "bg-blue-50/50 border-blue-200"
                    }`}
                  >
                    <p className="font-semibold text-[#111827]">{n.title}</p>
                    <p className="text-stone-600 mt-0.5 line-clamp-2">
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

"use client";

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
  ProBadge,
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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-3xl font-editorial font-semibold text-[#111827]">
              Welcome back, {user.name}
            </h1>
            {isPro ? (
              <ProBadge label="Pro Member" />
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-200 text-stone-700">
                Free Plan
              </span>
            )}
          </div>
          <p className="text-sm text-stone-600 mt-1">
            Monitor booking milestones, escrow status, revisions, and messages
            with vetted Tovolana Creators.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e6e0d4] bg-white text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-sm font-medium hover:bg-[#172554]"
          >
            <PlusCircle className="w-4 h-4" />
            Book New Service
          </Link>
        </div>
      </div>

      {/* Membership & Verification Notices */}
      {(!user.phoneVerified || !isPro) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!isPro && (
            <div className="editorial-card p-5 bg-gradient-to-r from-amber-50/80 to-white border-amber-200 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Crown className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-sm text-amber-950">
                    Save 50% on Service Fees with Pro Membership
                  </h2>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Free plans can book any service anytime. Pro cuts the
                    platform fee in half and unlocks 48h early access.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/membership"
                className="shrink-0 px-3.5 py-2 rounded-lg bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800"
              >
                Upgrade
              </Link>
            </div>
          )}

          {!user.phoneVerified && (
            <div className="editorial-card p-5 bg-blue-50/50 border-blue-200 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#1e3a8a] shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-sm text-[#111827]">
                    Verify your Phone Number for SMS & M-Pesa Alerts
                  </h2>
                  <p className="text-xs text-stone-600 mt-0.5">
                    Confirm your Kenyan mobile number via OTP for faster M-Pesa
                    STK prompts and deadline reminders.
                  </p>
                </div>
              </div>
              <Link
                href="/auth/verify"
                className="shrink-0 px-3.5 py-2 rounded-lg border border-blue-300 bg-white text-[#1e3a8a] text-xs font-semibold hover:bg-blue-50"
              >
                Verify Phone
              </Link>
            </div>
          )}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="editorial-card p-5">
          <div className="flex items-center justify-between text-xs font-medium text-stone-500">
            <span>Active Work</span>
            <BookOpen className="w-4 h-4 text-[#1e3a8a]" />
          </div>
          <p className="text-2xl font-tech font-bold text-[#111827] mt-2">
            {activeCount}
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            In progress or awaiting acceptance
          </p>
        </div>

        <div className="editorial-card p-5">
          <div className="flex items-center justify-between text-xs font-medium text-stone-500">
            <span>Delivered for Review</span>
            <FileText className="w-4 h-4 text-indigo-700" />
          </div>
          <p className="text-2xl font-tech font-bold text-indigo-900 mt-2">
            {deliveredCount}
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            Ready to approve or request revision
          </p>
        </div>

        <div className="editorial-card p-5">
          <div className="flex items-center justify-between text-xs font-medium text-stone-500">
            <span>Pending Payment</span>
            <Clock className="w-4 h-4 text-amber-700" />
          </div>
          <p className="text-2xl font-tech font-bold text-amber-800 mt-2">
            {pendingPayCount}
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            Requires IntaSend escrow funding
          </p>
        </div>

        <div className="editorial-card p-5">
          <div className="flex items-center justify-between text-xs font-medium text-stone-500">
            <span>Completed Bookings</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="text-2xl font-tech font-bold text-emerald-800 mt-2">
            {completedCount}
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            Archived with verified deliverables
          </p>
        </div>
      </div>

      {/* Main Content + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filter === tab.id
                      ? "bg-[#1e3a8a] text-white"
                      : "bg-white border border-[#e6e0d4] text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="editorial-card p-10 text-center space-y-3">
              <FileText className="w-9 h-9 text-stone-400 mx-auto" />
              <h3 className="font-editorial text-lg font-medium text-[#111827]">
                No bookings in this view yet
              </h3>
              <p className="text-sm text-stone-600 max-w-md mx-auto">
                Explore transparent writing services with clear upfront KES
                pricing, deliverables, and protected delivery timelines.
              </p>
              <Link
                href="/explore"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-sm font-medium"
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
                    className="editorial-card p-5 space-y-3 hover:border-[#1e3a8a]/40 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-tech text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                            {booking.bookingRef}
                          </span>
                          <StatusPill status={booking.status} />
                          <span className="text-xs text-stone-500">
                            Booked {formatShortDate(booking.createdAt)}
                          </span>
                        </div>
                        <Link
                          href={`/dashboard/bookings/${booking.bookingRef}`}
                          className="block mt-1.5 font-editorial text-lg font-semibold text-[#111827] hover:text-[#1e3a8a]"
                        >
                          {booking.taskTitleSnapshot}
                        </Link>
                        <p className="text-xs text-stone-600 mt-0.5">
                          Creator:{" "}
                          <Link
                            href={`/creators/${booking.creator.username}`}
                            className="font-medium text-[#0f766e] hover:underline"
                          >
                            {booking.creator.displayName}
                          </Link>{" "}
                          · Revisions used: {booking.revisionCount}/
                          {booking.maxRevisions}
                        </p>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <p className="font-tech text-base font-bold text-[#111827]">
                          {formatKes(booking.totalPayable, booking.currency)}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          Fee {formatKes(booking.serviceFee)}
                          {booking.proDiscount > 0
                            ? ` (Saved ${formatKes(booking.proDiscount)} Pro)`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <BookingDeadlineTag
                        deadline={booking.agreedDeliveryDeadline}
                        status={booking.status}
                      />
                      <ListingValidityTag
                        validUntil={booking.task.validUntil}
                      />
                    </div>

                    {listingExpired && (
                      <p className="text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-md px-3 py-1.5">
                        Public listing expired after booking confirmation — your
                        confirmed booking and delivery deadline remain fully
                        protected.
                      </p>
                    )}

                    <div className="pt-2 border-t border-[#e6e0d4] flex items-center justify-between gap-3">
                      <span className="text-xs text-stone-500">
                        Payment:{" "}
                        {(booking.payments?.[0]?.status ?? "PENDING").replace(
                          /_/g,
                          " "
                        )}
                      </span>
                      <Link
                        href={`/dashboard/bookings/${booking.bookingRef}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1e3a8a] hover:underline"
                      >
                        {booking.status === "PENDING_PAYMENT"
                          ? "Complete Escrow Payment"
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

        {/* Right Sidebar: Account & Notifications */}
        <aside className="space-y-4">
          <div className="editorial-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-editorial text-base font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#1e3a8a]" />
                Recent Alerts
              </h2>
              <Link
                href="/dashboard/settings"
                className="text-xs text-[#1e3a8a] hover:underline"
              >
                Preferences
              </Link>
            </div>
            {notifications.length === 0 ? (
              <p className="text-xs text-stone-500 py-3">
                No notifications yet. Payment receipts, deliveries, and
                revisions will appear here.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {notifications.slice(0, 6).map((n) => (
                  <Link
                    key={n.id}
                    href={n.linkUrl || "/dashboard"}
                    className={`block p-3 rounded-lg border text-xs transition-colors ${
                      n.readAt
                        ? "bg-white border-[#e6e0d4]"
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

          <div className="editorial-card p-5 space-y-3">
            <h2 className="font-editorial text-base font-semibold">
              Quick Links
            </h2>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <Link
                href="/dashboard/membership"
                className="px-3 py-2 rounded-lg border border-[#e6e0d4] hover:bg-stone-50 flex items-center justify-between"
              >
                <span>Membership & Billing</span>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
              </Link>
              <Link
                href="/dashboard/settings"
                className="px-3 py-2 rounded-lg border border-[#e6e0d4] hover:bg-stone-50 flex items-center justify-between"
              >
                <span>Account & Security</span>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
              </Link>
              <Link
                href="/creators-hub/join"
                className="px-3 py-2 rounded-lg border border-[#e6e0d4] hover:bg-stone-50 flex items-center justify-between"
              >
                <span>Creators Hub & Assessment</span>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

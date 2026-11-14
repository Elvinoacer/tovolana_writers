"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Feather,
  FilePlus2,
  ListChecks,
  RefreshCw,
  UserCheck,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import {
  BookingDeadlineTag,
  StatusPill,
  formatKes,
} from "@/components/ui/Badges";

interface CreatorHubData {
  listings: Array<{
    id: string;
    slug: string;
    title: string;
    status: string;
    basePrice: number;
    currency: string;
    validUntil: string | null;
    _count: { bookings: number };
  }>;
  bookings: Array<{
    id: string;
    bookingRef: string;
    status: string;
    taskTitleSnapshot: string;
    listedPrice: number;
    currency: string;
    agreedDeliveryDeadline: string;
    customer: { name: string };
  }>;
  creatorProfile: {
    username: string;
    displayName: string;
    applicationStatus: string;
    isAvailable: boolean;
    ratingAverage: number;
    completedBookingsCount: number;
  };
}

interface EarningsSummary {
  pendingEscrow: number;
  availableBalance: number;
  paidOutTotal: number;
  currency: string;
}

export default function CreatorsHubHomePage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<CreatorHubData | null>(null);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [fetched, setFetched] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadHub = useCallback(async () => {
    try {
      const [lRes, eRes] = await Promise.all([
        fetch("/api/creators-hub/listings", { cache: "no-store" }),
        fetch("/api/creators-hub/earnings", { cache: "no-store" }),
      ]);
      if (lRes.ok) {
        const lJson = await lRes.json();
        setData(lJson.data);
      }
      if (eRes.ok) {
        const eJson = await eRes.json();
        setEarnings(eJson.data?.summary ?? null);
      }
    } finally {
      setFetched(true);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    Promise.all([
      fetch("/api/creators-hub/listings", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch("/api/creators-hub/earnings", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([lJson, eJson]) => {
        if (!active) return;
        if (lJson?.data) setData(lJson.data);
        if (eJson?.data?.summary) setEarnings(eJson.data.summary);
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

  async function toggleAvailability() {
    if (!data) return;
    await fetch("/api/creators-hub/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !data.creatorProfile.isAvailable }),
    });
    await loadHub();
  }

  async function handleAcceptDecision(
    bookingRef: string,
    decision: "ACCEPT" | "DECLINE"
  ) {
    setBusyId(bookingRef);
    try {
      await fetch(`/api/bookings/${bookingRef}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      await loadHub();
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading Creators Hub workspace...
        </div>
      </main>
    );
  }

  if (!user || !user.roles.includes("CREATOR")) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <Feather className="w-10 h-10 text-[#0f766e] mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold">
            {user?.creatorProfile
              ? "Complete Vetting to Unlock the Creators Hub"
              : "Join the Creators Hub"}
          </h1>
          <p className="text-sm text-stone-600">
            Publish vetted writing tasks, manage bookings, and build verified
            reputation right inside your existing Tovolana account.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href={
                user?.creatorProfile
                  ? "/creators-hub/status"
                  : "/creators-hub/onboarding"
              }
              className="px-5 py-2.5 rounded-lg bg-[#0f766e] text-white text-sm font-semibold"
            >
              {user?.creatorProfile ? "View Assessment Status" : "Apply Now"}
            </Link>
            <Link
              href="/creators-hub/join"
              className="px-5 py-2.5 rounded-lg border border-[#e6e0d4] bg-white text-sm"
            >
              Learn How It Works
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const awaitingAccept =
    data?.bookings.filter((b) => b.status === "PAID_AWAITING_ACCEPTANCE") ?? [];
  const activeOrders =
    data?.bookings.filter((b) =>
      ["IN_PROGRESS", "REVISION_REQUESTED", "DELIVERED"].includes(b.status)
    ) ?? [];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-[#0f766e]">
            Creators Hub · @{data?.creatorProfile.username}
          </span>
          <h1 className="text-3xl font-editorial font-semibold mt-0.5">
            {data?.creatorProfile.displayName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={toggleAvailability}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold border ${
              data?.creatorProfile.isAvailable
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-stone-100 text-stone-700 border-stone-300"
            }`}
          >
            {data?.creatorProfile.isAvailable
              ? "● Accepting Bookings"
              : "○ Availability Paused"}
          </button>
          <button
            onClick={loadHub}
            className="p-2 rounded-lg border border-[#e6e0d4] bg-white text-stone-600 hover:bg-stone-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/creators-hub/listings/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f766e] text-white text-sm font-semibold hover:bg-teal-900"
          >
            <FilePlus2 className="w-4 h-4" />
            New Task Listing
          </Link>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2 border-b border-[#e6e0d4] pb-3 text-xs font-medium">
        <Link
          href="/creators-hub"
          className="px-3 py-1.5 rounded-md bg-[#0f766e] text-white"
        >
          Overview & Orders
        </Link>
        <Link
          href="/creators-hub/listings"
          className="px-3 py-1.5 rounded-md bg-white border border-[#e6e0d4] text-stone-700 hover:bg-stone-50"
        >
          Manage Listings ({data?.listings.length ?? 0})
        </Link>
        <Link
          href="/creators-hub/earnings"
          className="px-3 py-1.5 rounded-md bg-white border border-[#e6e0d4] text-stone-700 hover:bg-stone-50"
        >
          Earnings & Payouts
        </Link>
        <Link
          href="/creators-hub/profile"
          className="px-3 py-1.5 rounded-md bg-white border border-[#e6e0d4] text-stone-700 hover:bg-stone-50"
        >
          Public Portfolio & Settings
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="editorial-card p-5">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>Available to Withdraw</span>
            <Wallet className="w-4 h-4 text-[#0f766e]" />
          </div>
          <p className="font-tech text-2xl font-bold text-[#0f766e] mt-2">
            {formatKes(earnings?.availableBalance ?? 0)}
          </p>
        </div>
        <div className="editorial-card p-5">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>In Active Escrow</span>
            <Briefcase className="w-4 h-4 text-amber-700" />
          </div>
          <p className="font-tech text-2xl font-bold text-[#111827] mt-2">
            {formatKes(earnings?.pendingEscrow ?? 0)}
          </p>
        </div>
        <div className="editorial-card p-5">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>Active Orders</span>
            <ListChecks className="w-4 h-4 text-[#1e3a8a]" />
          </div>
          <p className="font-tech text-2xl font-bold text-[#111827] mt-2">
            {activeOrders.length}
          </p>
        </div>
        <div className="editorial-card p-5">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>Avg Rating / Completed</span>
            <UserCheck className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-tech text-2xl font-bold text-[#111827] mt-2">
            {(data?.creatorProfile.ratingAverage ?? 5).toFixed(1)} ·{" "}
            {data?.creatorProfile.completedBookingsCount ?? 0}
          </p>
        </div>
      </div>

      {/* Manual Acceptance Requests */}
      {awaitingAccept.length > 0 && (
        <div className="editorial-card p-6 border-amber-200 bg-amber-50/50 space-y-4">
          <h2 className="font-editorial text-lg font-semibold text-amber-950">
            New Escrow-Funded Requests Awaiting Acceptance (
            {awaitingAccept.length})
          </h2>
          <div className="space-y-3">
            {awaitingAccept.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-lg bg-white border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <span className="font-tech text-xs text-stone-500">
                    {b.bookingRef} · Client: {b.customer.name}
                  </span>
                  <p className="font-semibold text-sm">{b.taskTitleSnapshot}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={busyId === b.bookingRef}
                    onClick={() => handleAcceptDecision(b.bookingRef, "ACCEPT")}
                    className="px-3.5 py-1.5 rounded-lg bg-[#0f766e] text-white text-xs font-semibold hover:bg-teal-900"
                  >
                    Accept Work
                  </button>
                  <button
                    disabled={busyId === b.bookingRef}
                    onClick={() =>
                      handleAcceptDecision(b.bookingRef, "DECLINE")
                    }
                    className="px-3.5 py-1.5 rounded-lg border border-rose-300 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders List */}
      <div className="editorial-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-editorial text-xl font-semibold">
            Creator Fulfilment Queue
          </h2>
          <span className="text-xs text-stone-500">
            {data?.bookings.length ?? 0} total bookings
          </span>
        </div>

        {(data?.bookings.length ?? 0) === 0 ? (
          <p className="text-sm text-stone-500 py-4">
            No bookings assigned yet. Submit your first task listing for admin
            approval to appear in the marketplace!
          </p>
        ) : (
          <div className="divide-y divide-[#e6e0d4]">
            {data?.bookings.map((b) => (
              <div
                key={b.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-tech text-xs px-2 py-0.5 rounded bg-stone-100 border border-stone-200">
                      {b.bookingRef}
                    </span>
                    <StatusPill status={b.status} />
                  </div>
                  <p className="font-medium text-[#111827]">
                    {b.taskTitleSnapshot}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap text-xs text-stone-500">
                    <span>Customer: {b.customer.name}</span>
                    <BookingDeadlineTag
                      deadline={b.agreedDeliveryDeadline}
                      status={b.status}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-tech font-bold text-sm">
                    {formatKes(b.listedPrice, b.currency)}
                  </span>
                  <Link
                    href={`/creators-hub/bookings/${b.bookingRef}`}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-[#1e3a8a] text-white text-xs font-semibold hover:bg-[#172554]"
                  >
                    Open Fulfilment
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-stone-500 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-[#0f766e]" />
        <span>
          Creators cannot alter confirmed booking prices or mark bookings paid —
          all escrow settlements run automatically via IntaSend webhooks and
          customer delivery acceptance.
        </span>
      </div>
    </main>
  );
}

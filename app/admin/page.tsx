"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckSquare,
  Clock,
  Crown,
  Scale,
  Users,
  Wallet,
} from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { StatusPill, formatKes, formatShortDate } from "@/components/ui/Badges";

interface OverviewData {
  metrics: {
    totalUsers: number;
    proUsers: number;
    approvedCreators: number;
    pendingAssessmentsCount: number;
    moderationQueueCount: number;
    openDisputesCount: number;
    totalCompletedGmv: number;
    completedTransactionsCount: number;
  };
  moderationQueue: Array<{
    id: string;
    slug: string;
    title: string;
    status: string;
    creator: { displayName: string };
  }>;
  openDisputes: Array<{
    id: string;
    reason: string;
    booking: { bookingRef: string; totalPayable: number; currency: string };
  }>;
  expiringSoonListings: Array<{
    id: string;
    title: string;
    validUntil: string | null;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    targetType: string;
    reason: string | null;
    createdAt: string;
    actorAdmin: { name: string };
  }>;
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/overview", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (active && j?.data) setData(j.data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminShell
      title="Operational Overview"
      subtitle="Platform health, pending approvals, expiring listings, disputes, and immutable audit stream."
    >
      {loading || !data ? (
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading platform metrics...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="editorial-card p-5">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span>Completed GMV</span>
                <Wallet className="w-4 h-4 text-[#1e3a8a]" />
              </div>
              <p className="font-tech text-2xl font-bold text-[#111827] mt-2">
                {formatKes(data.metrics.totalCompletedGmv)}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                {data.metrics.completedTransactionsCount} settled payments
              </p>
            </div>

            <div className="editorial-card p-5">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span>Moderation Queue</span>
                <CheckSquare className="w-4 h-4 text-amber-700" />
              </div>
              <p className="font-tech text-2xl font-bold text-amber-800 mt-2">
                {data.metrics.moderationQueueCount}
              </p>
              <Link
                href="/admin/listings/moderation"
                className="text-xs text-[#1e3a8a] hover:underline mt-0.5 inline-block"
              >
                Review pending listings →
              </Link>
            </div>

            <div className="editorial-card p-5">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span>Open Disputes / Assessments</span>
                <Scale className="w-4 h-4 text-rose-700" />
              </div>
              <p className="font-tech text-2xl font-bold text-rose-800 mt-2">
                {data.metrics.openDisputesCount} /{" "}
                {data.metrics.pendingAssessmentsCount}
              </p>
              <Link
                href="/admin/bookings"
                className="text-xs text-[#1e3a8a] hover:underline mt-0.5 inline-block"
              >
                Open tribunal & vetting →
              </Link>
            </div>

            <div className="editorial-card p-5">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span>Users · Pro · Creators</span>
                <Users className="w-4 h-4 text-[#0f766e]" />
              </div>
              <p className="font-tech text-2xl font-bold text-[#111827] mt-2">
                {data.metrics.totalUsers} ·{" "}
                <span className="text-amber-700">{data.metrics.proUsers}</span>{" "}
                ·{" "}
                <span className="text-[#0f766e]">
                  {data.metrics.approvedCreators}
                </span>
              </p>
              <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-600" /> Active Pro & Vetted
                network
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="editorial-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-editorial text-lg font-semibold">
                  Pending Listing Approvals
                </h2>
                <Link
                  href="/admin/listings/moderation"
                  className="text-xs font-semibold text-[#1e3a8a] hover:underline flex items-center gap-1"
                >
                  Open Queue <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {data.moderationQueue.length === 0 ? (
                <p className="text-xs text-stone-500">
                  All Creator listing submissions reviewed.
                </p>
              ) : (
                <div className="space-y-2 text-xs">
                  {data.moderationQueue.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-[#e6e0d4] flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-stone-500">
                          by {item.creator.displayName}
                        </p>
                      </div>
                      <StatusPill status={item.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="editorial-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-editorial text-lg font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-700" />
                  Dispute Tribunal & Expiring Listings
                </h2>
                <Link
                  href="/admin/listings/vault"
                  className="text-xs font-semibold text-[#1e3a8a] hover:underline"
                >
                  Expiry Vault →
                </Link>
              </div>
              {data.openDisputes.map((d) => (
                <div
                  key={d.id}
                  className="p-3 rounded-lg border border-rose-200 bg-rose-50/50 text-xs flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-rose-950">
                      {d.booking.bookingRef} — {d.reason}
                    </p>
                    <p className="text-rose-800">
                      Escrow:{" "}
                      {formatKes(d.booking.totalPayable, d.booking.currency)}
                    </p>
                  </div>
                  <Link
                    href="/admin/bookings"
                    className="px-3 py-1 rounded bg-rose-700 text-white font-semibold"
                  >
                    Resolve
                  </Link>
                </div>
              ))}
              {data.expiringSoonListings.map((l) => (
                <div
                  key={l.id}
                  className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 text-xs flex items-center justify-between"
                >
                  <span className="font-medium">{l.title}</span>
                  <span className="font-tech text-amber-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatShortDate(l.validUntil)}
                  </span>
                </div>
              ))}
              {data.openDisputes.length === 0 &&
                data.expiringSoonListings.length === 0 && (
                  <p className="text-xs text-stone-500">
                    Zero open disputes or imminent expirations.
                  </p>
                )}
            </div>
          </div>

          <div className="editorial-card p-5 space-y-3">
            <h2 className="font-editorial text-lg font-semibold">
              Immutable Administrative Audit Log
            </h2>
            <div className="divide-y divide-[#e6e0d4] text-xs">
              {data.auditLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                >
                  <div>
                    <span className="font-tech font-semibold text-[#1e3a8a]">
                      {log.action}
                    </span>{" "}
                    <span className="text-stone-600">
                      by {log.actorAdmin.name} ({log.targetType})
                    </span>
                    {log.reason && (
                      <span className="text-stone-500"> — {log.reason}</span>
                    )}
                  </div>
                  <span className="font-tech text-stone-400">
                    {formatShortDate(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

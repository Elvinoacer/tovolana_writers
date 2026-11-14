"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckSquare,
  Clock,
  Crown,
  Scale,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { StatusPill, formatKes, formatShortDate } from "@/components/ui/Badges";
import { CreatorAvatar } from "@/components/ui/EditorialVisuals";

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
            <div className="editorial-card editorial-card-interactive p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-medium text-stone-500">
                <span>Completed GMV</span>
                <span className="w-8 h-8 rounded-xl bg-[#1e3a8a]/10 text-[#1e3a8a] flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <p className="font-tech text-2xl font-bold text-[#111827] tracking-tight">
                  {formatKes(data.metrics.totalCompletedGmv)}
                </p>
                <div className="mt-2.5 h-1.5 w-full rounded-full bg-[#e6e0d4]/70 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1e3a8a] transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        data.metrics.completedTransactionsCount > 0 ? 100 : 12
                      )}%`,
                    }}
                  />
                </div>
                <p className="font-tech text-[11px] text-stone-500 mt-1.5">
                  {data.metrics.completedTransactionsCount} settled transactions
                </p>
              </div>
            </div>

            <div className="editorial-card editorial-card-interactive p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-medium text-stone-500">
                <span>Moderation Queue</span>
                <span className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
                  <CheckSquare className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <p className="font-tech text-2xl font-bold text-amber-800 tracking-tight">
                  {data.metrics.moderationQueueCount}
                </p>
                <div className="mt-2.5 h-1.5 w-full rounded-full bg-[#e6e0d4]/70 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-600 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(8, data.metrics.moderationQueueCount * 16)
                      )}%`,
                    }}
                  />
                </div>
                <Link
                  href="/admin/listings/moderation"
                  className="text-xs font-semibold text-[#1e3a8a] hover:underline mt-1.5 inline-flex items-center gap-1"
                >
                  Review pending <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="editorial-card editorial-card-interactive p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-medium text-stone-500">
                <span>Disputes · Vetting</span>
                <span className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-700 flex items-center justify-center">
                  <Scale className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <p className="font-tech text-2xl font-bold text-rose-800 tracking-tight">
                  {data.metrics.openDisputesCount}{" "}
                  <span className="text-stone-400 font-normal">/</span>{" "}
                  {data.metrics.pendingAssessmentsCount}
                </p>
                <div className="mt-2.5 h-1.5 w-full rounded-full bg-[#e6e0d4]/70 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-rose-600 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          6,
                          (data.metrics.openDisputesCount +
                            data.metrics.pendingAssessmentsCount) *
                            15
                        )
                      )}%`,
                    }}
                  />
                </div>
                <Link
                  href="/admin/bookings"
                  className="text-xs font-semibold text-[#1e3a8a] hover:underline mt-1.5 inline-flex items-center gap-1"
                >
                  Open tribunal <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="editorial-card editorial-card-interactive p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-medium text-stone-500">
                <span>Accounts · Pro · Creators</span>
                <span className="w-8 h-8 rounded-xl bg-[#0f766e]/10 text-[#0f766e] flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <p className="font-tech text-2xl font-bold text-[#111827] tracking-tight">
                  {data.metrics.totalUsers}
                  <span className="text-stone-300 mx-1">·</span>
                  <span className="text-amber-700">{data.metrics.proUsers}</span>
                  <span className="text-stone-300 mx-1">·</span>
                  <span className="text-[#0f766e]">
                    {data.metrics.approvedCreators}
                  </span>
                </p>
                <div className="mt-2.5 h-1.5 w-full rounded-full bg-[#e6e0d4]/70 overflow-hidden flex">
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{
                      width: `${
                        data.metrics.totalUsers > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (data.metrics.proUsers /
                                  data.metrics.totalUsers) *
                                  100
                              )
                            )
                          : 0
                      }%`,
                    }}
                  />
                  <div
                    className="h-full bg-[#0f766e] transition-all duration-500"
                    style={{
                      width: `${
                        data.metrics.totalUsers > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (data.metrics.approvedCreators /
                                  data.metrics.totalUsers) *
                                  100
                              )
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1.5 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-600" /> Pro & Vetted
                  network
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="editorial-card p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-editorial text-lg font-semibold text-[#111827]">
                    Pending Approvals
                  </h2>
                  <span className="font-tech text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#faf7f0] border border-[#e6e0d4] text-stone-600">
                    {data.moderationQueue.length}
                  </span>
                </div>
                <Link
                  href="/admin/listings/moderation"
                  className="text-xs font-semibold text-[#1e3a8a] px-3 py-1.5 rounded-full bg-[#1e3a8a]/5 hover:bg-[#1e3a8a]/10 transition-colors flex items-center gap-1"
                >
                  Open Queue <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {data.moderationQueue.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#e6e0d4] bg-[#faf7f0]/60 p-6 text-center">
                  <ShieldCheck className="w-5 h-5 text-[#0f766e] mx-auto mb-1.5" />
                  <p className="text-xs font-medium text-stone-600">
                    All Creator submissions reviewed
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {data.moderationQueue.slice(0, 5).map((item) => (
                    <Link
                      key={item.id}
                      href="/admin/listings/moderation"
                      className="p-3 rounded-xl border border-[#e6e0d4] bg-white hover:border-[#1e3a8a]/40 hover:shadow-sm transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CreatorAvatar
                          name={item.creator.displayName}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-[#111827] truncate">
                            {item.title}
                          </p>
                          <p className="text-stone-500 truncate">
                            by {item.creator.displayName}
                          </p>
                        </div>
                      </div>
                      <StatusPill status={item.status} />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="editorial-card p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-editorial text-lg font-semibold text-[#111827] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-700" />
                  Tribunal & Expirations
                </h2>
                <Link
                  href="/admin/listings/vault"
                  className="text-xs font-semibold text-[#1e3a8a] px-3 py-1.5 rounded-full bg-[#1e3a8a]/5 hover:bg-[#1e3a8a]/10 transition-colors"
                >
                  Expiry Vault →
                </Link>
              </div>
              <div className="space-y-2.5">
                {data.openDisputes.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 text-xs flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-rose-950 truncate">
                        <span className="font-tech">{d.booking.bookingRef}</span>{" "}
                        — {d.reason}
                      </p>
                      <p className="text-rose-800 font-tech mt-0.5">
                        Escrow:{" "}
                        {formatKes(d.booking.totalPayable, d.booking.currency)}
                      </p>
                    </div>
                    <Link
                      href="/admin/bookings"
                      className="shrink-0 px-3.5 py-1.5 rounded-full bg-rose-700 text-white font-semibold hover:bg-rose-800 transition-colors"
                    >
                      Resolve
                    </Link>
                  </div>
                ))}
                {data.expiringSoonListings.map((l) => (
                  <div
                    key={l.id}
                    className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 text-xs flex items-center justify-between gap-3"
                  >
                    <span className="font-medium text-[#111827] truncate">
                      {l.title}
                    </span>
                    <span className="shrink-0 font-tech text-[11px] font-semibold text-amber-900 bg-amber-100/80 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatShortDate(l.validUntil)}
                    </span>
                  </div>
                ))}
                {data.openDisputes.length === 0 &&
                  data.expiringSoonListings.length === 0 && (
                    <div className="rounded-xl border border-dashed border-[#e6e0d4] bg-[#faf7f0]/60 p-6 text-center">
                      <ShieldCheck className="w-5 h-5 text-[#0f766e] mx-auto mb-1.5" />
                      <p className="text-xs font-medium text-stone-600">
                        Zero open disputes or imminent expirations
                      </p>
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div className="editorial-card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-editorial text-lg font-semibold text-[#111827] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#1e3a8a]" />
                Immutable Audit Log
              </h2>
              <span className="font-tech text-[11px] px-2.5 py-0.5 rounded-full bg-[#faf7f0] border border-[#e6e0d4] text-stone-500">
                Latest {Math.min(10, data.auditLogs.length)} events
              </span>
            </div>
            <div className="divide-y divide-[#e6e0d4]/80 text-xs">
              {data.auditLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#faf7f0]/50 px-2 -mx-2 rounded-lg transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-tech text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#1e3a8a]/8 text-[#1e3a8a] border border-[#1e3a8a]/15">
                      {log.action}
                    </span>
                    <span className="text-stone-700 font-medium">
                      {log.actorAdmin.name}
                    </span>
                    <span className="text-stone-400">·</span>
                    <span className="font-tech text-stone-500">
                      {log.targetType}
                    </span>
                    {log.reason && (
                      <span className="text-stone-500 truncate">
                        — {log.reason}
                      </span>
                    )}
                  </div>
                  <span className="font-tech text-[11px] text-stone-400 shrink-0">
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

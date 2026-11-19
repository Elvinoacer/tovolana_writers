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
import { NextStepBanner } from "@/components/ui/FlowGuide";
import { HudCard, RadarAvatar } from "@/components/ui/AuroraPrimitives";

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
      title="Admin Overview"
      subtitle="Quick summary of sales, services to approve, support cases, and writer tests."
    >
      {loading || !data ? (
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading platform summary...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Smart Priority Banner */}
          {data.metrics.openDisputesCount > 0 ? (
            <NextStepBanner
              tone="rose"
              eyebrow="Needs attention"
              now={`${data.metrics.openDisputesCount} open support case${data.metrics.openDisputesCount > 1 ? "s need" : " needs"} a decision right now.`}
              next="Open Support Help to check client and writer files and decide on a refund or payout."
              goal="Resolve client and writer issues quickly and fairly."
              actionLabel="Open Support Help"
              actionHref="/admin/bookings"
            />
          ) : data.metrics.moderationQueueCount > 0 ? (
            <NextStepBanner
              tone="amber"
              eyebrow="Pending approvals"
              now={`${data.metrics.moderationQueueCount} new writer service${data.metrics.moderationQueueCount > 1 ? "s are" : " is"} waiting to go live.`}
              next="Review pricing and service descriptions, then approve or ask for changes."
              goal="Keep Find Writers full of clear, reliable services."
              actionLabel="Approve Services"
              actionHref="/admin/listings/moderation"
            />
          ) : data.metrics.pendingAssessmentsCount > 0 ? (
            <NextStepBanner
              tone="blue"
              eyebrow="Writer tests"
              now={`${data.metrics.pendingAssessmentsCount} writer test sample${data.metrics.pendingAssessmentsCount > 1 ? "s need" : " needs"} a quick team check.`}
              next="Read the sample and score on Writer Tests, then approve or decline."
              goal="Bring qualified writers into Writer Hub."
              actionLabel="Review Writer Tests"
              actionHref="/admin/creators/vetting"
            />
          ) : (
            <NextStepBanner
              tone="emerald"
              eyebrow="All caught up"
              now="Zero open support cases, pending approvals, or writer tests waiting right now."
              next="Check Payments, Users, or Reports from the tabs above anytime."
              goal="Keep everything running smoothly for clients and writers."
            />
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="editorial-card editorial-card-interactive p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                <span>Total Sales</span>
                <span className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-400/30 text-sky-300 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <p className="font-tech text-2xl font-bold text-white tracking-tight">
                  {formatKes(data.metrics.totalCompletedGmv)}
                </p>
                <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-400 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        data.metrics.completedTransactionsCount > 0 ? 100 : 12
                      )}%`,
                    }}
                  />
                </div>
                <p className="font-tech text-[11px] text-slate-400 mt-1.5">
                  {data.metrics.completedTransactionsCount} completed payments
                </p>
              </div>
            </div>

            <div className="editorial-card editorial-card-interactive p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                <span>Services to Approve</span>
                <span className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-300 flex items-center justify-center">
                  <CheckSquare className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <p className="font-tech text-2xl font-bold text-amber-300 tracking-tight">
                  {data.metrics.moderationQueueCount}
                </p>
                <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all duration-500"
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
                  className="text-xs font-semibold text-cyan-300 hover:underline mt-1.5 inline-flex items-center gap-1"
                >
                  Check services <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="editorial-card editorial-card-interactive p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                <span>Cases · Writer Tests</span>
                <span className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-300 flex items-center justify-center">
                  <Scale className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <p className="font-tech text-2xl font-bold text-rose-300 tracking-tight">
                  {data.metrics.openDisputesCount}{" "}
                  <span className="text-slate-500 font-normal">/</span>{" "}
                  {data.metrics.pendingAssessmentsCount}
                </p>
                <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-rose-400 transition-all duration-500"
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
                  className="text-xs font-semibold text-cyan-300 hover:underline mt-1.5 inline-flex items-center gap-1"
                >
                  Open support cases <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="editorial-card editorial-card-interactive p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                <span>Users · Pro · Writers</span>
                <span className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-400/30 text-teal-300 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <p className="font-tech text-2xl font-bold text-white tracking-tight">
                  {data.metrics.totalUsers}
                  <span className="text-slate-500 mx-1">·</span>
                  <span className="text-amber-300">
                    {data.metrics.proUsers}
                  </span>
                  <span className="text-slate-500 mx-1">·</span>
                  <span className="text-teal-300">
                    {data.metrics.approvedCreators}
                  </span>
                </p>
                <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden flex">
                  <div
                    className="h-full bg-amber-400 transition-all duration-500"
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
                    className="h-full bg-teal-400 transition-all duration-500"
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
                <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-300" /> Pro members &amp;
                  tested writers
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HudCard theme="cyan" className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-editorial text-lg font-semibold text-white">
                    Services to Approve
                  </h2>
                  <span className="font-tech text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.12] text-slate-300">
                    {data.moderationQueue.length}
                  </span>
                </div>
                <Link
                  href="/admin/listings/moderation"
                  className="text-xs font-semibold text-cyan-200 px-3 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 hover:bg-cyan-500/25 transition-colors flex items-center gap-1"
                >
                  Open Approvals <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {data.moderationQueue.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.14] bg-white/[0.03] p-6 text-center">
                  <ShieldCheck className="w-5 h-5 text-teal-300 mx-auto mb-1.5" />
                  <p className="text-xs font-medium text-slate-300">
                    All writer services have been checked
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {data.moderationQueue.slice(0, 5).map((item) => (
                    <Link
                      key={item.id}
                      href="/admin/listings/moderation"
                      className="p-3 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:border-cyan-400/40 hover:bg-white/[0.07] transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <RadarAvatar
                          name={item.creator.displayName}
                          size="sm"
                          theme="cyan"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">
                            {item.title}
                          </p>
                          <p className="text-slate-400 truncate">
                            by {item.creator.displayName}
                          </p>
                        </div>
                      </div>
                      <StatusPill status={item.status} />
                    </Link>
                  ))}
                </div>
              )}
            </HudCard>

            <HudCard theme="rose" className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-editorial text-lg font-semibold text-white flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-300" />
                  Support Cases &amp; Closing Services
                </h2>
                <Link
                  href="/admin/listings/vault"
                  className="text-xs font-semibold text-sky-200 px-3 py-1.5 rounded-full bg-sky-500/15 border border-sky-400/30 hover:bg-sky-500/25 transition-colors"
                >
                  Closed Services →
                </Link>
              </div>
              <div className="space-y-2.5">
                {data.openDisputes.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-xl border border-rose-400/35 bg-rose-500/15 text-xs flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">
                        <span className="font-tech text-rose-200">
                          {d.booking.bookingRef}
                        </span>{" "}
                        — {d.reason}
                      </p>
                      <p className="text-rose-200 font-tech mt-0.5">
                        Order Total:{" "}
                        {formatKes(d.booking.totalPayable, d.booking.currency)}
                      </p>
                    </div>
                    <Link
                      href="/admin/bookings"
                      className="shrink-0 px-3.5 py-1.5 rounded-full bg-rose-500 text-white font-semibold hover:bg-rose-400 transition-colors"
                    >
                      Decide
                    </Link>
                  </div>
                ))}
                {data.expiringSoonListings.map((l) => (
                  <div
                    key={l.id}
                    className="p-3 rounded-xl border border-amber-400/35 bg-amber-500/15 text-xs flex items-center justify-between gap-3"
                  >
                    <span className="font-medium text-white truncate">
                      {l.title}
                    </span>
                    <span className="shrink-0 font-tech text-[11px] font-semibold text-amber-200 bg-amber-500/20 border border-amber-400/35 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatShortDate(l.validUntil)}
                    </span>
                  </div>
                ))}
                {data.openDisputes.length === 0 &&
                  data.expiringSoonListings.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/[0.14] bg-white/[0.03] p-6 text-center">
                      <ShieldCheck className="w-5 h-5 text-teal-300 mx-auto mb-1.5" />
                      <p className="text-xs font-medium text-slate-300">
                        No open support cases or closing services right now
                      </p>
                    </div>
                  )}
              </div>
            </HudCard>
          </div>

          <div className="editorial-card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-editorial text-lg font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-300" />
                Recent Activity
              </h2>
              <span className="font-tech text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.12] text-slate-400">
                Latest {Math.min(10, data.auditLogs.length)} updates
              </span>
            </div>
            <div className="divide-y divide-white/[0.08] text-xs">
              {data.auditLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/[0.03] px-2 -mx-2 rounded-lg transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-tech text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-200 border border-sky-400/30">
                      {log.action}
                    </span>
                    <span className="text-white font-medium">
                      {log.actorAdmin.name}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="font-tech text-slate-300">
                      {log.targetType}
                    </span>
                    {log.reason && (
                      <span className="text-slate-400 truncate">
                        — {log.reason}
                      </span>
                    )}
                  </div>
                  <span className="font-tech text-[11px] text-slate-400 shrink-0">
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

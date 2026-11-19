"use client";

import { ScoreRing } from "@/components/ui/EditorialVisuals";
import { HudCard, RadarAvatar } from "@/components/ui/AuroraPrimitives";

import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { StatusPill, formatKes } from "@/components/ui/Badges";

interface ExportData {
  summary: {
    totalBookings: number;
    totalCompletedRevenue: number;
    bookingFeesCollected: number;
    proDiscountsGranted: number;
  };
  bookingsByStatus: Array<{
    status: string;
    _count: { _all: number };
    _sum: { totalPayable: number | null; serviceFee: number | null };
  }>;
  categories: Array<{
    id: string;
    name: string;
    isActive: boolean;
    _count: { listings: number };
  }>;
  creatorStats: Array<{
    displayName: string;
    username: string;
    ratingAverage: number;
    completedBookingsCount: number;
    assessmentScore: number | null;
  }>;
}

export default function AdminReportsPage() {
  const [report, setReport] = useState<ExportData | null>(null);

  useEffect(() => {
    fetch("/api/admin/reports/export?format=json", {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) setReport(j.data);
      })
      .catch(() => {});
  }, []);

  return (
    <AdminShell
      title="Reports & Totals"
      subtitle="See total sales, order statuses, and download a spreadsheet anytime."
    >
      <HudCard
        theme="sky"
        brackets
        className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h2 className="font-editorial text-xl font-semibold text-white">
            Download Orders Spreadsheet (CSV)
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Includes order ref, category, client, writer, price, service fee,
            total paid, and completion date.
          </p>
        </div>
        <a
          href="/api/admin/reports/export?format=csv"
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold shrink-0"
        >
          <Download className="w-4 h-4" />
          Download CSV
        </a>
      </HudCard>

      {report?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="editorial-card p-4">
            <p className="text-xs text-slate-400">Total Orders</p>
            <p className="font-tech text-xl font-bold text-white mt-1">
              {report.summary.totalBookings}
            </p>
          </div>
          <div className="editorial-card p-4">
            <p className="text-xs text-slate-400">Total Sales</p>
            <p className="font-tech text-xl font-bold text-cyan-300 mt-1">
              {formatKes(report.summary.totalCompletedRevenue)}
            </p>
          </div>
          <div className="editorial-card p-4">
            <p className="text-xs text-slate-400">Fees Collected</p>
            <p className="font-tech text-xl font-bold text-teal-300 mt-1">
              {formatKes(report.summary.bookingFeesCollected)}
            </p>
          </div>
          <div className="editorial-card p-4">
            <p className="text-xs text-slate-400">Pro Member Discounts</p>
            <p className="font-tech text-xl font-bold text-amber-300 mt-1">
              {formatKes(report.summary.proDiscountsGranted)}
            </p>
          </div>
        </div>
      )}

      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <HudCard theme="sky" className="p-6 space-y-4">
            <h2 className="font-editorial text-lg font-semibold text-white">
              Orders by Status
            </h2>
            <div className="space-y-3 text-xs">
              {report.bookingsByStatus.map((row) => {
                const maxOrders = Math.max(
                  1,
                  report.summary.totalBookings || 1
                );
                const pct = Math.min(
                  100,
                  Math.round((row._count._all / maxOrders) * 100)
                );
                return (
                  <div
                    key={row.status}
                    className="p-3 rounded-xl bg-white/[0.045] border border-white/[0.11] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill status={row.status} />
                      <div className="text-right font-tech">
                        <span className="font-bold text-white">
                          {row._count._all}
                        </span>{" "}
                        <span className="text-slate-400">
                          · {formatKes(row._sum.totalPayable ?? 0)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-sky-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </HudCard>

          <HudCard theme="emerald" className="p-6 space-y-4">
            <h2 className="font-editorial text-lg font-semibold text-white">
              Top Tested Writers
            </h2>
            <div className="space-y-2.5 text-xs">
              {report.creatorStats.map((c) => (
                <div
                  key={c.username}
                  className="p-3 rounded-xl bg-white/[0.045] border border-white/[0.11] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <RadarAvatar
                      name={c.displayName}
                      size="sm"
                      theme="emerald"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">
                        {c.displayName}
                      </p>
                      <p className="text-slate-400 truncate">
                        @{c.username} ·{" "}
                        <strong className="text-slate-200">
                          {c.completedBookingsCount}
                        </strong>{" "}
                        orders · {c.ratingAverage.toFixed(1)}★
                      </p>
                    </div>
                  </div>
                  <ScoreRing
                    score={c.assessmentScore ?? 0}
                    size={46}
                    strokeWidth={4}
                    tone="emerald"
                  />
                </div>
              ))}
            </div>
          </HudCard>
        </div>
      )}
    </AdminShell>
  );
}

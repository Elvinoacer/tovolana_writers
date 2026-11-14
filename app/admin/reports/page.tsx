"use client";

import {
  CreatorAvatar,
  ScoreRing,
} from "@/components/ui/EditorialVisuals";

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
      title="Operational Analytics & CSV Export"
      subtitle="Export structured financial, category, and booking completion telemetry for accounting and operations."
    >
      <div className="editorial-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-editorial text-xl font-semibold">
            Download Production Ledger CSV
          </h2>
          <p className="text-xs text-stone-600 mt-1">
            Includes booking reference, category, customer, creator, listed
            price, service fee, total payable, and completion timestamps.
          </p>
        </div>
        <a
          href="/api/admin/reports/export?format=csv"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold hover:bg-[#172554]"
        >
          <Download className="w-4 h-4" />
          Export CSV Report
        </a>
      </div>

      {report?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="editorial-card p-4">
            <p className="text-xs text-stone-500">Total Bookings</p>
            <p className="font-tech text-xl font-bold mt-1">
              {report.summary.totalBookings}
            </p>
          </div>
          <div className="editorial-card p-4">
            <p className="text-xs text-stone-500">Completed Revenue</p>
            <p className="font-tech text-xl font-bold mt-1">
              {formatKes(report.summary.totalCompletedRevenue)}
            </p>
          </div>
          <div className="editorial-card p-4">
            <p className="text-xs text-stone-500">Service Fees Collected</p>
            <p className="font-tech text-xl font-bold mt-1">
              {formatKes(report.summary.bookingFeesCollected)}
            </p>
          </div>
          <div className="editorial-card p-4">
            <p className="text-xs text-stone-500">Pro Member Savings</p>
            <p className="font-tech text-xl font-bold text-amber-800 mt-1">
              {formatKes(report.summary.proDiscountsGranted)}
            </p>
          </div>
        </div>
      )}

      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="editorial-card p-6 bg-white space-y-4">
            <h2 className="font-editorial text-lg font-semibold">
              Bookings Distribution
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
                    className="p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill status={row.status} />
                      <div className="text-right font-tech">
                        <span className="font-bold">{row._count._all}</span>{" "}
                        <span className="text-stone-500">
                          · {formatKes(row._sum.totalPayable ?? 0)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
                      <div
                        className="h-full bg-[#1e3a8a] rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="editorial-card p-6 bg-white space-y-4">
            <h2 className="font-editorial text-lg font-semibold">
              Top Vetted Creators
            </h2>
            <div className="space-y-2.5 text-xs">
              {report.creatorStats.map((c) => (
                <div
                  key={c.username}
                  className="p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CreatorAvatar
                      name={c.displayName}
                      username={c.username}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-[#111827] truncate">
                        {c.displayName}
                      </p>
                      <p className="text-stone-500 truncate">
                        @{c.username} · <strong>{c.completedBookingsCount}</strong> orders ·{" "}
                        {c.ratingAverage.toFixed(1)}★
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
          </div>
        </div>
      )}
    </AdminShell>
  );
}

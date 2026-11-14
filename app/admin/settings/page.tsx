"use client";

import React, { useEffect, useState } from "react";
import { Coins, Crown, Megaphone, Save, SlidersHorizontal } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";

export default function AdminSettingsPage() {
  const [standardServiceFeePct, setStandardServiceFeePct] = useState("10");
  const [proFeeDiscountPct, setProFeeDiscountPct] = useState("50");
  const [proMonthlyPrice, setProMonthlyPrice] = useState("2500");
  const [proAnnualPrice, setProAnnualPrice] = useState("24000");
  const [archiveRecoveryDays, setArchiveRecoveryDays] = useState("30");
  const [defaultRevisionLimit, setDefaultRevisionLimit] = useState("2");
  const [proEarlyAccessHours, setProEarlyAccessHours] = useState("48");
  const [announcementBanner, setAnnouncementBanner] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const c = j?.data?.config;
        if (!c) return;
        setStandardServiceFeePct(String(c.standardServiceFeePct));
        setProFeeDiscountPct(String(c.proFeeDiscountPct));
        setProMonthlyPrice(String(c.proMonthlyPrice));
        setProAnnualPrice(String(c.proAnnualPrice));
        setArchiveRecoveryDays(String(c.archiveRecoveryDays));
        setDefaultRevisionLimit(String(c.defaultRevisionLimit));
        setProEarlyAccessHours(String(c.proEarlyAccessHours));
        setAnnouncementBanner(c.announcementBanner || "");
      })
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          standardServiceFeePct: Number(standardServiceFeePct),
          proFeeDiscountPct: Number(proFeeDiscountPct),
          proMonthlyPrice: Number(proMonthlyPrice),
          proAnnualPrice: Number(proAnnualPrice),
          archiveRecoveryDays: Number(archiveRecoveryDays),
          defaultRevisionLimit: Number(defaultRevisionLimit),
          proEarlyAccessHours: Number(proEarlyAccessHours),
          announcementBanner: announcementBanner.trim() || null,
          reason: "Admin console platform fee & announcement update",
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Save failed.");
      setNotice("Global platform configuration saved and audited.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="Platform Fees, Pro Configuration & Announcements"
      subtitle="Dynamically adjust service fees, Pro plan pricing, archive retention rules, and site-wide announcement copy."
      requiredScope="SUPER_ADMIN"
    >
      {error && (
        <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
          {notice}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl bg-[#111827] text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/10 shadow-sm">
          <div>
            <p className="font-tech text-[10px] uppercase tracking-[0.18em] text-amber-300 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" /> Live Fee Schedule Preview
            </p>
            <p className="font-editorial text-xl font-semibold mt-1">
              {Number(standardServiceFeePct) || 0}% Free{" "}
              <span className="text-white/40 mx-1.5">/</span>{" "}
              <span className="text-emerald-300">
                {Math.max(
                  0,
                  Number(
                    (
                      (Number(standardServiceFeePct) || 0) *
                      (1 - (Number(proFeeDiscountPct) || 0) / 100)
                    ).toFixed(2)
                  )
                )}
                % Pro
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-tech">
            <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">
              Pro Monthly: KES {Number(proMonthlyPrice) || 0}
            </span>
            <span className="px-3 py-1.5 rounded-full bg-amber-400/15 text-amber-200 border border-amber-300/20">
              Pro Annual: KES {Number(proAnnualPrice) || 0}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="editorial-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e6e0d4] pb-3">
              <h2 className="font-editorial text-lg font-semibold text-[#111827] flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#1e3a8a]" />
                Marketplace Economics
              </h2>
              <span className="font-tech text-[10px] uppercase tracking-wider text-stone-400">
                Fees & Plans
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Standard Service Fee (%)
                </label>
                <input
                  type="number"
                  value={standardServiceFeePct}
                  onChange={(e) => setStandardServiceFeePct(e.target.value)}
                  className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm font-tech focus:outline-none focus:border-[#1e3a8a]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Pro Fee Discount (%)
                </label>
                <input
                  type="number"
                  value={proFeeDiscountPct}
                  onChange={(e) => setProFeeDiscountPct(e.target.value)}
                  className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm font-tech focus:outline-none focus:border-[#1e3a8a]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Pro Monthly Price (KES)
                </label>
                <input
                  type="number"
                  value={proMonthlyPrice}
                  onChange={(e) => setProMonthlyPrice(e.target.value)}
                  className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm font-tech focus:outline-none focus:border-[#1e3a8a]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Pro Annual Price (KES)
                </label>
                <input
                  type="number"
                  value={proAnnualPrice}
                  onChange={(e) => setProAnnualPrice(e.target.value)}
                  className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm font-tech focus:outline-none focus:border-[#1e3a8a]"
                />
              </div>
            </div>
          </section>

          <section className="editorial-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e6e0d4] pb-3">
              <h2 className="font-editorial text-lg font-semibold text-[#111827] flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#0f766e]" />
                Operations & Lifecycle
              </h2>
              <span className="font-tech text-[10px] uppercase tracking-wider text-stone-400">
                Windows & Quotas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Pro Early Access (Hrs)
                </label>
                <input
                  type="number"
                  value={proEarlyAccessHours}
                  onChange={(e) => setProEarlyAccessHours(e.target.value)}
                  className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm font-tech focus:outline-none focus:border-[#1e3a8a]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Archive Window (Days)
                </label>
                <input
                  type="number"
                  value={archiveRecoveryDays}
                  onChange={(e) => setArchiveRecoveryDays(e.target.value)}
                  className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm font-tech focus:outline-none focus:border-[#1e3a8a]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Default Revisions
                </label>
                <input
                  type="number"
                  value={defaultRevisionLimit}
                  onChange={(e) => setDefaultRevisionLimit(e.target.value)}
                  className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm font-tech focus:outline-none focus:border-[#1e3a8a]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5 flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-amber-700" />
                Site-Wide Announcement Banner (optional)
              </label>
              <input
                type="text"
                value={announcementBanner}
                onChange={(e) => setAnnouncementBanner(e.target.value)}
                placeholder="e.g. Scheduled Q4 academic dissertation demand — Creators Hub open."
                className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#1e3a8a]"
              />
            </div>
          </section>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Global Configuration"}
          </button>
        </div>
      </form>
    </AdminShell>
  );
}

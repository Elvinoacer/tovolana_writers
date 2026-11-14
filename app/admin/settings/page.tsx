"use client";

import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
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

      <form onSubmit={handleSave} className="editorial-card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">
              Standard Service Fee (%)
            </label>
            <input
              type="number"
              value={standardServiceFeePct}
              onChange={(e) => setStandardServiceFeePct(e.target.value)}
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-sm font-tech"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Pro Fee Discount (%)
            </label>
            <input
              type="number"
              value={proFeeDiscountPct}
              onChange={(e) => setProFeeDiscountPct(e.target.value)}
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-sm font-tech"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Pro Early Access Window (Hours)
            </label>
            <input
              type="number"
              value={proEarlyAccessHours}
              onChange={(e) => setProEarlyAccessHours(e.target.value)}
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-sm font-tech"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Pro Monthly Price (KES)
            </label>
            <input
              type="number"
              value={proMonthlyPrice}
              onChange={(e) => setProMonthlyPrice(e.target.value)}
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-sm font-tech"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Pro Annual Price (KES)
            </label>
            <input
              type="number"
              value={proAnnualPrice}
              onChange={(e) => setProAnnualPrice(e.target.value)}
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-sm font-tech"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Archive Recovery Window (Days)
            </label>
            <input
              type="number"
              value={archiveRecoveryDays}
              onChange={(e) => setArchiveRecoveryDays(e.target.value)}
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-sm font-tech"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">
            Platform Announcement Banner (optional)
          </label>
          <input
            type="text"
            value={announcementBanner}
            onChange={(e) => setAnnouncementBanner(e.target.value)}
            placeholder="e.g. Scheduled Q4 academic dissertation demand — Creators Hub open."
            className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold hover:bg-[#172554]"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Global Configuration"}
          </button>
        </div>
      </form>
    </AdminShell>
  );
}

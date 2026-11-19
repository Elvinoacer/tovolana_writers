"use client";

import React, { useEffect, useState } from "react";
import { Coins, Crown, Megaphone, Save, SlidersHorizontal } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { HudCard, HudPriceDock } from "@/components/ui/AuroraPrimitives";

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
          reason: "Admin settings update",
        }),
      });
      const j = await res.json();
      if (!res.ok)
        throw new Error(j.error?.message || "Could not save settings.");
      setNotice("Platform settings saved.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save settings."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="Platform Settings"
      subtitle="Set service fees, Pro prices, free edit defaults, and the top site notice."
      requiredScope="SUPER_ADMIN"
    >
      {error && (
        <div className="p-3.5 rounded-lg border border-rose-400/35 bg-rose-500/15 text-rose-200 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-lg border border-emerald-400/35 bg-emerald-500/15 text-emerald-200 text-sm">
          {notice}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <HudCard
          theme="amber"
          brackets
          microLabel="LIVE PRICING PREVIEW"
          className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <p className="font-tech text-[10px] uppercase tracking-[0.18em] text-amber-300 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" /> Current Fee Preview
            </p>
            <p className="font-editorial text-xl font-semibold text-white mt-1">
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
          <div className="flex flex-wrap items-center gap-3">
            <HudPriceDock
              label="PRO MONTHLY"
              price={`KES ${Number(proMonthlyPrice) || 0}`}
              theme="cyan"
              size="sm"
            />
            <HudPriceDock
              label="PRO YEARLY"
              price={`KES ${Number(proAnnualPrice) || 0}`}
              theme="amber"
              size="sm"
            />
          </div>
        </HudCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <HudCard theme="sky" className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h2 className="font-editorial text-lg font-semibold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-sky-300" />
                Fees &amp; Pro Prices
              </h2>
              <span className="font-tech text-[10px] uppercase tracking-wider text-slate-400">
                Pricing
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Normal Service Fee (%)
                </label>
                <input
                  type="number"
                  value={standardServiceFeePct}
                  onChange={(e) => setStandardServiceFeePct(e.target.value)}
                  className="hud-input font-tech"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Pro Fee Discount (%)
                </label>
                <input
                  type="number"
                  value={proFeeDiscountPct}
                  onChange={(e) => setProFeeDiscountPct(e.target.value)}
                  className="hud-input font-tech"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Pro Monthly Price (KES)
                </label>
                <input
                  type="number"
                  value={proMonthlyPrice}
                  onChange={(e) => setProMonthlyPrice(e.target.value)}
                  className="hud-input font-tech"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Pro Yearly Price (KES)
                </label>
                <input
                  type="number"
                  value={proAnnualPrice}
                  onChange={(e) => setProAnnualPrice(e.target.value)}
                  className="hud-input font-tech"
                />
              </div>
            </div>
          </HudCard>

          <HudCard theme="emerald" className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h2 className="font-editorial text-lg font-semibold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-teal-300" />
                Order Defaults &amp; Notice
              </h2>
              <span className="font-tech text-[10px] uppercase tracking-wider text-slate-400">
                Rules
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Pro Early Access (Hours)
                </label>
                <input
                  type="number"
                  value={proEarlyAccessHours}
                  onChange={(e) => setProEarlyAccessHours(e.target.value)}
                  className="hud-input font-tech"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Closed Service Recovery (Days)
                </label>
                <input
                  type="number"
                  value={archiveRecoveryDays}
                  onChange={(e) => setArchiveRecoveryDays(e.target.value)}
                  className="hud-input font-tech"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Default Free Edits
                </label>
                <input
                  type="number"
                  value={defaultRevisionLimit}
                  onChange={(e) => setDefaultRevisionLimit(e.target.value)}
                  className="hud-input font-tech"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-amber-300" />
                Top Site Notice Banner (optional)
              </label>
              <input
                type="text"
                value={announcementBanner}
                onChange={(e) => setAnnouncementBanner(e.target.value)}
                placeholder="e.g. Fast turnaround available all week — apply to write or order today."
                className="hud-input"
              />
            </div>
          </HudCard>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </AdminShell>
  );
}

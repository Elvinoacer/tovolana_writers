"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Archive, RefreshCw, ShieldAlert } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import {
  ListingValidityTag,
  StatusPill,
} from "@/components/ui/Badges";
import { HudCard } from "@/components/ui/AuroraPrimitives";

interface VaultListing {
  id: string;
  slug: string;
  title: string;
  status: string;
  validUntil: string | null;
  validityType: string;
  category: { name: string };
  creator: { displayName: string };
  _count: { bookings: number };
}

export default function AdminVaultPage() {
  const [archived, setArchived] = useState<VaultListing[]>([]);
  const [expired, setExpired] = useState<VaultListing[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<VaultListing[]>([]);
  const [customDates, setCustomDates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const loadVault = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setArchived(j.data?.archivedVaultListings ?? []);
        setExpired(j.data?.expiredListings ?? []);
        setExpiringSoon(j.data?.expiringSoonListings ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/overview", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (!active || !j?.data) return;
        setArchived(j.data.archivedVaultListings ?? []);
        setExpired(j.data.expiredListings ?? []);
        setExpiringSoon(j.data.expiringSoonListings ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function runLifecycle(
    id: string,
    action: "RESTORE" | "ARCHIVE" | "EXPIRE" | "SUSPEND" | "SET_VALIDITY"
  ) {
    const res = await fetch(`/api/admin/listings/${id}/lifecycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        validityType: customDates[id] ? "ADMIN_CUSTOM" : "STANDARD_30D",
        customValidUntil: customDates[id]
          ? new Date(customDates[id]).toISOString()
          : undefined,
        reason: `Service ${action} via Admin Panel`,
      }),
    });
    if (res.ok) {
      setNotice("Service updated.");
      await loadVault();
    }
  }

  function renderSection(title: string, items: VaultListing[]) {
    return (
      <HudCard theme="sky" className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-editorial text-lg font-semibold text-white flex items-center gap-2">
            <Archive className="w-4 h-4 text-sky-300" />
            {title}
          </h2>
          <span className="font-tech text-xs px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.12] text-slate-300">
            {items.length}
          </span>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">
            None in this group right now.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((l) => (
              <div
                key={l.id}
                className="p-4 rounded-2xl bg-white/[0.045] border border-white/[0.11] flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusPill status={l.status} />
                    <span className="text-xs font-medium text-slate-300">
                      {l.category.name} · {l.creator.displayName} ·{" "}
                      <span className="font-tech text-slate-400">
                        {l._count?.bookings ?? 0} orders
                      </span>
                    </span>
                  </div>
                  <p className="font-editorial font-semibold text-base text-white">
                    {l.title}
                  </p>
                  <ListingValidityTag
                    validUntil={l.validUntil}
                    validityType={l.validityType}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={customDates[l.id] || ""}
                    onChange={(e) =>
                      setCustomDates((p) => ({ ...p, [l.id]: e.target.value }))
                    }
                    className="hud-input w-auto px-3 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => runLifecycle(l.id, "RESTORE")}
                    className="btn-creator px-3.5 py-1.5 text-xs gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {customDates[l.id] ? "Reopen Until Date" : "Add 30 Days"}
                  </button>
                  {l.status !== "ARCHIVED" && (
                    <button
                      onClick={() => runLifecycle(l.id, "ARCHIVE")}
                      className="btn-ghost px-3 py-1.5 text-xs"
                    >
                      Archive
                    </button>
                  )}
                  <button
                    onClick={() => runLifecycle(l.id, "SUSPEND")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-xs font-semibold hover:bg-rose-500/25 transition-colors"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Pause
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </HudCard>
    );
  }

  return (
    <AdminShell
      title="Closed Services"
      subtitle="Reopen closed services or give them a new end date. Active client orders are never affected."
      requiredScope="MODERATION_ADMIN"
    >
      {notice && (
        <div className="p-3.5 rounded-lg border border-emerald-400/35 bg-emerald-500/15 text-emerald-200 text-sm">
          {notice}
        </div>
      )}
      {loading ? (
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading closed services...
        </div>
      ) : (
        <div className="space-y-6">
          {renderSection("Closing Within 7 Days", expiringSoon)}
          {renderSection("Expired", expired)}
          {renderSection("Archived", archived)}
        </div>
      )}
    </AdminShell>
  );
}

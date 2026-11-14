"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Archive, RefreshCw, ShieldAlert } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import {
  ListingValidityTag,
  StatusPill,
} from "@/components/ui/Badges";

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
        reason: `Vault ${action} operation via Admin Console`,
      }),
    });
    if (res.ok) {
      setNotice(`Executed ${action} cleanly.`);
      await loadVault();
    }
  }

  function renderSection(title: string, items: VaultListing[]) {
    return (
      <div className="editorial-card p-5 space-y-3">
        <h2 className="font-editorial text-lg font-semibold flex items-center gap-2">
          <Archive className="w-4 h-4 text-[#1e3a8a]" />
          {title} ({items.length})
        </h2>
        {items.length === 0 ? (
          <p className="text-xs text-stone-500">No listings in this state.</p>
        ) : (
          <div className="divide-y divide-[#e6e0d4]">
            {items.map((l) => (
              <div
                key={l.id}
                className="py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusPill status={l.status} />
                    <span className="text-xs text-stone-500">
                      {l.category.name} · {l.creator.displayName} ·{" "}
                      {l._count?.bookings ?? 0} bookings
                    </span>
                  </div>
                  <p className="font-medium text-sm">{l.title}</p>
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
                    className="px-2.5 py-1.5 rounded border border-[#e6e0d4] text-xs"
                  />
                  <button
                    onClick={() => runLifecycle(l.id, "RESTORE")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Restore / Publish
                  </button>
                  {l.status !== "ARCHIVED" && (
                    <button
                      onClick={() => runLifecycle(l.id, "ARCHIVE")}
                      className="px-3 py-1.5 rounded-lg border border-[#e6e0d4] bg-white text-xs font-medium"
                    >
                      Move to Archive
                    </button>
                  )}
                  <button
                    onClick={() => runLifecycle(l.id, "SUSPEND")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-medium"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Suspend
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <AdminShell
      title="Listing Archive & Expiry Vault"
      subtitle="Restore archived/expired listings with updated Valid Until dates while keeping historical confirmed bookings untouched."
      requiredScope="MODERATION_ADMIN"
    >
      {notice && (
        <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
          {notice}
        </div>
      )}
      {loading ? (
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading Archive & Expiry Vault...
        </div>
      ) : (
        <div className="space-y-6">
          {renderSection("Expiring Within 7 Days", expiringSoon)}
          {renderSection("Expired Public Listings", expired)}
          {renderSection("Temporary Archive Storage Vault", archived)}
        </div>
      )}
    </AdminShell>
  );
}

"use client";

import { CategoryCoverArt } from "@/components/ui/EditorialVisuals";
import {
  HudCard,
  HudPriceDock,
  RadarAvatar,
} from "@/components/ui/AuroraPrimitives";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FilePlus2, RotateCcw, XCircle } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import {
  ListingValidityTag,
  StatusPill,
  formatKes,
} from "@/components/ui/Badges";
import { getCardHudTheme } from "@/lib/design-tokens";

interface ModerationListing {
  id: string;
  slug: string;
  title: string;
  status: string;
  basePrice: number;
  currency: string;
  validityType: string;
  validUntil: string | null;
  category: { name: string };
  creator: { displayName: string; username: string };
}

export default function AdminListingModerationPage() {
  const [queue, setQueue] = useState<ModerationListing[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [validityChoices, setValidityChoices] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setQueue(j.data?.moderationQueue ?? []);
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
        if (active && j?.data) setQueue(j.data.moderationQueue ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function decide(
    listingId: string,
    decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT"
  ) {
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/admin/listings/${listingId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        note: notes[listingId] || `Admin ${decision.toLowerCase()} decision`,
        validityType: validityChoices[listingId] || "STANDARD_30D",
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error?.message || "Moderation failed.");
      return;
    }
    setNotice(
      decision === "APPROVE"
        ? "Service approved and is now live."
        : decision === "REQUEST_CHANGES"
          ? "Asked the writer for changes."
          : "Service rejected."
    );
    await loadQueue();
  }

  return (
    <AdminShell
      title="Approve Services"
      subtitle="Check new writer services before they go live, or add one yourself."
      requiredScope="MODERATION_ADMIN"
    >
      <div className="flex justify-end">
        <Link
          href="/creators-hub/listings/new"
          className="btn-primary px-4 py-2 text-xs gap-1.5"
        >
          <FilePlus2 className="w-4 h-4" />
          Add &amp; Publish Service Now
        </Link>
      </div>

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

      {loading ? (
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading services to review...
        </div>
      ) : queue.length === 0 ? (
        <div className="editorial-card p-8 text-center text-sm text-slate-300">
          No services waiting for approval right now.
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((item, idx) => {
            const catSlug = item.category.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-");
            const theme = getCardHudTheme(catSlug, idx);
            return (
              <HudCard
                key={item.id}
                theme={theme}
                brackets
                className="overflow-hidden"
              >
                <CategoryCoverArt
                  slug={catSlug}
                  name={item.category.name}
                  heightClass="h-16"
                />
                <div className="p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <RadarAvatar
                        name={item.creator.displayName}
                        size="md"
                        theme={theme}
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusPill status={item.status} />
                          <span className="text-xs font-semibold text-teal-300">
                            {item.creator.displayName} (@{item.creator.username}
                            )
                          </span>
                        </div>
                        <h2 className="font-editorial text-xl font-semibold mt-1 text-white">
                          {item.title}
                        </h2>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-start sm:items-end gap-2 shrink-0">
                      <HudPriceDock
                        label="LIST PRICE"
                        price={formatKes(item.basePrice, item.currency)}
                        theme={theme}
                        size="sm"
                      />
                      <ListingValidityTag
                        validUntil={item.validUntil}
                        validityType={item.validityType}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={notes[item.id] ?? ""}
                      onChange={(e) =>
                        setNotes((p) => ({ ...p, [item.id]: e.target.value }))
                      }
                      placeholder="Write feedback or note what needs fixing..."
                      className="hud-input md:col-span-2 text-xs py-2"
                    />
                    <select
                      value={validityChoices[item.id] ?? "STANDARD_30D"}
                      onChange={(e) =>
                        setValidityChoices((p) => ({
                          ...p,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="hud-input text-xs py-2"
                    >
                      <option value="STANDARD_30D">Open for 30 Days</option>
                      <option value="SHORT_14D">Open for 14 Days</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => decide(item.id, "APPROVE")}
                      className="btn-creator px-4 py-2 text-xs gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve &amp; Go Live
                    </button>
                    <button
                      onClick={() => decide(item.id, "REQUEST_CHANGES")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-amber-400/35 bg-amber-500/15 text-amber-200 text-xs font-semibold hover:bg-amber-500/25 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Ask for Changes
                    </button>
                    <button
                      onClick={() => decide(item.id, "REJECT")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-xs font-semibold hover:bg-rose-500/25 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              </HudCard>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}

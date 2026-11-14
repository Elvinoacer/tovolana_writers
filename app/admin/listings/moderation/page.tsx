"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FilePlus2, RotateCcw, XCircle } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import {
  ListingValidityTag,
  StatusPill,
  formatKes,
} from "@/components/ui/Badges";

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
    setNotice(`Listing updated with decision: ${decision}`);
    await loadQueue();
  }

  return (
    <AdminShell
      title="Listing Moderation Queue"
      subtitle="Approve Creator submissions, enforce pricing/requirements transparency, or create direct Admin listings."
      requiredScope="MODERATION_ADMIN"
    >
      <div className="flex justify-end">
        <Link
          href="/creators-hub/listings/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-xs font-semibold hover:bg-[#172554]"
        >
          <FilePlus2 className="w-4 h-4" />
          Publish Direct Admin Listing
        </Link>
      </div>

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

      {loading ? (
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading moderation queue...
        </div>
      ) : queue.length === 0 ? (
        <div className="editorial-card p-8 text-center text-sm text-stone-600">
          No pending Creator listings in the moderation queue.
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => (
            <div key={item.id} className="editorial-card p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusPill status={item.status} />
                    <span className="text-xs text-stone-500">
                      {item.category.name}
                    </span>
                    <span className="text-xs text-[#0f766e]">
                      Creator: {item.creator.displayName} (@
                      {item.creator.username})
                    </span>
                  </div>
                  <h2 className="font-editorial text-xl font-semibold mt-1">
                    {item.title}
                  </h2>
                </div>
                <div className="text-right">
                  <p className="font-tech font-bold text-lg">
                    {formatKes(item.basePrice, item.currency)}
                  </p>
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
                  placeholder="Moderation note or required corrections..."
                  className="md:col-span-2 rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-xs"
                />
                <select
                  value={validityChoices[item.id] ?? "STANDARD_30D"}
                  onChange={(e) =>
                    setValidityChoices((p) => ({
                      ...p,
                      [item.id]: e.target.value,
                    }))
                  }
                  className="rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-xs"
                >
                  <option value="STANDARD_30D">Approve for 30 Days</option>
                  <option value="SHORT_14D">Approve for 14 Days</option>
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => decide(item.id, "APPROVE")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve & Publish
                </button>
                <button
                  onClick={() => decide(item.id, "REQUEST_CHANGES")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-orange-300 bg-white text-orange-800 text-xs font-semibold hover:bg-orange-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Return for Changes
                </button>
                <button
                  onClick={() => decide(item.id, "REJECT")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-rose-300 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

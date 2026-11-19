"use client";

import { CreatorShell } from "@/components/CreatorShell";
import { CategoryCoverArt } from "@/components/ui/EditorialVisuals";
import { HudCard, HudPriceDock } from "@/components/ui/AuroraPrimitives";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Archive, Edit3, FilePlus2, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import {
  ListingValidityTag,
  StatusPill,
  formatKes,
} from "@/components/ui/Badges";
import { NextStepBanner } from "@/components/ui/FlowGuide";
import { getCardHudTheme } from "@/lib/design-tokens";

interface CreatorListingRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  basePrice: number;
  currency: string;
  validityType: string;
  validUntil: string | null;
  moderationNote: string | null;
  category: { name: string };
  _count: { bookings: number };
}

export default function CreatorListingsManagerPage() {
  const { user, loading: authLoading } = useAuth();
  const [listings, setListings] = useState<CreatorListingRow[]>([]);
  const [fetched, setFetched] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    try {
      const res = await fetch("/api/creators-hub/listings", {
        cache: "no-store",
      });
      if (res.ok) {
        const j = await res.json();
        setListings(j.data?.listings ?? []);
      }
    } finally {
      setFetched(true);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    fetch("/api/creators-hub/listings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (active && j?.data) setListings(j.data.listings ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setFetched(true);
      });
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const loading = authLoading || (Boolean(user) && !fetched);

  async function submitForReview(slug: string) {
    setError(null);
    const res = await fetch(`/api/tasks/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submitForReview: true }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error?.message || "Submit failed.");
      return;
    }
    setNotice("Sent to our team for a quick check.");
    await loadListings();
  }

  async function archiveOrDelete(slug: string) {
    setError(null);
    const res = await fetch(`/api/tasks/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error?.message || "Delete failed.");
      return;
    }
    setNotice(
      j.data?.mode === "ARCHIVED"
        ? "Service closed and archived (kept for past client orders)."
        : "Service removed."
    );
    await loadListings();
  }

  if (authLoading || loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading your services...
        </div>
      </main>
    );
  }

  if (!user || !user.roles.includes("CREATOR")) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <HudCard theme="cyan" brackets className="p-8 text-center space-y-4">
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Writer access needed
          </h1>
          <Link
            href="/creators-hub"
            className="btn-creator inline-flex px-5 py-2.5 text-sm font-semibold"
          >
            Writer Hub
          </Link>
        </HudCard>
      </main>
    );
  }

  const draftOrChanges = listings.find(
    (l) => l.status === "DRAFT" || l.status === "CHANGES_REQUESTED"
  );

  return (
    <CreatorShell
      title="My Services"
      subtitle="Add new services, send drafts for review, or close old ones."
    >
      <NextStepBanner
        tone={
          listings.length === 0 ? "blue" : draftOrChanges ? "amber" : "teal"
        }
        eyebrow={
          listings.length === 0
            ? "Get started"
            : draftOrChanges
              ? "Draft waiting"
              : "Services ready"
        }
        now={
          listings.length === 0
            ? "You do not have any writing services listed yet."
            : draftOrChanges
              ? `"${draftOrChanges.title}" still needs to be submitted for team approval.`
              : `You have ${listings.length} service${listings.length === 1 ? "" : "s"} in your list.`
        }
        next={
          listings.length === 0
            ? "Click Add Service to create your first fixed-price offering."
            : draftOrChanges
              ? "Click Submit for Review below (or Edit first) so clients can see and order it."
              : "Share your profile or add more services to reach more clients."
        }
        goal="Keep clear, approved services live so clients can order anytime."
        actionLabel={listings.length === 0 ? "Add Service" : undefined}
        actionHref={
          listings.length === 0 ? "/creators-hub/listings/new" : undefined
        }
      />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <span className="font-tech text-xs px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.12] text-slate-300">
          {listings.length} Service{listings.length === 1 ? "" : "s"}
        </span>
        <Link
          href="/creators-hub/listings/new"
          className="btn-creator px-4 py-2 text-xs gap-1.5"
        >
          <FilePlus2 className="w-4 h-4" />
          Add Service
        </Link>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-xl border border-emerald-400/35 bg-emerald-500/15 text-emerald-200 text-sm">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {listings.map((item, idx) => {
          const catSlug = item.category.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-");
          const hudTheme = getCardHudTheme(catSlug, idx);

          return (
            <HudCard
              key={item.id}
              theme={hudTheme}
              brackets
              className="overflow-hidden flex flex-col justify-between"
            >
              <div>
                <CategoryCoverArt
                  slug={catSlug}
                  name={item.category.name}
                  heightClass="h-20"
                />
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <StatusPill status={item.status} />
                    <span className="text-xs font-tech text-slate-400">
                      {item._count.bookings} order
                      {item._count.bookings === 1 ? "" : "s"}
                    </span>
                  </div>

                  <h2 className="font-editorial text-lg font-semibold text-white">
                    {item.title}
                  </h2>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <ListingValidityTag
                      validUntil={item.validUntil}
                      validityType={item.validityType}
                    />
                    <HudPriceDock
                      label="PRICE"
                      price={formatKes(item.basePrice, item.currency)}
                      theme={hudTheme}
                      size="sm"
                    />
                  </div>

                  {item.moderationNote && (
                    <p className="text-xs text-amber-200 bg-amber-500/15 border border-amber-400/35 px-3 py-2 rounded-xl">
                      Team Note: {item.moderationNote}
                    </p>
                  )}
                </div>
              </div>

              <div className="px-5 pb-5 pt-3 border-t border-white/[0.08] flex flex-wrap items-center gap-2">
                <Link
                  href={`/creators-hub/listings/new?edit=${encodeURIComponent(item.slug)}`}
                  className="btn-ghost px-3 py-1.5 text-xs gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </Link>

                {(item.status === "DRAFT" ||
                  item.status === "CHANGES_REQUESTED") && (
                  <button
                    onClick={() => submitForReview(item.slug)}
                    className="btn-creator px-3 py-1.5 text-xs gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit for Review
                  </button>
                )}

                <button
                  onClick={() => archiveOrDelete(item.slug)}
                  className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-xs font-semibold hover:bg-rose-500/25 transition-colors"
                >
                  {item._count.bookings > 0 ? (
                    <>
                      <Archive className="w-3.5 h-3.5" />
                      Archive
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </HudCard>
          );
        })}
      </div>
    </CreatorShell>
  );
}

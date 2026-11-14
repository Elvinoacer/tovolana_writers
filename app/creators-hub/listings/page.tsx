"use client";

import { CreatorShell } from "@/components/CreatorShell";
import { CategoryCoverArt } from "@/components/ui/EditorialVisuals";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Archive, Edit3, FilePlus2, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import {
  ListingValidityTag,
  StatusPill,
  formatKes,
} from "@/components/ui/Badges";

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
    setNotice("Submitted listing to Administrator moderation queue.");
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
        ? "Listing archived because existing bookings depend on its record."
        : "Listing soft-deleted cleanly."
    );
    await loadListings();
  }

  if (authLoading || loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading your Creator listings...
        </div>
      </main>
    );
  }

  if (!user || !user.roles.includes("CREATOR")) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <h1 className="text-2xl font-editorial font-semibold">
            Creator access required
          </h1>
          <Link
            href="/creators-hub"
            className="inline-flex px-5 py-2.5 rounded-lg bg-[#0f766e] text-white text-sm font-semibold"
          >
            Creators Hub
          </Link>
        </div>
      </main>
    );
  }

  return (
    <CreatorShell
      title="My Service Listings"
      subtitle="Manage drafts, admin review feedback, validity windows, and archives."
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <span className="font-tech text-xs px-3 py-1 rounded-full bg-white border border-[#e6e0d4] text-stone-700">
          {listings.length} Services
        </span>
        <Link
          href="/creators-hub/listings/new"
          className="btn-creator px-4 py-2 text-xs gap-1.5"
        >
          <FilePlus2 className="w-4 h-4" />
          New Listing
        </Link>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {listings.map((item) => {
          const catSlug = item.category.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-");

          return (
            <div
              key={item.id}
              className="editorial-card overflow-hidden bg-white flex flex-col justify-between"
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
                    <span className="text-xs font-tech text-stone-600">
                      {item._count.bookings} bookings
                    </span>
                  </div>

                  <h2 className="font-editorial text-lg font-semibold text-[#111827]">
                    {item.title}
                  </h2>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <ListingValidityTag
                      validUntil={item.validUntil}
                      validityType={item.validityType}
                    />
                    <span className="font-tech text-base font-bold text-[#111827]">
                      {formatKes(item.basePrice, item.currency)}
                    </span>
                  </div>

                  {item.moderationNote && (
                    <p className="text-xs text-orange-800 bg-orange-50 border border-orange-200 px-3 py-2 rounded-xl">
                      Admin Note: {item.moderationNote}
                    </p>
                  )}
                </div>
              </div>

              <div className="px-5 pb-5 pt-3 border-t border-[#e6e0d4] flex flex-wrap items-center gap-2">
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
                    Submit Review
                  </button>
                )}

                <button
                  onClick={() => archiveOrDelete(item.slug)}
                  className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50 transition-colors"
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
            </div>
          );
        })}
      </div>
    </CreatorShell>
  );
}

"use client";

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
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-editorial font-semibold">
            My Service Listings
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Manage drafts, moderation feedback, valid dates, and archived
            offerings.
          </p>
        </div>
        <Link
          href="/creators-hub/listings/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f766e] text-white text-sm font-semibold hover:bg-teal-900"
        >
          <FilePlus2 className="w-4 h-4" />
          New Listing
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

      <div className="space-y-4">
        {listings.map((item) => (
          <div
            key={item.id}
            className="editorial-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusPill status={item.status} />
                <span className="text-xs text-stone-500">
                  {item.category.name}
                </span>
                <span className="text-xs font-tech text-stone-600">
                  · {item._count.bookings} bookings
                </span>
              </div>
              <h2 className="font-editorial text-lg font-semibold">
                {item.title}
              </h2>
              <div className="flex items-center gap-3 flex-wrap">
                <ListingValidityTag
                  validUntil={item.validUntil}
                  validityType={item.validityType}
                />
                <span className="font-tech text-sm font-bold text-[#111827]">
                  {formatKes(item.basePrice, item.currency)}
                </span>
              </div>
              {item.moderationNote && (
                <p className="text-xs text-orange-800 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded">
                  Admin Feedback: {item.moderationNote}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link
                href={`/creators-hub/listings/new?edit=${encodeURIComponent(item.slug)}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e6e0d4] bg-white text-xs font-medium hover:bg-stone-50"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </Link>

              {(item.status === "DRAFT" ||
                item.status === "CHANGES_REQUESTED") && (
                <button
                  onClick={() => submitForReview(item.slug)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0f766e] text-white text-xs font-semibold hover:bg-teal-900"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit Review
                </button>
              )}

              <button
                onClick={() => archiveOrDelete(item.slug)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 bg-white text-rose-700 text-xs font-medium hover:bg-rose-50"
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
        ))}
      </div>
    </main>
  );
}

"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, Save, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthContext";

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

function ListingEditorInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editSlug = searchParams.get("edit");

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [serviceType, setServiceType] = useState("Research & Drafting");
  const [shortDescription, setShortDescription] = useState("");
  const [fullDescription, setFullDescription] = useState("");
  const [pricingType, setPricingType] = useState<"FIXED" | "QUOTE_BASED">(
    "FIXED"
  );
  const [basePrice, setBasePrice] = useState("4500");
  const [deliveryTurnaroundDays, setDeliveryTurnaroundDays] = useState("3");
  const [maxRevisions, setMaxRevisions] = useState("2");
  const [validityType, setValidityType] = useState<
    "STANDARD_30D" | "SHORT_14D"
  >("STANDARD_30D");
  const [manualAcceptanceRequired, setManualAcceptanceRequired] =
    useState(false);
  const [deliverables, setDeliverables] = useState<string[]>([
    "Publication-ready DOCX & PDF manuscript",
    "Formatted reference bibliography & originality summary",
  ]);
  const [newDeliverable, setNewDeliverable] = useState("");
  const [revisionPolicy, setRevisionPolicy] = useState(
    "Up to 2 structured revisions within 7 days of delivery aligned to the original customer brief."
  );
  const [cancellationPolicy, setCancellationPolicy] = useState(
    "Full escrow refund before acceptance or overdue violation; pro-rated mediation via Tovolana Admin Tribunal once active."
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categories", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const list = j.data?.categories ?? [];
        setCategories(list);
        if (list.length > 0 && !categoryId) {
          setCategoryId(list[0].id);
        }
      })
      .catch(() => {});
  }, [categoryId]);

  useEffect(() => {
    if (!editSlug) return;
    fetch(`/api/tasks/${encodeURIComponent(editSlug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const t = j?.data?.task;
        if (!t) return;
        setTitle(t.title || "");
        setCategoryId(t.categoryId || "");
        setServiceType(t.serviceType || "Research & Drafting");
        setShortDescription(t.shortDescription || "");
        setFullDescription(t.fullDescription || "");
        setPricingType(t.pricingType || "FIXED");
        setBasePrice(String(t.basePrice ?? 4500));
        setDeliveryTurnaroundDays(String(t.deliveryTurnaroundDays ?? 3));
        setMaxRevisions(String(t.maxRevisions ?? 2));
        setValidityType(
          t.validityType === "SHORT_14D" ? "SHORT_14D" : "STANDARD_30D"
        );
        setManualAcceptanceRequired(Boolean(t.manualAcceptanceRequired));
        if (Array.isArray(t.deliverablesSummary) && t.deliverablesSummary.length) {
          setDeliverables(t.deliverablesSummary);
        }
        if (t.revisionPolicy) setRevisionPolicy(t.revisionPolicy);
        if (t.cancellationPolicy) setCancellationPolicy(t.cancellationPolicy);
      })
      .catch(() => {});
  }, [editSlug]);

  const isAdmin = Boolean(user?.roles.includes("ADMIN"));

  async function saveListing(
    submitMode: "DRAFT" | "SUBMIT_REVIEW" | "PUBLISH_DIRECT"
  ) {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        categoryId,
        serviceType: serviceType.trim(),
        shortDescription: shortDescription.trim(),
        fullDescription: fullDescription.trim(),
        pricingType,
        basePrice: Number(basePrice),
        currency: "KES",
        deliveryTurnaroundDays: Number(deliveryTurnaroundDays),
        maxRevisions: Number(maxRevisions),
        manualAcceptanceRequired,
        validityType,
        deliverablesSummary: deliverables.filter((d) => d.trim().length >= 2),
        revisionPolicy: revisionPolicy.trim(),
        cancellationPolicy: cancellationPolicy.trim(),
        submitMode,
        submitForReview: submitMode === "SUBMIT_REVIEW",
      };

      const url = editSlug
        ? `/api/tasks/${encodeURIComponent(editSlug)}`
        : "/api/tasks";
      const method = editSlug ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error?.message || "Could not save task listing.");
      }
      router.push(isAdmin ? "/admin/listings/moderation" : "/creators-hub/listings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading listing editor...
        </div>
      </main>
    );
  }

  if (!user || (!user.roles.includes("CREATOR") && !isAdmin)) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <h1 className="text-2xl font-editorial font-semibold">
            Creator or Administrator access required
          </h1>
          <Link
            href="/creators-hub/onboarding"
            className="inline-flex px-5 py-2.5 rounded-lg bg-[#0f766e] text-white text-sm font-semibold"
          >
            Join Creators Hub
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link
        href="/creators-hub/listings"
        className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-[#111827]"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to My Listings
      </Link>

      <div className="editorial-card p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-editorial font-semibold">
            {editSlug ? "Edit Service Listing" : "Create Writing Service Listing"}
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            {isAdmin
              ? "As an Administrator, you may publish directly or save as a draft."
              : "Creator-authored listings save as Drafts or submit into Administrator review before appearing publicly."}
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Task / Service Title
            </label>
            <input
              type="text"
              required
              minLength={6}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. MBA Case Study & Financial Ratio Analysis (2,500 Words)"
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Service Type
              </label>
              <input
                type="text"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Short Marketplace Pitch (1–2 sentences)
            </label>
            <input
              type="text"
              required
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Clear summary displayed on discovery cards."
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Full Scope & Methodology Description
            </label>
            <textarea
              rows={5}
              required
              value={fullDescription}
              onChange={(e) => setFullDescription(e.target.value)}
              placeholder="Detail exactly what the customer receives, formatting conventions, research rigor, and exclusions..."
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                Listed Price (KES)
              </label>
              <input
                type="number"
                min={100}
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-sm font-tech"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Pricing Mode
              </label>
              <select
                value={pricingType}
                onChange={(e) =>
                  setPricingType(e.target.value as "FIXED" | "QUOTE_BASED")
                }
                className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-sm"
              >
                <option value="FIXED">Fixed Price</option>
                <option value="QUOTE_BASED">Quote Based</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Turnaround (Days)
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={deliveryTurnaroundDays}
                onChange={(e) => setDeliveryTurnaroundDays(e.target.value)}
                className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-sm font-tech"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Included Revisions
              </label>
              <input
                type="number"
                min={0}
                max={10}
                value={maxRevisions}
                onChange={(e) => setMaxRevisions(e.target.value)}
                className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-sm font-tech"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Listing Discovery Validity Window
              </label>
              <select
                value={validityType}
                onChange={(e) =>
                  setValidityType(
                    e.target.value as "STANDARD_30D" | "SHORT_14D"
                  )
                }
                className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-sm"
              >
                <option value="STANDARD_30D">Standard 30 Days</option>
                <option value="SHORT_14D">Short Campaign 14 Days</option>
              </select>
            </div>
            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-[#e6e0d4] bg-[#faf7f2] text-xs cursor-pointer mt-4 sm:mt-0">
              <input
                type="checkbox"
                checked={manualAcceptanceRequired}
                onChange={(e) => setManualAcceptanceRequired(e.target.checked)}
              />
              <span>Require manual Creator acceptance on new bookings</span>
            </label>
          </div>

          {/* Deliverables */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Deliverables</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newDeliverable}
                onChange={(e) => setNewDeliverable(e.target.value)}
                placeholder="Add deliverable item..."
                className="flex-1 rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newDeliverable.trim()) return;
                  setDeliverables((p) => [...p, newDeliverable.trim()]);
                  setNewDeliverable("");
                }}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[#e6e0d4] bg-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            <ul className="space-y-1.5">
              {deliverables.map((d, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between px-3 py-1.5 rounded bg-stone-50 border border-[#e6e0d4] text-xs"
                >
                  <span>{d}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setDeliverables((p) => p.filter((_, idx) => idx !== i))
                    }
                    className="text-stone-400 hover:text-rose-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Revision Policy
              </label>
              <textarea
                rows={3}
                value={revisionPolicy}
                onChange={(e) => setRevisionPolicy(e.target.value)}
                className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Cancellation Policy
              </label>
              <textarea
                rows={3}
                value={cancellationPolicy}
                onChange={(e) => setCancellationPolicy(e.target.value)}
                className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 pt-3 border-t border-[#e6e0d4]">
            <button
              type="button"
              disabled={saving}
              onClick={() => saveListing("DRAFT")}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#e6e0d4] bg-white text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              <Save className="w-4 h-4" />
              Save as Draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                saveListing(isAdmin ? "PUBLISH_DIRECT" : "SUBMIT_REVIEW")
              }
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#0f766e] text-white text-sm font-semibold hover:bg-teal-900 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {saving
                ? "Saving..."
                : isAdmin
                  ? "Publish Directly (Admin)"
                  : "Submit for Admin Review"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function NewOrEditListingPage() {
  return (
    <Suspense
      fallback={
        <main className="max-w-4xl mx-auto px-4 py-12">
          <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
            Loading editor...
          </div>
        </main>
      }
    >
      <ListingEditorInner />
    </Suspense>
  );
}

"use client";

import { CreatorShell } from "@/components/CreatorShell";
import { CategoryCoverArt } from "@/components/ui/EditorialVisuals";
import { formatKes as fmtKes } from "@/components/ui/Badges";

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

  const selectedCat = categories.find((c) => c.id === categoryId);
  const catName = selectedCat?.name || "Writing Service";
  const catSlug = catName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const numericPrice = Math.max(0, Number(basePrice) || 0);

  return (
    <CreatorShell
      title={editSlug ? "Edit Service Listing" : "Create Writing Service"}
      subtitle={
        isAdmin
          ? "Administrator direct publish or save as draft."
          : "Submit for Administrator moderation review or save as draft."
      }
    >
      <div className="space-y-5">
        <Link
          href="/creators-hub/listings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-[#111827]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Listings
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 editorial-card p-6 sm:p-8 bg-white space-y-6">
            {error && (
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1.5">
                  Task / Service Title
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. MBA Case Study & Financial Ratio Analysis (2,500 Words)"
                  className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1.5">
                    Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1.5">
                    Service Type
                  </label>
                  <input
                    type="text"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1.5">
                  Short Marketplace Pitch
                </label>
                <input
                  type="text"
                  required
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Concise summary displayed on discovery cards."
                  className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1.5">
                  Full Scope &amp; Methodology
                </label>
                <textarea
                  rows={5}
                  required
                  value={fullDescription}
                  onChange={(e) => setFullDescription(e.target.value)}
                  placeholder="Detail deliverables, citation style, research depth, and boundaries..."
                  className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Price (KES)
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3 py-2 text-sm font-tech"
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
                    className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3 py-2 text-sm"
                  >
                    <option value="FIXED">Fixed</option>
                    <option value="QUOTE_BASED">Quote Based</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Turnaround (d)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={deliveryTurnaroundDays}
                    onChange={(e) => setDeliveryTurnaroundDays(e.target.value)}
                    className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3 py-2 text-sm font-tech"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Revisions
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={maxRevisions}
                    onChange={(e) => setMaxRevisions(e.target.value)}
                    className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3 py-2 text-sm font-tech"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Listing Validity Window
                  </label>
                  <select
                    value={validityType}
                    onChange={(e) =>
                      setValidityType(
                        e.target.value as "STANDARD_30D" | "SHORT_14D"
                      )
                    }
                    className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3 py-2 text-sm"
                  >
                    <option value="STANDARD_30D">Standard 30 Days</option>
                    <option value="SHORT_14D">Short Campaign 14 Days</option>
                  </select>
                </div>
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-[#e6e0d4] bg-[#faf7f2] text-xs cursor-pointer mt-4 sm:mt-0">
                  <input
                    type="checkbox"
                    checked={manualAcceptanceRequired}
                    onChange={(e) => setManualAcceptanceRequired(e.target.checked)}
                  />
                  <span>Require manual acceptance on orders</span>
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
                    placeholder="Add deliverable..."
                    className="flex-1 rounded-xl border border-[#e6e0d4] bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newDeliverable.trim()) return;
                      setDeliverables((p) => [...p, newDeliverable.trim()]);
                      setNewDeliverable("");
                    }}
                    className="btn-ghost px-3 py-2 text-xs gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {deliverables.map((d, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] text-xs"
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
                    className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3 py-2 text-xs"
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
                    className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 pt-3 border-t border-[#e6e0d4]">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => saveListing("DRAFT")}
                  className="btn-ghost px-4 py-2.5 text-sm gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    saveListing(isAdmin ? "PUBLISH_DIRECT" : "SUBMIT_REVIEW")
                  }
                  className="btn-creator px-5 py-2.5 text-sm gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {saving
                    ? "Saving..."
                    : isAdmin
                      ? "Publish Directly"
                      : "Submit for Review"}
                </button>
              </div>
            </div>
          </div>

          {/* Live Marketplace Card Preview */}
          <aside className="editorial-card overflow-hidden bg-white sticky top-24">
            <CategoryCoverArt slug={catSlug} name={catName} heightClass="h-24" />
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between text-[11px] font-tech uppercase text-stone-500">
                <span>Live Card Preview</span>
                <span className="text-[#0f766e] font-semibold">
                  {deliveryTurnaroundDays || 3}d turnaround
                </span>
              </div>
              <h3 className="font-editorial text-lg font-semibold text-[#111827] leading-snug">
                {title || "Your Writing Service Headline"}
              </h3>
              <p className="text-xs text-stone-600 line-clamp-3">
                {shortDescription || "Your short pitch summarizes deliverables cleanly for customers."}
              </p>
              <div className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-600">Listed Rate</span>
                  <span className="font-tech font-bold text-[#111827]">
                    {fmtKes(numericPrice, "KES")}
                  </span>
                </div>
                <div className="flex justify-between text-[#0f766e] font-semibold">
                  <span>Pro Client Saves 50% Fee</span>
                  <span className="font-tech">
                    +{fmtKes(Math.round(numericPrice * 0.05), "KES")} margin edge
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </CreatorShell>
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

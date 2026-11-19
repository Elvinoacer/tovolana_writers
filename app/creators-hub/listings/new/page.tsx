"use client";

import { CreatorShell } from "@/components/CreatorShell";
import { CategoryCoverArt } from "@/components/ui/EditorialVisuals";
import { FlowSteps } from "@/components/ui/FlowGuide";
import { formatKes as fmtKes } from "@/components/ui/Badges";
import {
  HudBadge,
  HudCard,
  HudPriceDock,
} from "@/components/ui/AuroraPrimitives";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, Save, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { getCardHudTheme } from "@/lib/design-tokens";

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
  const [serviceType, setServiceType] = useState("Writing & Research");
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
    "Clean Word & PDF final document",
    "Formatted references list",
  ]);
  const [newDeliverable, setNewDeliverable] = useState("");
  const [revisionPolicy, setRevisionPolicy] = useState(
    "Includes up to 2 free edits within 7 days to match your original instructions."
  );
  const [cancellationPolicy, setCancellationPolicy] = useState(
    "Full refund before the writer starts, or fair review by Support if work has already begun."
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
        if (
          Array.isArray(t.deliverablesSummary) &&
          t.deliverablesSummary.length
        ) {
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
      router.push(
        isAdmin ? "/admin/listings/moderation" : "/creators-hub/listings"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading listing editor...
        </div>
      </main>
    );
  }

  if (!user || (!user.roles.includes("CREATOR") && !isAdmin)) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <HudCard theme="cyan" brackets className="p-8 text-center space-y-4">
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Writer account needed
          </h1>
          <Link
            href="/creators-hub/onboarding"
            className="btn-creator inline-flex px-5 py-2.5 text-sm font-semibold"
          >
            Become a Writer
          </Link>
        </HudCard>
      </main>
    );
  }

  const selectedCat = categories.find((c) => c.id === categoryId);
  const catName = selectedCat?.name || "Writing Service";
  const catSlug = catName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const numericPrice = Math.max(0, Number(basePrice) || 0);
  const previewTheme = getCardHudTheme(catSlug, 0);

  return (
    <CreatorShell
      title={editSlug ? "Edit Service" : "Add a Writing Service"}
      subtitle={
        isAdmin
          ? "Publish right away or save as a draft."
          : "Fill in your service details and submit for a quick team review."
      }
    >
      <div className="space-y-5">
        <Link
          href="/creators-hub/listings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Services
        </Link>

        <FlowSteps
          accent="teal"
          currentStep={editSlug ? 2 : 1}
          goalLabel="Goal: Show your service on Find Writers so clients can order"
          steps={[
            {
              label: "1. Write details",
              hint: "Title, category & what you give",
            },
            { label: "2. Price & days", hint: "Set your rate & turnaround" },
            { label: "3. Team check", hint: "Quick check before going live" },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <HudCard
            theme="cyan"
            brackets
            microLabel="SERVICE EDITOR"
            className="lg:col-span-2 p-6 sm:p-8 space-y-6"
          >
            {error && (
              <div className="p-3.5 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                  Service Title
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Business Plan & Financial Projections (2,500 Words)"
                  className="hud-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                    Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="hud-input"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                    Type of Work
                  </label>
                  <input
                    type="text"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="hud-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                  Short Summary
                </label>
                <input
                  type="text"
                  required
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="One short sentence shown to clients while browsing."
                  className="hud-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                  Full Details
                </label>
                <textarea
                  rows={5}
                  required
                  value={fullDescription}
                  onChange={(e) => setFullDescription(e.target.value)}
                  placeholder="Explain clearly what you will write, how it is formatted, and what clients get..."
                  className="hud-input"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Price (KES)
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="hud-input font-tech"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Price Type
                  </label>
                  <select
                    value={pricingType}
                    onChange={(e) =>
                      setPricingType(e.target.value as "FIXED" | "QUOTE_BASED")
                    }
                    className="hud-input"
                  >
                    <option value="FIXED">Fixed price</option>
                    <option value="QUOTE_BASED">Custom quote</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Days to Finish
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={deliveryTurnaroundDays}
                    onChange={(e) => setDeliveryTurnaroundDays(e.target.value)}
                    className="hud-input font-tech"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Free Edits
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={maxRevisions}
                    onChange={(e) => setMaxRevisions(e.target.value)}
                    className="hud-input font-tech"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Keep Service Open For
                  </label>
                  <select
                    value={validityType}
                    onChange={(e) =>
                      setValidityType(
                        e.target.value as "STANDARD_30D" | "SHORT_14D"
                      )
                    }
                    className="hud-input"
                  >
                    <option value="STANDARD_30D">30 Days (Standard)</option>
                    <option value="SHORT_14D">14 Days (Short)</option>
                  </select>
                </div>
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-white/[0.12] bg-white/[0.045] text-xs text-slate-200 cursor-pointer mt-4 sm:mt-0">
                  <input
                    type="checkbox"
                    checked={manualAcceptanceRequired}
                    onChange={(e) =>
                      setManualAcceptanceRequired(e.target.checked)
                    }
                    className="accent-teal-400"
                  />
                  <span>Let me approve orders before starting</span>
                </label>
              </div>

              {/* What Client Gets */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">
                  What Client Gets
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDeliverable}
                    onChange={(e) => setNewDeliverable(e.target.value)}
                    placeholder="Add something included..."
                    className="hud-input flex-1"
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
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.045] border border-white/[0.11] text-xs text-slate-200"
                    >
                      <span>{d}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setDeliverables((p) => p.filter((_, idx) => idx !== i))
                        }
                        className="text-slate-400 hover:text-rose-300 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Free Edits Rule
                  </label>
                  <textarea
                    rows={3}
                    value={revisionPolicy}
                    onChange={(e) => setRevisionPolicy(e.target.value)}
                    className="hud-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Cancellations &amp; Refunds
                  </label>
                  <textarea
                    rows={3}
                    value={cancellationPolicy}
                    onChange={(e) => setCancellationPolicy(e.target.value)}
                    className="hud-input text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => saveListing("DRAFT")}
                  className="btn-ghost px-4 py-2.5 text-sm gap-1.5"
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
                  className="btn-creator px-5 py-2.5 text-sm gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {saving
                    ? "Saving..."
                    : isAdmin
                      ? "Publish Now"
                      : "Submit for Review"}
                </button>
              </div>
            </div>
          </HudCard>

          {/* Preview Card */}
          <aside className="sticky top-24">
            <HudCard theme={previewTheme} brackets className="overflow-hidden">
              <CategoryCoverArt
                slug={catSlug}
                name={catName}
                heightClass="h-24"
              />
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between text-[11px] font-tech uppercase text-slate-400">
                  <HudBadge label="CARD PREVIEW" />
                  <span className="text-teal-300 font-semibold">
                    {deliveryTurnaroundDays || 3}-day delivery
                  </span>
                </div>
                <h3 className="font-editorial text-lg font-semibold text-white leading-snug">
                  {title || "Your Service Title"}
                </h3>
                <p className="text-xs text-slate-300 line-clamp-3">
                  {shortDescription ||
                    "Your short summary helps clients see what you offer right away."}
                </p>

                <HudPriceDock
                  label="YOUR PRICE"
                  price={fmtKes(numericPrice, "KES")}
                  sublabel={`Pro saves +${fmtKes(Math.round(numericPrice * 0.05), "KES")}`}
                  theme={previewTheme}
                  size="sm"
                  className="w-full"
                />
              </div>
            </HudCard>
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
          <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
            Loading editor...
          </div>
        </main>
      }
    >
      <ListingEditorInner />
    </Suspense>
  );
}

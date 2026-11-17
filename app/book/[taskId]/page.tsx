"use client";

import {
  CategoryCoverArt,
  CreatorAvatar,
} from "@/components/ui/EditorialVisuals";

import React, { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  Lock,
  ShieldCheck,
  Smartphone,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import {
  ListingValidityTag,
  ProBadge,
  VettedCreatorBadge,
  formatKes,
} from "@/components/ui/Badges";
import {
  MAX_BROWSER_UPLOAD_LABEL,
  validateClientBookingFile,
} from "@/lib/upload-constants";

interface RequirementField {
  key?: string;
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

interface TaskDetail {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  serviceType: string;
  pricingType: string;
  basePrice: number;
  currency: string;
  deliveryTurnaroundDays: number;
  maxRevisions: number;
  manualAcceptanceRequired: boolean;
  validUntil: string | null;
  validityType: string;
  deliverablesSummary: string[];
  requirementsConfig: RequirementField[];
  revisionPolicy: string;
  cancellationPolicy: string;
  category: { id: string; name: string; slug: string };
  creator: {
    id: string;
    userId: string;
    username: string;
    displayName: string;
    headline: string;
    ratingAverage: number;
    user?: { avatarUrl: string | null } | null;
  };
}

interface PricingTier {
  listedPrice: number;
  effectiveFeePct: number;
  serviceFee: number;
  proDiscount: number;
  totalPayable: number;
}

const DEFAULT_FIELDS: RequirementField[] = [
  {
    key: "topic",
    label: "Topic / Working Title",
    type: "text",
    required: true,
    placeholder: "e.g. Digital Payment Adoption Among Kenyan SMEs",
  },
  {
    key: "level",
    label: "Academic or Professional Level",
    type: "select",
    required: true,
    options: [
      "Undergraduate",
      "Postgraduate / Masters",
      "Executive / Business",
      "Technical / Publication",
    ],
  },
  {
    key: "wordCount",
    label: "Target Word Count / Scope",
    type: "number",
    required: true,
    placeholder: "e.g. 2000",
  },
  {
    key: "referencingStyle",
    label: "Referencing / Formatting Standard",
    type: "select",
    required: false,
    options: ["APA 7th Edition", "MLA", "Harvard", "Chicago", "Corporate / None"],
  },
  {
    key: "instructions",
    label: "Detailed Instructions & Specific Sources",
    type: "textarea",
    required: true,
    placeholder:
      "Describe the exact goals, rubric criteria, tone, and required structure.",
  },
];

const VALID_ADDON_IDS = new Set([
  "originality_report",
  "executive_summary",
  "nda_sealed",
  "elite_writer",
  "priority_rush",
]);

function readInitialBookingQuery(): {
  mode: "FULL_ESCROW" | "MILESTONE_SPLIT" | "TRIPWIRE_OUTLINE";
  addons: string[];
} {
  if (typeof window === "undefined") {
    return { mode: "FULL_ESCROW", addons: ["originality_report"] };
  }
  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get("mode");
  const mode =
    modeParam === "FULL_ESCROW" ||
    modeParam === "MILESTONE_SPLIT" ||
    modeParam === "TRIPWIRE_OUTLINE"
      ? modeParam
      : "FULL_ESCROW";

  const addons = params.has("addons")
    ? (params.get("addons") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => VALID_ADDON_IDS.has(id))
    : ["originality_report"];

  return { mode, addons };
}

export default function BookTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [freePricing, setFreePricing] = useState<PricingTier | null>(null);
  const [proPricing, setProPricing] = useState<PricingTier | null>(null);
  const [userIsPro, setUserIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [requestedDeadline, setRequestedDeadline] = useState("");
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>(
    () => readInitialBookingQuery().addons
  );
  const [checkoutMode, setCheckoutMode] = useState<
    "FULL_ESCROW" | "MILESTONE_SPLIT" | "TRIPWIRE_OUTLINE"
  >(() => readInitialBookingQuery().mode);
  const rushSelected = selectedAddOns.includes("priority_rush");
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [briefFile, setBriefFile] = useState<File | null>(null);
  const briefInputRef = useRef<HTMLInputElement | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<{
    bookingRef: string;
    totalPayable: number;
    currency: string;
    deliveryDeadline: string;
  } | null>(null);

  const [channel, setChannel] = useState<"MPESA_STK" | "CARD">("MPESA_STK");
  const [phoneOverride, setPhoneOverride] = useState<string | null>(null);
  const phone = phoneOverride ?? user?.phone ?? "";
  const setPhone = (v: string) => setPhoneOverride(v);
  const [checkoutInfo, setCheckoutInfo] = useState<{
    mode?: string;
    checkoutUrl?: string | null;
    transaction?: { apiRef: string; amount: number; status: string };
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            json?.error?.message || `Could not load service (${res.status}).`
          );
        }
        if (!json?.data) {
          throw new Error("Invalid service payload.");
        }
        return json.data;
      })
      .then((d) => {
        if (!active) return;
        setTask(d.task);
        setFreePricing(d.pricing.free);
        setProPricing(d.pricing.pro);
        setUserIsPro(Boolean(d.pricing.userIsPro));
        setError(null);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Load failed.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [taskId]);

  const requirementFields: RequirementField[] =
    task?.requirementsConfig && task.requirementsConfig.length > 0
      ? task.requirementsConfig
      : DEFAULT_FIELDS;

  const activeTier = userIsPro ? proPricing : freePricing;

  const CLIENT_CHECKOUT_ADDONS_UI = [
    {
      id: "originality_report",
      label: "Originality & AI-Free Authenticity Report",
      description:
        "Official similarity & human-authorship verification PDF bundled with final delivery.",
      pricingKind: "FLAT" as const,
      value: 450,
      badge: "Most Selected",
    },
    {
      id: "executive_summary",
      label: "1-Page Executive Summary & Key Takeaways",
      description:
        "Distilled board-ready brief highlighting core arguments, data points, and citations.",
      pricingKind: "FLAT" as const,
      value: 850,
    },
    {
      id: "nda_sealed",
      label: "Strict NDA & Sealed Confidential Workspace",
      description:
        "Locks non-disclosure terms and keeps project files & briefs excluded from samples.",
      pricingKind: "FLAT" as const,
      value: 600,
    },
    {
      id: "elite_writer",
      label: "Top 5% Elite Writer Guarantee",
      description:
        "Routes priority quality review and assigns top-decile rubric & rating specialists.",
      pricingKind: "PERCENTAGE" as const,
      value: 15,
      badge: "Top Rated",
    },
    {
      id: "priority_rush",
      label: "Priority Express Rush Turnaround",
      description:
        "Halves standard delivery turnaround window with urgent milestone SLA alerts.",
      pricingKind: "PERCENTAGE" as const,
      value: 20,
      badge: "Fastest",
    },
  ];

  const itemizedAddOns = task
    ? selectedAddOns
        .map((id) => {
          const cfg = CLIENT_CHECKOUT_ADDONS_UI.find((item) => item.id === id);
          if (!cfg) return null;
          const amount =
            cfg.pricingKind === "FLAT"
              ? cfg.value
              : Math.round(task.basePrice * (cfg.value / 100) * 100) / 100;
          return { id: cfg.id, label: cfg.label, amount };
        })
        .filter((x): x is { id: string; label: string; amount: number } =>
          Boolean(x)
        )
    : [];

  const addOnsTotal =
    Math.round(
      itemizedAddOns.reduce((sum, item) => sum + item.amount, 0) * 100
    ) / 100;
  const fullOrderTotal =
    Math.round(((activeTier?.totalPayable ?? 0) + addOnsTotal) * 100) / 100;
  const proFullOrderTotal =
    Math.round(((proPricing?.totalPayable ?? 0) + addOnsTotal) * 100) / 100;

  const computedTotal =
    checkoutMode === "TRIPWIRE_OUTLINE"
      ? 490
      : checkoutMode === "MILESTONE_SPLIT"
        ? Math.round(fullOrderTotal * 0.25 * 100) / 100
        : fullOrderTotal;
  const remainingBalance =
    checkoutMode === "FULL_ESCROW"
      ? 0
      : Math.max(
          0,
          Math.round((fullOrderTotal - computedTotal) * 100) / 100
        );

  async function handleCreateBooking() {
    if (!task) return;
    if (briefFile) {
      const fileError = validateClientBookingFile(briefFile);
      if (fileError) {
        setError(fileError);
        return;
      }
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          requirementsResponses: responses,
          requestedDeadline: requestedDeadline
            ? new Date(requestedDeadline).toISOString()
            : undefined,
          rushExtraCharge: 0,
          selectedAddOns,
          checkoutMode,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.error?.message || `Booking creation failed (${res.status}).`
        );
      }

      const booking = json?.data?.booking;
      if (!booking?.bookingRef) {
        throw new Error("Server returned an invalid booking response.");
      }
      if (briefFile) {
        const fd = new FormData();
        fd.append("file", briefFile);
        fd.append("fileCategory", "CUSTOMER_BRIEF");
        const uploadRes = await fetch(
          `/api/bookings/${encodeURIComponent(booking.bookingRef)}/files/presign`,
          {
            method: "POST",
            body: fd,
          }
        );
        if (!uploadRes.ok) {
          const uploadJson = await uploadRes.json().catch(() => null);
          setCreatedBooking(booking);
          setStep(3);
          setError(
            `Booking ${booking.bookingRef} created, but brief file upload failed: ${
              uploadJson?.error?.message || "Upload failed"
            }. You can re-upload it inside the Booking Workspace.`
          );
          return;
        }
      }

      setCreatedBooking(booking);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create booking.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInitiatePayment() {
    if (!createdBooking) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/bookings/${createdBooking.bookingRef}/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel,
            phone: channel === "MPESA_STK" ? phone : undefined,
          }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.error?.message || `Payment initiation failed (${res.status}).`
        );
      }
      setCheckoutInfo(json?.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSimulateSandboxWebhook(state: "COMPLETE" | "FAILED") {
    if (!checkoutInfo?.transaction?.apiRef || !createdBooking) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/simulate-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiRef: checkoutInfo.transaction.apiRef,
          state,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.error?.message || `Webhook simulation failed (${res.status}).`
        );
      }
      if (state === "COMPLETE") {
        router.push(`/dashboard/bookings/${createdBooking.bookingRef}`);
      } else {
        setError("Simulated payment FAILED. You may retry payment below.");
        setCheckoutInfo(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || authLoading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading service details and transparent fee ledger...
        </div>
      </main>
    );
  }

  if (!task) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold">
            Service Unavailable
          </h1>
          <p className="text-sm text-stone-600">{error || "Listing not found."}</p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-sm font-medium"
          >
            Back to Explore
          </Link>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 space-y-5">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <Lock className="w-4 h-4 text-[#1e3a8a]" />
            <span>AUTHENTICATION REQUIRED TO BOOK</span>
          </div>
          <h1 className="text-2xl font-editorial font-semibold">
            Sign in to book “{task.title}”
          </h1>
          <p className="text-sm text-stone-600">
            After signing in or registering (Free or Pro — both can book
            services), you will be returned straight to this booking wizard.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/auth?next=${encodeURIComponent(`/book/${task.slug}`)}`}
              className="px-5 py-2.5 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold hover:bg-[#172554]"
            >
              Continue to Sign In / Quick Join
            </Link>
            <Link
              href={`/tasks/${task.slug}`}
              className="px-5 py-2.5 rounded-lg border border-[#e6e0d4] bg-white text-sm font-medium text-stone-700"
            >
              Back to Service Brief
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const categorySlugGuess = task.category.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-reveal">
      <div className="editorial-card p-4 sm:px-6 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href={`/tasks/${task.slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-[#111827]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to service brief
        </Link>
        <div className="flex items-center gap-2 text-xs font-semibold flex-wrap">
          {[1, 2, 3].map((num) => (
            <span
              key={num}
              className={`px-3 py-1 rounded-full border transition-all ${
                step === num
                  ? "bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-xs"
                  : step > num
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-[#faf7f2] text-stone-500 border-[#e6e0d4]"
              }`}
            >
              {num}.{" "}
              {num === 1
                ? "Requirements"
                : num === 2
                  ? "Review & Policy"
                  : "IntaSend Escrow"}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Requirements */}
          {step === 1 && (
            <div className="editorial-card p-6 sm:p-8 bg-white space-y-6">
              <div>
                <h1 className="text-2xl font-editorial font-semibold">
                  Step 1 · Assignment Requirements
                </h1>
                <p className="text-xs text-stone-600 mt-1">
                  Brief {task.creator.displayName} accurately upfront.
                </p>
              </div>

              <div className="space-y-4">
                {requirementFields.map((field, idx) => {
                  const key =
                    field.key || field.name || `field_${idx}`;
                  const label = field.label || key;
                  const val = responses[key] ?? "";

                  return (
                    <div key={key} className="space-y-1.5">
                      <label className="block text-sm font-medium text-[#111827]">
                        {label}
                        {field.required && (
                          <span className="text-rose-600 ml-1">*</span>
                        )}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          rows={4}
                          value={val}
                          onChange={(e) =>
                            setResponses((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          placeholder={field.placeholder || ""}
                          className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/25"
                        />
                      ) : field.type === "select" && field.options ? (
                        <select
                          value={val}
                          onChange={(e) =>
                            setResponses((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/25"
                        >
                          <option value="">Select an option...</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : "text"}
                          value={val}
                          onChange={(e) =>
                            setResponses((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          placeholder={field.placeholder || ""}
                          className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/25"
                        />
                      )}
                    </div>
                  );
                })}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-[#111827] mb-1">
                      Preferred Delivery Date
                    </label>
                    <input
                      type="date"
                      value={requestedDeadline}
                      onChange={(e) => setRequestedDeadline(e.target.value)}
                      className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
                    />
                    <p className="text-[11px] text-stone-500 mt-1">
                      Standard: {task.deliveryTurnaroundDays} days.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#111827] mb-1">
                      Brief File (Optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 min-w-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-stone-300 bg-[#faf7f2] text-xs text-stone-700 cursor-pointer hover:bg-stone-100">
                        <Upload className="w-4 h-4 text-[#1e3a8a] shrink-0" />
                        <span className="truncate">
                          {briefFile
                            ? briefFile.name
                            : "Attach rubric, outline, or PDF"}
                        </span>
                        <input
                          ref={briefInputRef}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const selected = e.target.files?.[0] ?? null;
                            if (!selected) {
                              setBriefFile(null);
                              return;
                            }
                            const fileErr = validateClientBookingFile(selected);
                            if (fileErr) {
                              setError(fileErr);
                              setBriefFile(null);
                              e.target.value = "";
                              if (briefInputRef.current) {
                                briefInputRef.current.value = "";
                              }
                              return;
                            }
                            setError(null);
                            setBriefFile(selected);
                          }}
                        />
                      </label>
                      {briefFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setBriefFile(null);
                            if (briefInputRef.current) {
                              briefInputRef.current.value = "";
                            }
                          }}
                          aria-label="Remove selected brief file"
                          className="p-2 rounded-xl border border-[#e6e0d4] bg-white text-stone-500 hover:text-rose-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 mt-1">
                      Max {MAX_BROWSER_UPLOAD_LABEL} · PDF, DOCX, TXT, MD, CSV, ZIP, or images.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#1e3a8a]">
                      Optional Value Add-Ons
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Bundle verified quality guarantees &amp; turnaround accelerators into your escrow order.
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    {CLIENT_CHECKOUT_ADDONS_UI.map((addon) => {
                      const checked = selectedAddOns.includes(addon.id);
                      const addonCost =
                        addon.pricingKind === "FLAT"
                          ? addon.value
                          : Math.round(
                              task.basePrice * (addon.value / 100) * 100
                            ) / 100;
                      return (
                        <label
                          key={addon.id}
                          className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                            checked
                              ? "border-[#1e3a8a] bg-blue-50/40"
                              : "border-[#e6e0d4] bg-[#faf7f2] hover:bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedAddOns((prev) =>
                                e.target.checked
                                  ? [...prev, addon.id]
                                  : prev.filter((x) => x !== addon.id)
                              );
                            }}
                            className="mt-1"
                          />
                          <div className="flex-1 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-[#111827] flex items-center gap-1.5">
                                {addon.label}
                                {addon.badge && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900">
                                    {addon.badge}
                                  </span>
                                )}
                              </span>
                              <span className="font-tech font-semibold text-[#1e3a8a]">
                                +{formatKes(addonCost, task.currency)}
                              </span>
                            </div>
                            <p className="text-stone-600 mt-0.5">
                              {addon.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#0f766e]">
                      Escrow Commitment Plan
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Start with a low-risk KES 490 outline or lock 25% deposit — balance settles only after milestone review.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {[
                      {
                        mode: "FULL_ESCROW" as const,
                        title: "Full Escrow",
                        tag: "100% Today",
                        amount: fullOrderTotal,
                        desc: "Full escrow funding upfront with zero split balance remaining.",
                      },
                      {
                        mode: "MILESTONE_SPLIT" as const,
                        title: "25% Deposit Lock",
                        tag: "Flexible",
                        amount: Math.round(fullOrderTotal * 0.25 * 100) / 100,
                        desc: "Reserve creator slot with 25% today; 75% unlocked at draft delivery.",
                      },
                      {
                        mode: "TRIPWIRE_OUTLINE" as const,
                        title: "First-Page Outline",
                        tag: "KES 490 Start",
                        amount: 490,
                        desc: "Audit quality first with an outline + opening page before funding full project.",
                      },
                    ].map((plan) => {
                      const active = checkoutMode === plan.mode;
                      return (
                        <button
                          key={plan.mode}
                          type="button"
                          onClick={() => setCheckoutMode(plan.mode)}
                          className={`text-left p-3.5 rounded-xl border transition-colors ${
                            active
                              ? "border-[#0f766e] bg-teal-50/60"
                              : "border-[#e6e0d4] bg-[#faf7f2] hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-[11px] font-semibold">
                            <span className="text-[#111827]">{plan.title}</span>
                            <span className="px-2 py-0.5 rounded-full bg-white border border-[#e6e0d4] text-[#0f766e]">
                              {plan.tag}
                            </span>
                          </div>
                          <p className="font-tech text-base font-bold text-[#1e3a8a] mt-1">
                            {formatKes(plan.amount, task.currency)}
                          </p>
                          <p className="text-[11px] text-stone-600 mt-1 leading-snug">
                            {plan.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    const missing = requirementFields.find(
                      (f, i) =>
                        f.required &&
                        !String(
                          responses[f.key || f.name || `field_${i}`] || ""
                        ).trim()
                    );
                    if (missing) {
                      setError(
                        `Please fill in required field: ${missing.label || missing.key}`
                      );
                      return;
                    }
                    setError(null);
                    setStep(2);
                  }}
                  className="btn-primary px-6 py-2.5 text-sm gap-2"
                >
                  Review Scope &amp; Policy
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Transparent Confirmation */}
          {step === 2 && (
            <div className="editorial-card p-6 sm:p-8 bg-white space-y-6">
              <div>
                <h1 className="text-2xl font-editorial font-semibold">
                  Step 2 · Confirm Deadlines &amp; Escrow Policy
                </h1>
                <p className="text-xs text-stone-600 mt-1">
                  Verify locked terms before generating your booking reference.
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-xs text-blue-950 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#1e3a8a]" />
                  Independent Delivery Deadline Guarantee
                </p>
                <p>
                  Target Delivery:{" "}
                  <strong>
                    {requestedDeadline
                      ? requestedDeadline
                      : `${rushSelected ? Math.max(1, Math.ceil(task.deliveryTurnaroundDays / 2)) : task.deliveryTurnaroundDays} days from payment`}
                  </strong>
                  . Protected even if the public listing expires later.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="p-4 rounded-xl bg-[#faf7f2] border border-[#e6e0d4]">
                  <p className="font-semibold text-[#111827]">Revision Policy</p>
                  <p className="text-xs text-stone-600 mt-1">
                    {task.revisionPolicy} ({task.maxRevisions} rounds included)
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#faf7f2] border border-[#e6e0d4]">
                  <p className="font-semibold text-[#111827]">
                    Cancellation Policy
                  </p>
                  <p className="text-xs text-stone-600 mt-1">
                    {task.cancellationPolicy}
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-3 text-xs text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedPolicies}
                  onChange={(e) => setAcceptedPolicies(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I confirm deliverables, turnaround, total payable (
                  <strong>{formatKes(computedTotal, task.currency)}</strong>), and
                  escrow terms.
                </span>
              </label>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="btn-ghost px-4 py-2 text-sm"
                >
                  Edit Requirements
                </button>
                <button
                  disabled={!acceptedPolicies || submitting}
                  onClick={handleCreateBooking}
                  className="btn-primary px-6 py-2.5 text-sm gap-2 disabled:opacity-50"
                >
                  {submitting
                    ? "Locking Booking..."
                    : "Confirm & Proceed to Escrow"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: IntaSend Escrow Checkout */}
          {step === 3 && createdBooking && (
            <div className="editorial-card p-6 sm:p-8 bg-white space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-tech text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                    Ref: {createdBooking.bookingRef}
                  </span>
                  <h1 className="text-2xl font-editorial font-semibold mt-2">
                    Step 3 · Fund IntaSend Escrow
                  </h1>
                </div>
                <p className="font-tech text-2xl font-bold text-[#1e3a8a]">
                  {formatKes(
                    createdBooking.totalPayable,
                    createdBooking.currency
                  )}
                </p>
              </div>

              {!checkoutInfo ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setChannel("MPESA_STK")}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        channel === "MPESA_STK"
                          ? "border-[#1e3a8a] bg-blue-50/50 ring-2 ring-[#1e3a8a]/20"
                          : "border-[#e6e0d4] bg-[#faf7f2] hover:bg-white"
                      }`}
                    >
                      <Smartphone className="w-5 h-5 text-emerald-700 mb-2" />
                      <p className="font-semibold text-sm">M-Pesa STK Push</p>
                      <p className="text-xs text-stone-600 mt-0.5">
                        Instant KES prompt on Safaricom.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChannel("CARD")}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        channel === "CARD"
                          ? "border-[#1e3a8a] bg-blue-50/50 ring-2 ring-[#1e3a8a]/20"
                          : "border-[#e6e0d4] bg-[#faf7f2] hover:bg-white"
                      }`}
                    >
                      <CreditCard className="w-5 h-5 text-[#1e3a8a] mb-2" />
                      <p className="font-semibold text-sm">
                        Visa / Mastercard
                      </p>
                      <p className="text-xs text-stone-600 mt-0.5">
                        Hosted 3DS card checkout.
                      </p>
                    </button>
                  </div>

                  {channel === "MPESA_STK" && (
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        M-Pesa Phone Number
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+254712345678"
                        className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2.5 text-sm font-tech"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <Link
                      href={`/dashboard/bookings/${createdBooking.bookingRef}`}
                      className="text-xs text-stone-600 hover:underline"
                    >
                      Pay later from workspace
                    </Link>
                    <button
                      disabled={submitting}
                      onClick={handleInitiatePayment}
                      className="btn-primary px-6 py-2.5 text-sm gap-2 disabled:opacity-50"
                    >
                      {submitting
                        ? "Connecting to IntaSend..."
                        : channel === "MPESA_STK"
                          ? "Send M-Pesa STK Push"
                          : "Open Card Checkout"}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-amber-950">
                        Payment Request Initiated ({checkoutInfo.mode || "SANDBOX"})
                      </p>
                      <p className="text-xs text-amber-900 mt-1">
                        Ref:{" "}
                        <code className="font-tech bg-white px-1.5 py-0.5 rounded border border-amber-200">
                          {checkoutInfo.transaction?.apiRef}
                        </code>
                      </p>
                    </div>
                  </div>

                  {checkoutInfo.checkoutUrl && (
                    <a
                      href={checkoutInfo.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-amber-300 text-xs font-semibold text-amber-950"
                    >
                      Open Hosted Checkout
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  )}

                  <div className="pt-3 border-t border-amber-200 space-y-2.5">
                    <p className="text-xs font-semibold text-stone-800">
                      IntaSend Sandbox Simulation Controls
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        disabled={submitting}
                        onClick={() => handleSimulateSandboxWebhook("COMPLETE")}
                        className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50"
                      >
                        Simulate Successful Payment
                      </button>
                      <button
                        disabled={submitting}
                        onClick={() => handleSimulateSandboxWebhook("FAILED")}
                        className="px-4 py-2 rounded-xl border border-rose-300 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50 disabled:opacity-50"
                      >
                        Simulate Failed Payment
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Visual Order Ledger */}
        <aside className="space-y-4">
          <div className="editorial-card overflow-hidden bg-white sticky top-24">
            <CategoryCoverArt
              slug={categorySlugGuess}
              name={task.category.name}
              heightClass="h-24"
            />
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CreatorAvatar
                    name={task.creator.displayName}
                    username={task.creator.username}
                    avatarUrl={task.creator.user?.avatarUrl}
                    size="sm"
                  />
                  <span className="text-xs font-semibold text-[#111827]">
                    {task.creator.displayName}
                  </span>
                </div>
                {userIsPro && <ProBadge label="Pro 50% Off" />}
              </div>

              <h2 className="font-editorial text-lg font-semibold leading-snug">
                {task.title}
              </h2>

              <div className="flex items-center gap-2 flex-wrap">
                <VettedCreatorBadge />
                <ListingValidityTag
                  validUntil={task.validUntil}
                  validityType={task.validityType}
                />
              </div>

              <div className="border-t border-b border-[#e6e0d4] py-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-600">Service Price</span>
                  <span className="font-tech font-medium">
                    {formatKes(task.basePrice, task.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">
                    Fee ({activeTier?.effectiveFeePct ?? 10}%)
                  </span>
                  <span className="font-tech font-medium">
                    {formatKes(activeTier?.serviceFee ?? 0, task.currency)}
                  </span>
                </div>
                {activeTier && activeTier.proDiscount > 0 && (
                  <div className="flex justify-between text-amber-800 text-xs">
                    <span>Pro Savings</span>
                    <span className="font-tech">
                      -{formatKes(activeTier.proDiscount, task.currency)}
                    </span>
                  </div>
                )}
                {itemizedAddOns.map((addon) => (
                  <div
                    key={addon.id}
                    className="flex justify-between gap-2 text-xs text-blue-900"
                  >
                    <span className="line-clamp-1">{addon.label}</span>
                    <span className="font-tech shrink-0">
                      +{formatKes(addon.amount, task.currency)}
                    </span>
                  </div>
                ))}
                {checkoutMode !== "FULL_ESCROW" && (
                  <>
                    <div className="flex justify-between text-xs text-stone-500 pt-1 border-t border-dashed border-[#e6e0d4]">
                      <span>Full Order Value</span>
                      <span className="font-tech">
                        {formatKes(fullOrderTotal, task.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-[#0f766e]">
                      <span>Remaining After Milestone</span>
                      <span className="font-tech font-medium">
                        {formatKes(remainingBalance, task.currency)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#111827]">
                  {checkoutMode === "FULL_ESCROW"
                    ? "Total Payable"
                    : checkoutMode === "MILESTONE_SPLIT"
                      ? "25% Deposit Due Now"
                      : "Outline Trial Due Now"}
                </span>
                <span className="font-tech text-2xl font-bold text-[#1e3a8a]">
                  {formatKes(computedTotal, task.currency)}
                </span>
              </div>

              {!userIsPro && freePricing && proPricing && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <Crown className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                  <span>
                    Pro pays{" "}
                    <strong className="font-tech">
                      {formatKes(proFullOrderTotal, task.currency)}
                    </strong>{" "}
                    full order.{" "}
                    <Link href="/membership" className="underline font-semibold">
                      Compare Pro
                    </Link>
                  </span>
                </div>
              )}

              <div className="text-xs text-stone-600 space-y-1.5 pt-2">
                <p className="font-semibold text-[#111827] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#0f766e]" />
                  Deliverables
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  {task.deliverablesSummary.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

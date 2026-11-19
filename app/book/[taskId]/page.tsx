"use client";

import { CategoryCoverArt } from "@/components/ui/EditorialVisuals";
import {
  AuroraHeading,
  HudCard,
  HudPriceDock,
  RadarAvatar,
} from "@/components/ui/AuroraPrimitives";

import React, { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
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
import { FlowSteps } from "@/components/ui/FlowGuide";
import { CLIENT_CHECKOUT_ADDONS, calculateAddOnsTotal } from "@/lib/pricing";
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
    label: "What is your topic or title?",
    type: "text",
    required: true,
    placeholder: "e.g. Mobile Money Growth in Kenya",
  },
  {
    key: "level",
    label: "Type of writing",
    type: "select",
    required: true,
    options: [
      "College / Undergraduate",
      "Master's / Research",
      "Business / Work",
      "Blog / Website Article",
    ],
  },
  {
    key: "wordCount",
    label: "How many words or pages?",
    type: "number",
    required: true,
    placeholder: "e.g. 2000",
  },
  {
    key: "referencingStyle",
    label: "Formatting or citation style (optional)",
    type: "select",
    required: false,
    options: ["APA 7", "MLA", "Harvard", "Chicago", "No special style"],
  },
  {
    key: "instructions",
    label: "Tell the writer what you need",
    type: "textarea",
    required: true,
    placeholder:
      "Share your main points, sections to include, tone, and any sources or notes.",
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
  const [showExtras, setShowExtras] = useState(false);
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

  const { itemized: itemizedAddOns, addOnsTotal } = task
    ? calculateAddOnsTotal(task.basePrice, selectedAddOns)
    : { itemized: [], addOnsTotal: 0 };
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
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading service details and prices...
        </div>
      </main>
    );
  }

  if (!task) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Service Not Found
          </h1>
          <p className="text-sm text-slate-300">{error || "We could not find that writing service."}</p>
          <Link href="/explore" className="btn-primary px-5 py-2.5 text-sm">
            Find Another Writer
          </Link>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 space-y-5">
          <div className="flex items-center gap-2 text-xs text-sky-300 font-tech">
            <Lock className="w-4 h-4" />
            <span>SIGN IN NEEDED</span>
          </div>
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Sign in to order &ldquo;{task.title}&rdquo;
          </h1>
          <p className="text-sm text-slate-300">
            Sign in or create a free account, and we&apos;ll bring you right back
            here to finish your order.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/auth?next=${encodeURIComponent(`/book/${task.slug}`)}`}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              Sign In / Create Account
            </Link>
            <Link href={`/tasks/${task.slug}`} className="btn-ghost px-5 py-2.5 text-sm">
              Back to Service
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          href={`/tasks/${task.slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-cyan-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to service
        </Link>
      </div>

      <FlowSteps
        currentStep={step}
        goalLabel="Goal: Safe order placed & writer starts right away"
        steps={[
          { label: "1. Your Instructions", hint: "Topic, length & extras" },
          { label: "2. Check Details", hint: "Confirm dates & rules" },
          { label: "3. Pay Safely", hint: "M-Pesa or Card" },
        ]}
      />

      {error && (
        <div className="p-4 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-300" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Instructions */}
          {step === 1 && (
            <div className="editorial-card p-6 sm:p-8 space-y-6">
              <div>
                <AuroraHeading as="h1" className="text-2xl">
                  Step 1 · Share What You Need
                </AuroraHeading>
                <p className="text-xs text-slate-300 mt-1">
                  Tell {task.creator.displayName} about your project so they can get it right the first time.
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
                      <label className="block text-sm font-medium text-slate-200">
                        {label}
                        {field.required && (
                          <span className="text-rose-400 ml-1">*</span>
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
                          className="hud-input w-full px-3.5 py-2.5 text-sm"
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
                          className="hud-input w-full px-3.5 py-2.5 text-sm"
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
                          className="hud-input w-full px-3.5 py-2.5 text-sm"
                        />
                      )}
                    </div>
                  );
                })}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">
                      When do you need it?
                    </label>
                    <input
                      type="date"
                      value={requestedDeadline}
                      onChange={(e) => setRequestedDeadline(e.target.value)}
                      className="hud-input w-full px-3.5 py-2 text-sm"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Normal delivery: {task.deliveryTurnaroundDays} days.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">
                      Attach a file (optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 min-w-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-white/25 bg-white/[0.04] text-xs text-slate-200 cursor-pointer hover:bg-white/[0.08]">
                        <Upload className="w-4 h-4 text-cyan-300 shrink-0" />
                        <span className="truncate">
                          {briefFile
                            ? briefFile.name
                            : "Attach notes, outline, or PDF"}
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
                          aria-label="Remove attached file"
                          className="p-2 rounded-xl border border-white/[0.14] bg-white/[0.06] text-slate-300 hover:text-rose-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Max {MAX_BROWSER_UPLOAD_LABEL} · PDF, Word, text, spreadsheets, ZIP, or photos.
                    </p>
                  </div>
                </div>

                {/* Collapsible Optional Extras */}
                <div className="rounded-xl border border-white/[0.12] bg-white/[0.04] p-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowExtras((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-2 text-left"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">
                        Optional Extras{" "}
                        {selectedAddOns.length > 0 && (
                          <span className="text-slate-300 normal-case font-tech">
                            ({selectedAddOns.length} selected · +{formatKes(addOnsTotal, task.currency)})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Add faster delivery, extra privacy, or a no-AI check if you need them.
                      </p>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-300 shrink-0 transition-transform ${
                        showExtras ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {showExtras && (
                    <div className="space-y-2.5 pt-2 border-t border-white/[0.1]">
                      {CLIENT_CHECKOUT_ADDONS.map((addon) => {
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
                                ? "border-sky-400/50 bg-sky-500/[0.12]"
                                : "border-white/[0.11] bg-white/[0.03] hover:bg-white/[0.06]"
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
                              className="mt-1 accent-cyan-400"
                            />
                            <div className="flex-1 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-white flex items-center gap-1.5">
                                  {addon.label}
                                  {addon.badge && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/35">
                                      {addon.badge}
                                    </span>
                                  )}
                                </span>
                                <span className="font-tech font-semibold text-cyan-300">
                                  +{formatKes(addonCost, task.currency)}
                                </span>
                              </div>
                              <p className="text-slate-300 mt-0.5">
                                {addon.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-teal-300">
                      How would you like to pay?
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Pick full payment, 25% deposit now, or try Page 1 first for KES 490.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {[
                      {
                        mode: "FULL_ESCROW" as const,
                        title: "Pay Full Amount",
                        tag: "100% Today",
                        amount: fullOrderTotal,
                        desc: "Pay the full price now. We hold it safely until you approve finished work.",
                      },
                      {
                        mode: "MILESTONE_SPLIT" as const,
                        title: "Pay 25% Deposit Now",
                        tag: "Flexible",
                        amount: Math.round(fullOrderTotal * 0.25 * 100) / 100,
                        desc: "Pay 25% to book your writer. Pay the rest once the first draft arrives.",
                      },
                      {
                        mode: "TRIPWIRE_OUTLINE" as const,
                        title: "Try Page 1 First",
                        tag: "KES 490 Start",
                        amount: 490,
                        desc: "Get the outline and Page 1 first for KES 490 before paying for the whole project.",
                      },
                    ].map((plan) => {
                      const active = checkoutMode === plan.mode;
                      return (
                        <button
                          key={plan.mode}
                          type="button"
                          onClick={() => setCheckoutMode(plan.mode)}
                          className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                            active
                              ? "border-teal-400/60 bg-teal-500/[0.14] ring-1 ring-teal-400/35"
                              : "border-white/[0.11] bg-white/[0.04] hover:bg-white/[0.08]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-[11px] font-semibold">
                            <span className="text-white">{plan.title}</span>
                            <span className="px-2 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.14] text-teal-300">
                              {plan.tag}
                            </span>
                          </div>
                          <p className="font-tech text-base font-bold text-cyan-300 mt-1">
                            {formatKes(plan.amount, task.currency)}
                          </p>
                          <p className="text-[11px] text-slate-300 mt-1 leading-snug">
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
                  Next: Check Order &amp; Rules
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Check Your Order & Rules */}
          {step === 2 && (
            <div className="editorial-card p-6 sm:p-8 space-y-6">
              <div>
                <AuroraHeading as="h1" className="text-2xl">
                  Step 2 · Check Your Order &amp; Rules
                </AuroraHeading>
                <p className="text-xs text-slate-300 mt-1">
                  Make sure everything looks right before we create your order.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.045] border border-white/[0.12] space-y-2 text-xs">
                <p className="font-semibold text-white">Your Instructions</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {requirementFields.map((field, idx) => {
                    const key = field.key || field.name || `field_${idx}`;
                    const value = responses[key];
                    if (!value) return null;
                    return (
                      <div key={key}>
                        <span className="text-slate-400">{field.label || key}: </span>
                        <span className="font-medium text-white">{value}</span>
                      </div>
                    );
                  })}
                  {briefFile && (
                    <div>
                      <span className="text-slate-400">Attached file: </span>
                      <span className="font-medium text-white">{briefFile.name}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-sky-400/35 bg-sky-500/[0.1] p-4 text-xs text-sky-200 space-y-1">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-sky-300" />
                  Guaranteed Delivery Date
                </p>
                <p>
                  Due by:{" "}
                  <strong className="text-white">
                    {requestedDeadline
                      ? requestedDeadline
                      : `${rushSelected ? Math.max(1, Math.ceil(task.deliveryTurnaroundDays / 2)) : task.deliveryTurnaroundDays} days after you pay`}
                  </strong>
                  . Your order stays safe even if this listing closes later.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.11]">
                  <p className="font-semibold text-white">Free Edits Rule</p>
                  <p className="text-xs text-slate-300 mt-1">
                    {task.revisionPolicy} ({task.maxRevisions} free edits included)
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.11]">
                  <p className="font-semibold text-white">
                    Cancellations &amp; Refunds
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    {task.cancellationPolicy}
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-3 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedPolicies}
                  onChange={(e) => setAcceptedPolicies(e.target.checked)}
                  className="mt-0.5 accent-cyan-400"
                />
                <span>
                  I agree to the price (
                  <strong className="text-cyan-300">{formatKes(computedTotal, task.currency)}</strong>),
                  delivery date, and safe-payment rules.
                </span>
              </label>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="btn-ghost px-4 py-2 text-sm"
                >
                  Back to Edit
                </button>
                <button
                  disabled={!acceptedPolicies || submitting}
                  onClick={handleCreateBooking}
                  className="btn-primary px-6 py-2.5 text-sm gap-2 disabled:opacity-50"
                >
                  {submitting ? "Creating Order..." : "Confirm & Pay"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Safe Payment */}
          {step === 3 && createdBooking && (
            <div className="editorial-card p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-tech text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/35 font-semibold">
                    Order Ref: {createdBooking.bookingRef}
                  </span>
                  <AuroraHeading as="h1" className="text-2xl mt-2">
                    Step 3 · Pay Safely
                  </AuroraHeading>
                </div>
                <HudPriceDock
                  label="Pay now"
                  price={formatKes(
                    createdBooking.totalPayable,
                    createdBooking.currency
                  )}
                  theme="cyan"
                  size="md"
                />
              </div>

              {!checkoutInfo ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setChannel("MPESA_STK")}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        channel === "MPESA_STK"
                          ? "border-teal-400/60 bg-teal-500/[0.14] ring-1 ring-teal-400/35"
                          : "border-white/[0.11] bg-white/[0.04] hover:bg-white/[0.08]"
                      }`}
                    >
                      <Smartphone className="w-5 h-5 text-emerald-300 mb-2" />
                      <p className="font-semibold text-sm text-white">M-Pesa</p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Pay right from your Safaricom phone.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChannel("CARD")}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        channel === "CARD"
                          ? "border-sky-400/60 bg-sky-500/[0.14] ring-1 ring-sky-400/35"
                          : "border-white/[0.11] bg-white/[0.04] hover:bg-white/[0.08]"
                      }`}
                    >
                      <CreditCard className="w-5 h-5 text-sky-300 mb-2" />
                      <p className="font-semibold text-sm text-white">
                        Visa / Mastercard
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Pay safely with your bank card.
                      </p>
                    </button>
                  </div>

                  {channel === "MPESA_STK" && (
                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-1">
                        M-Pesa Phone Number
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+254712345678"
                        className="hud-input w-full px-3.5 py-2.5 text-sm font-tech"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <Link
                      href={`/dashboard/bookings/${createdBooking.bookingRef}`}
                      className="text-xs text-slate-400 hover:text-cyan-300 hover:underline"
                    >
                      Pay later from My Orders
                    </Link>
                    <button
                      disabled={submitting}
                      onClick={handleInitiatePayment}
                      className="btn-primary px-6 py-2.5 text-sm gap-2 disabled:opacity-50"
                    >
                      {submitting
                        ? "Starting Payment..."
                        : channel === "MPESA_STK"
                          ? "Send M-Pesa Prompt"
                          : "Pay by Card"}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-400/35 bg-amber-500/[0.1] p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-white">
                        Payment Request Sent ({checkoutInfo.mode === "LIVE" ? "Live" : "Test Mode"})
                      </p>
                      <p className="text-xs text-amber-200 mt-1">
                        Ref:{" "}
                        <code className="font-tech bg-white/[0.08] px-1.5 py-0.5 rounded border border-amber-400/35 text-amber-100">
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
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.1] border border-amber-400/40 text-xs font-semibold text-amber-200"
                    >
                      Open Payment Page
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  )}

                  <div className="pt-3 border-t border-amber-400/25 space-y-2.5">
                    <p className="text-xs font-semibold text-slate-200">
                      Test Mode (Demo only)
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        disabled={submitting}
                        onClick={() => handleSimulateSandboxWebhook("COMPLETE")}
                        className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 disabled:opacity-50"
                      >
                        Mark Payment Complete (Demo)
                      </button>
                      <button
                        disabled={submitting}
                        onClick={() => handleSimulateSandboxWebhook("FAILED")}
                        className="px-4 py-2 rounded-xl border border-rose-400/40 bg-rose-500/15 text-rose-200 text-xs font-semibold hover:bg-rose-500/25 disabled:opacity-50"
                      >
                        Simulate Failed Payment (Demo)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky HUD Order Summary */}
        <aside className="space-y-4">
          <HudCard theme="cyan" brackets className="overflow-hidden sticky top-24">
            <CategoryCoverArt
              slug={categorySlugGuess}
              name={task.category.name}
              heightClass="h-24"
            />
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <RadarAvatar
                    name={task.creator.displayName}
                    avatarUrl={task.creator.user?.avatarUrl}
                    theme="cyan"
                    size="sm"
                  />
                  <span className="text-xs font-semibold text-white">
                    {task.creator.displayName}
                  </span>
                </div>
                {userIsPro && <ProBadge label="Pro 50% Off" />}
              </div>

              <h2 className="font-editorial text-lg font-semibold leading-snug text-white">
                {task.title}
              </h2>

              <div className="flex items-center gap-2 flex-wrap">
                <VettedCreatorBadge />
                <ListingValidityTag
                  validUntil={task.validUntil}
                  validityType={task.validityType}
                />
              </div>

              <div className="border-t border-b border-white/[0.1] py-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Service Price</span>
                  <span className="font-tech font-medium text-white">
                    {formatKes(task.basePrice, task.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Service Fee ({activeTier?.effectiveFeePct ?? 10}%)
                  </span>
                  <span className="font-tech font-medium text-white">
                    {formatKes(activeTier?.serviceFee ?? 0, task.currency)}
                  </span>
                </div>
                {activeTier && activeTier.proDiscount > 0 && (
                  <div className="flex justify-between text-amber-300 text-xs">
                    <span>Pro Discount</span>
                    <span className="font-tech">
                      -{formatKes(activeTier.proDiscount, task.currency)}
                    </span>
                  </div>
                )}
                {itemizedAddOns.map((addon) => (
                  <div
                    key={addon.id}
                    className="flex justify-between gap-2 text-xs text-sky-300"
                  >
                    <span className="line-clamp-1">{addon.label}</span>
                    <span className="font-tech shrink-0">
                      +{formatKes(addon.amount, task.currency)}
                    </span>
                  </div>
                ))}
                {checkoutMode !== "FULL_ESCROW" && (
                  <>
                    <div className="flex justify-between text-xs text-slate-400 pt-1 border-t border-dashed border-white/[0.12]">
                      <span>Full Order Price</span>
                      <span className="font-tech text-slate-200">
                        {formatKes(fullOrderTotal, task.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-teal-300">
                      <span>Pay Later After First Draft</span>
                      <span className="font-tech font-medium">
                        {formatKes(remainingBalance, task.currency)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-sm text-white">
                  {checkoutMode === "FULL_ESCROW"
                    ? "Total Due Now"
                    : checkoutMode === "MILESTONE_SPLIT"
                      ? "25% Deposit"
                      : "Page-1 Trial"}
                </span>
                <HudPriceDock
                  label="Due now"
                  price={formatKes(computedTotal, task.currency)}
                  theme="cyan"
                  size="sm"
                />
              </div>

              {!userIsPro && freePricing && proPricing && (
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/35 text-xs text-amber-200 flex items-start gap-2">
                  <Crown className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
                  <span>
                    With Pro, full price is{" "}
                    <strong className="font-tech text-white">
                      {formatKes(proFullOrderTotal, task.currency)}
                    </strong>
                    .{" "}
                    <Link href="/membership" className="underline font-semibold text-amber-300">
                      See Pro Plan
                    </Link>
                  </span>
                </div>
              )}

              <div className="text-xs text-slate-300 space-y-1.5 pt-2">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-300" />
                  What you get
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                  {task.deliverablesSummary.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>
          </HudCard>
        </aside>
      </div>
    </main>
  );
}

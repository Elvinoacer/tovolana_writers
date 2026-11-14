import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Crown,
  FileText,
  Layers,
  RefreshCw,
  ShieldAlert,
  Star,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { calculateBookingPricing, isUserProActive } from "@/lib/pricing";
import {
  formatKes,
  ListingValidityTag,
  StatusPill,
} from "@/components/ui/Badges";
import {
  CategoryCoverArt,
  CreatorAvatar,
  ScoreRing,
} from "@/components/ui/EditorialVisuals";

export const dynamic = "force-dynamic";

function isStillValidUntil(validUntil: Date | null): boolean {
  if (!validUntil) return true;
  return validUntil.getTime() > new Date().getTime();
}

interface RequirementField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const userIsPro = user
    ? isUserProActive(user.membershipTier, user.proExpiresAt)
    : false;

  const [task, config] = await Promise.all([
    db.taskListing.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      include: {
        category: true,
        creator: true,
        reviews: {
          where: { isPublic: true },
          include: { customer: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.platformConfig.findUnique({ where: { id: "global" } }),
  ]);

  if (!task) notFound();

  const isPublished =
    task.status === "PUBLISHED" && isStillValidUntil(task.validUntil);
  const isOwner = Boolean(
    user?.creatorProfile && task.creatorId === user.creatorProfile.id
  );
  const isAdmin = user?.roles.includes("ADMIN") ?? false;

  if (!isPublished && !isOwner && !isAdmin && task.status !== "EXPIRED") {
    notFound();
  }

  const feePct = config?.standardServiceFeePct ?? 10;
  const proDiscountPct = config?.proFeeDiscountPct ?? 50;

  const freePricing = calculateBookingPricing({
    listedPrice: task.basePrice,
    standardServiceFeePct: feePct,
    proFeeDiscountPct: proDiscountPct,
    serviceFeePctOverride: task.serviceFeePctOverride,
    userIsPro: false,
  });

  const proPricing = calculateBookingPricing({
    listedPrice: task.basePrice,
    standardServiceFeePct: feePct,
    proFeeDiscountPct: proDiscountPct,
    serviceFeePctOverride: task.serviceFeePctOverride,
    userIsPro: true,
  });

  const activePricing = userIsPro ? proPricing : freePricing;
  const reqFields = Array.isArray(task.requirementsConfig)
    ? (task.requirementsConfig as unknown as RequirementField[])
    : [];

  const bookHref = user
    ? `/book/${task.id}`
    : `/auth?callbackUrl=${encodeURIComponent(`/book/${task.id}`)}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-reveal">
      <Link
        href="/explore"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-[#1e3a8a]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All Services
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Visual Scope & Spec */}
        <div className="lg:col-span-8 space-y-6">
          <div className="editorial-card overflow-hidden bg-white">
            <CategoryCoverArt
              slug={task.category.slug}
              name={task.category.name}
              heightClass="h-36 sm:h-44"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-tech bg-white/15 text-white backdrop-blur-xs">
                    {task.serviceType}
                  </span>
                  <StatusPill status={task.status} />
                </div>
                <span className="text-xs font-tech text-white/85">
                  {task.pricingType === "QUOTE_BASED" ? "Custom Quote" : "Fixed Scope"}
                </span>
              </div>
            </CategoryCoverArt>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="space-y-2">
                <h1 className="font-editorial text-2xl sm:text-4xl font-semibold text-[#111827] leading-tight">
                  {task.title}
                </h1>
                <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
                  {task.shortDescription}
                </p>
              </div>

              {/* Visual 4-Tile Spec Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4]">
                  <p className="text-[10px] font-tech uppercase text-stone-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#1e3a8a]" />
                    Turnaround
                  </p>
                  <p className="font-tech text-base font-bold text-[#111827] mt-1">
                    {task.deliveryTurnaroundDays} Days
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4]">
                  <p className="text-[10px] font-tech uppercase text-stone-500 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 text-[#0f766e]" />
                    Revisions
                  </p>
                  <p className="font-tech text-base font-bold text-[#111827] mt-1">
                    {task.maxRevisions} Included
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4]">
                  <p className="text-[10px] font-tech uppercase text-stone-500 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-amber-700" />
                    Model
                  </p>
                  <p className="font-tech text-sm font-bold text-[#111827] mt-1">
                    {task.pricingType === "QUOTE_BASED" ? "Custom" : "Fixed"}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] flex items-center">
                  <ListingValidityTag
                    validUntil={task.validUntil}
                    validityType={task.validityType}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#e6e0d4] text-sm text-stone-700 whitespace-pre-line leading-relaxed">
                {task.fullDescription}
              </div>
            </div>
          </div>

          {/* Deliverables */}
          <div className="editorial-card p-6 space-y-4">
            <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#1e3a8a]" />
              Deliverables
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {task.deliverablesSummary.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 text-sm text-stone-800 bg-[#faf7f2] p-3.5 rounded-xl border border-[#e6e0d4]"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#0f766e] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Requirements Preview */}
          <div className="editorial-card p-6 space-y-4">
            <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#1e3a8a]" />
              Brief Requirements
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {reqFields.map((field) => (
                <div
                  key={field.key}
                  className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="text-xs font-semibold text-stone-900 block">
                      {field.label}
                    </span>
                    {field.options && (
                      <span className="text-[11px] text-stone-500">
                        {field.options.slice(0, 3).join(" · ")}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-tech uppercase px-2 py-0.5 rounded-full shrink-0 ${
                      field.required
                        ? "bg-blue-50 text-[#1e3a8a] border border-blue-200"
                        : "bg-stone-200 text-stone-700"
                    }`}
                  >
                    {field.required ? "Required" : "Optional"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Policies Split */}
          <div className="editorial-card p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#0f766e]" />
                Revision Guarantee ({task.maxRevisions}x)
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                {task.revisionPolicy}
              </p>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700" />
                Escrow &amp; Cancellation
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                {task.cancellationPolicy}
              </p>
            </div>
          </div>

          {/* Creator Bio Card */}
          {task.creator && (
            <div className="editorial-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <CreatorAvatar
                  name={task.creator.displayName}
                  username={task.creator.username}
                  available={task.creator.isAvailable}
                  size="lg"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-editorial text-lg font-semibold">
                      {task.creator.displayName}
                    </span>
                    <span className="text-xs text-stone-500 font-tech">
                      @{task.creator.username}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600">
                    {task.creator.headline}
                  </p>
                  <div className="flex items-center gap-3 text-xs font-tech text-stone-700 pt-1">
                    <span className="inline-flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      {task.creator.ratingAverage.toFixed(1)}
                    </span>
                    <span>{task.creator.completedBookingsCount} orders</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <ScoreRing
                  score={task.creator.assessmentScore ?? 90}
                  size={68}
                  sublabel="Rubric"
                />
                <Link
                  href={`/creators/${task.creator.username}`}
                  className="btn-ghost px-4 py-2 text-xs shrink-0"
                >
                  Portfolio
                </Link>
              </div>
            </div>
          )}

          {/* Verified Reviews */}
          {task.reviews.length > 0 && (
            <div className="editorial-card p-6 space-y-4">
              <h2 className="font-editorial text-xl font-semibold">
                Verified Reviews ({task.reviews.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {task.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-xl bg-[#faf7f2] border border-[#e6e0d4]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-stone-900">
                        {rev.customer.name}
                      </span>
                      <span className="text-xs font-tech text-amber-700">
                        ★ {rev.rating}.0
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 mt-1.5 leading-relaxed">
                      {rev.comment}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sticky Escrow Fee Ledger */}
        <aside className="lg:col-span-4 space-y-4 sticky top-24">
          <div className="editorial-card p-6 space-y-5 bg-white">
            <div className="flex items-center justify-between border-b border-[#e6e0d4] pb-3">
              <span className="text-[11px] font-tech uppercase tracking-wider text-stone-500">
                Upfront Fee Ledger
              </span>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  userIsPro
                    ? "bg-amber-100 text-amber-900"
                    : "bg-blue-50 text-[#1e3a8a]"
                }`}
              >
                {userIsPro ? "Pro Rate" : "Free Rate"}
              </span>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-stone-700">
                <span>Listed Scope</span>
                <span className="font-tech font-medium">
                  {formatKes(activePricing.listedPrice, task.currency)}
                </span>
              </div>
              <div className="flex justify-between text-stone-700">
                <span>Service Fee ({feePct}%)</span>
                <span className="font-tech">
                  {formatKes(activePricing.rawServiceFee, task.currency)}
                </span>
              </div>
              {userIsPro && (
                <div className="flex justify-between text-amber-800 bg-amber-50 px-3 py-2 rounded-xl">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold">
                    <Crown className="w-3.5 h-3.5" /> Pro Discount (-{proDiscountPct}%)
                  </span>
                  <span className="font-tech text-xs font-bold">
                    -{formatKes(activePricing.proDiscount, task.currency)}
                  </span>
                </div>
              )}
              <div className="pt-3 border-t border-[#e6e0d4] flex justify-between items-baseline">
                <span className="font-semibold text-base">Total Payable</span>
                <span className="font-tech text-2xl font-bold text-[#111827]">
                  {formatKes(activePricing.totalPayable, task.currency)}
                </span>
              </div>
            </div>

            {!userIsPro && (
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-amber-700" />
                  Save {formatKes(proPricing.proDiscount, task.currency)} with Pro
                </p>
                <p className="text-amber-900/80 font-tech">
                  Pro Total: {formatKes(proPricing.totalPayable, task.currency)}
                </p>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 flex items-start gap-2">
              <CalendarClock className="w-4 h-4 text-[#1e3a8a] shrink-0 mt-0.5" />
              <span>
                <strong>{task.deliveryTurnaroundDays}-day delivery clock</strong>{" "}
                stays protected even after listing validity ends.
              </span>
            </div>

            {isPublished ? (
              <Link href={bookHref} className="btn-primary w-full py-3.5 text-sm">
                <span>{user ? "Book This Service" : "Sign In to Book"}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <div className="p-3.5 rounded-xl bg-stone-100 border border-stone-300 text-xs text-stone-700 text-center">
                Status: <strong>{task.status}</strong> — closed to new bookings.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

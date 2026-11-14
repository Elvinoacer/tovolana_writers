import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Crown,
  FileText,
  RefreshCw,
  ShieldAlert,
  Star,
  UserCheck,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { calculateBookingPricing, isUserProActive } from "@/lib/pricing";

function isStillValidUntil(validUntil: Date | null): boolean {
  if (!validUntil) return true;
  return validUntil.getTime() > new Date().getTime();
}
import {
  formatKes,
  ListingValidityTag,
  StatusPill,
} from "@/components/ui/Badges";

export const dynamic = "force-dynamic";

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Link
        href="/explore"
        className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-[#1e3a8a]"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Marketplace Directory
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Full Service Spec */}
        <div className="lg:col-span-8 space-y-6">
          <div className="editorial-card p-6 sm:p-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#f2ede3] text-stone-900 border border-[#e6e0d4]">
                {task.category.name}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-tech bg-stone-100 text-stone-700">
                {task.serviceType}
              </span>
              <StatusPill status={task.status} />
            </div>

            <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#111827] leading-tight">
              {task.title}
            </h1>

            <p className="text-base text-stone-700 leading-relaxed">
              {task.shortDescription}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <ListingValidityTag
                validUntil={task.validUntil}
                validityType={task.validityType}
              />
              <div className="inline-flex items-center gap-1.5 text-xs bg-blue-50 text-blue-900 border border-blue-200 px-2.5 py-1 rounded-md font-tech">
                <Clock className="w-3.5 h-3.5" />
                Delivery Turnaround:{" "}
                <strong>{task.deliveryTurnaroundDays} days from confirmation</strong>
              </div>
            </div>

            <div className="prose max-w-none pt-4 border-t border-[#e6e0d4] text-sm text-stone-700 whitespace-pre-line leading-relaxed">
              {task.fullDescription}
            </div>
          </div>

          {/* Deliverables */}
          <div className="editorial-card p-6 space-y-3">
            <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#1e3a8a]" />
              Guaranteed Deliverables
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {task.deliverablesSummary.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-stone-700 bg-[#faf7f2] p-3 rounded-lg border border-[#e6e0d4]"
                >
                  <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Requirements Preview */}
          <div className="editorial-card p-6 space-y-3">
            <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#1e3a8a]" />
              What You Will Provide at Booking
            </h2>
            <p className="text-xs text-stone-600">
              Preview all required specifications before committing funds.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {reqFields.map((field) => (
                <div
                  key={field.key}
                  className="p-3 rounded-lg bg-[#faf7f2] border border-[#e6e0d4]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-900">
                      {field.label}
                    </span>
                    <span className="text-[10px] font-tech uppercase px-1.5 py-0.5 rounded bg-stone-200 text-stone-700">
                      {field.required ? "Required" : "Optional"}
                    </span>
                  </div>
                  {field.options && (
                    <p className="text-[11px] text-stone-500 mt-1">
                      Options: {field.options.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Revision & Cancellation Policies */}
          <div className="editorial-card p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#1e3a8a]" />
                Revision Policy ({task.maxRevisions} rounds max)
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                {task.revisionPolicy}
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700" />
                Booking &amp; Cancellation Rules
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                {task.cancellationPolicy}
              </p>
            </div>
          </div>

          {/* Creator Bio */}
          {task.creator && (
            <div className="editorial-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-teal-700" />
                  <span className="font-editorial text-lg font-semibold">
                    {task.creator.displayName}
                  </span>
                  <span className="text-xs text-stone-500 font-tech">
                    @{task.creator.username}
                  </span>
                </div>
                <p className="text-xs text-stone-600">{task.creator.headline}</p>
                <div className="flex items-center gap-4 text-xs font-tech text-stone-700 pt-1">
                  <span className="inline-flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    {task.creator.ratingAverage.toFixed(1)} rating
                  </span>
                  <span>
                    {task.creator.completedBookingsCount} completed bookings
                  </span>
                  <span>
                    Assessment score: {task.creator.assessmentScore ?? 90}/100
                  </span>
                </div>
              </div>
              <Link
                href={`/creators/${task.creator.username}`}
                className="px-4 py-2 rounded-lg border border-[#e6e0d4] text-xs font-semibold hover:bg-stone-50 shrink-0 text-center"
              >
                View Creator Profile
              </Link>
            </div>
          )}

          {/* Reviews */}
          {task.reviews.length > 0 && (
            <div className="editorial-card p-6 space-y-4">
              <h2 className="font-editorial text-xl font-semibold">
                Verified Customer Reviews ({task.reviews.length})
              </h2>
              <div className="space-y-3">
                {task.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-lg bg-[#faf7f2] border border-[#e6e0d4]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-stone-900">
                        {rev.customer.name}
                      </span>
                      <span className="text-xs font-tech text-amber-700">
                        {"★".repeat(rev.rating)} ({rev.rating}/5)
                      </span>
                    </div>
                    <p className="text-sm text-stone-700 mt-1">{rev.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Transparent Pricing Ledger & Book CTA */}
        <aside className="lg:col-span-4 space-y-4 sticky top-24">
          <div className="editorial-card p-6 space-y-5 bg-white">
            <div className="flex items-center justify-between border-b border-[#e6e0d4] pb-3">
              <span className="text-xs font-tech uppercase tracking-wider text-stone-500">
                Upfront Checkout Ledger
              </span>
              <span className="text-xs font-semibold text-[#1e3a8a]">
                {userIsPro ? "Pro Rate Applied" : "Standard Free Rate"}
              </span>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-stone-700">
                <span>Listed Service Price</span>
                <span className="font-tech font-medium">
                  {formatKes(activePricing.listedPrice, task.currency)}
                </span>
              </div>
              <div className="flex justify-between text-stone-700">
                <span>Platform Service Fee ({feePct}%)</span>
                <span className="font-tech">
                  {formatKes(activePricing.rawServiceFee, task.currency)}
                </span>
              </div>
              {userIsPro && (
                <div className="flex justify-between text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded">
                  <span className="inline-flex items-center gap-1 text-xs font-medium">
                    <Crown className="w-3.5 h-3.5" /> Pro Discount ({proDiscountPct}% off fee)
                  </span>
                  <span className="font-tech text-xs font-semibold">
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
              <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-amber-700" />
                  Save {formatKes(proPricing.proDiscount, task.currency)} on this booking with Pro
                </p>
                <p className="text-amber-900/80">
                  Total as a Pro member:{" "}
                  <strong className="font-tech">
                    {formatKes(proPricing.totalPayable, task.currency)}
                  </strong>
                  . Free plans still have full booking access.
                </p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200 text-xs text-blue-950 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <CalendarClock className="w-3.5 h-3.5 text-[#1e3a8a]" />
                Separate Deadlines Guarantee
              </div>
              <p className="text-blue-900/80">
                Once booked, your{" "}
                <strong>{task.deliveryTurnaroundDays}-day delivery deadline</strong>{" "}
                is locked even if this listing&apos;s public validity date arrives earlier.
              </p>
            </div>

            {isPublished ? (
              <Link
                href={bookHref}
                className="block w-full py-3.5 px-4 rounded-xl bg-[#1e3a8a] text-white font-semibold text-sm text-center hover:bg-[#172554] transition-colors shadow-sm"
              >
                {user
                  ? "Proceed to Booking & Requirements"
                  : "Sign In / Join to Book This Task"}
              </Link>
            ) : (
              <div className="p-3 rounded-lg bg-stone-100 border border-stone-300 text-xs text-stone-700 text-center">
                This listing is currently <strong>{task.status}</strong> and is
                closed for new bookings. Existing confirmed bookings remain active.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

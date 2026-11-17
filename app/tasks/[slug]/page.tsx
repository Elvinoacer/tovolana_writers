import React from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  ExternalLink,
  FileText,
  Layers,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Star,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  calculateBookingPricing,
  isFutureTimestamp,
  isUserProActive,
} from "@/lib/pricing";
import { isSafeMediaDisplayUrl } from "@/lib/upload-constants";
import {
  ListingValidityTag,
  StatusPill,
  VettedCreatorBadge,
  formatShortDate,
} from "@/components/ui/Badges";
import {
  CreatorAvatar,
  EscrowStepVisualizer,
  ScoreRing,
  getCategoryPhotoSrc,
} from "@/components/ui/EditorialVisuals";
import { TaskCard } from "@/components/TaskCard";
import { TaskCommissionSidebar } from "@/components/TaskCommissionSidebar";

export const dynamic = "force-dynamic";

function isStillValidUntil(validUntil: Date | null): boolean {
  if (!validUntil) return true;
  return validUntil.getTime() > Date.now();
}

interface RequirementField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

interface PortfolioSample {
  title?: string;
  category?: string;
  excerpt?: string;
  url?: string;
  attachmentUrl?: string;
  attachmentName?: string;
}

function getCreatorTierLabel(tier: string | null | undefined): string {
  switch (tier) {
    case "ELITE":
      return "Elite Tier";
    case "TOP_RATED":
      return "Top Rated";
    case "RISING_TALENT":
      return "Rising Talent";
    default:
      return "Vetted Writer";
  }
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
  const isAdmin = user?.roles.includes("ADMIN") ?? false;
  const now = new Date();

  const [task, config] = await Promise.all([
    db.taskListing.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      include: {
        category: true,
        creator: {
          include: {
            user: { select: { avatarUrl: true } },
          },
        },
        reviews: {
          where: { isPublic: true },
          include: {
            customer: { select: { id: true, name: true, avatarUrl: true } },
          },
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

  if (!isPublished && !isOwner && !isAdmin && task.status !== "EXPIRED") {
    notFound();
  }

  const relatedCandidates = await db.taskListing.findMany({
    where: {
      status: "PUBLISHED",
      validUntil: { gt: now },
      id: { not: task.id },
      ...(!userIsPro && !isAdmin
        ? {
            OR: [
              { proEarlyAccessUntil: null },
              { proEarlyAccessUntil: { lte: now } },
            ],
          }
        : {}),
    },
    include: {
      category: { select: { id: true, slug: true, name: true } },
      creator: {
        select: {
          id: true,
          username: true,
          displayName: true,
          headline: true,
          ratingAverage: true,
          completedBookingsCount: true,
          assessmentScore: true,
          creatorTier: true,
          isAvailable: true,
          onTimeDeliveryRate: true,
          user: { select: { avatarUrl: true } },
        },
      },
      _count: { select: { reviews: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 12,
  });

  const relatedTasks = [...relatedCandidates]
    .sort((a, b) => {
      const aScore =
        (a.categoryId === task.categoryId ? 2 : 0) +
        (task.creatorId && a.creatorId === task.creatorId ? 1 : 0);
      const bScore =
        (b.categoryId === task.categoryId ? 2 : 0) +
        (task.creatorId && b.creatorId === task.creatorId ? 1 : 0);
      return bScore - aScore;
    })
    .slice(0, 3);

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

  const reqFields = Array.isArray(task.requirementsConfig)
    ? (task.requirementsConfig as unknown as RequirementField[])
    : [];

  const isProEarlyAccess = isFutureTimestamp(task.proEarlyAccessUntil);
  const photoSrc = getCategoryPhotoSrc(task.category.slug);
  const portfolioSamples = Array.isArray(task.creator?.portfolioSamples)
    ? (task.creator?.portfolioSamples as PortfolioSample[]).slice(0, 2)
    : [];

  return (
    <div className="animate-reveal">
      {/* Warm Sunlit Parchment Editorial Hero */}
      <section className="relative overflow-hidden border-b border-[#e6e0d4] bg-[#f2ede3] text-[#111827]">
        <Image
          src={photoSrc}
          alt={`${task.category.name} — ${task.title}`}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-45"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#f2ede3] via-[#f2ede3]/94 lg:via-[58%] to-[#f2ede3]/30"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#f2ede3] via-transparent to-[#f2ede3]/65"
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-10 sm:pb-12 space-y-8">
          {/* Top Breadcrumb & Status Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-1.5 text-xs text-stone-600"
            >
              <Link
                href="/explore"
                className="hover:text-[#1e3a8a] transition-colors font-semibold"
              >
                Explore
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
              <Link
                href={`/explore?category=${encodeURIComponent(task.category.slug)}`}
                className="hover:text-[#1e3a8a] transition-colors font-medium"
              >
                {task.category.name}
              </Link>
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={task.status} />
              <ListingValidityTag
                validUntil={task.validUntil}
                validityType={task.validityType}
              />
              {(isOwner || isAdmin) && (
                <Link
                  href={`/creators-hub/listings/new?edit=${encodeURIComponent(task.slug)}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#d6cfc2] bg-white/85 px-3 py-1 text-xs font-semibold text-[#111827] backdrop-blur-md hover:bg-white transition-colors"
                >
                  <Pencil className="h-3 w-3 text-[#1e3a8a]" />
                  <span>Edit</span>
                </Link>
              )}
            </div>
          </div>

          {/* Core Headline & Lead */}
          <div className="space-y-4 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-[#e6e0d4] bg-white/85 px-3 py-1 text-xs font-semibold text-[#0f766e] shadow-2xs backdrop-blur-md">
                {task.category.name} · {task.serviceType}
              </span>
              {isProEarlyAccess && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50/95 px-3 py-1 text-xs font-semibold text-amber-900 shadow-2xs backdrop-blur-md">
                  <Crown className="h-3.5 w-3.5 text-[#b45309]" />
                  <span>Pro Early Access</span>
                </span>
              )}
            </div>

            <h1 className="font-editorial text-3xl sm:text-4xl lg:text-[2.55rem] font-bold tracking-tight text-[#111827] leading-[1.14]">
              {task.title}
            </h1>

            <p className="text-base sm:text-lg text-stone-700 leading-relaxed max-w-2xl">
              {task.shortDescription}
            </p>
          </div>

          {/* Unified Hero Metadata Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-[#e6e0d4] pt-5">
            {task.creator ? (
              <Link
                href={`/creators/${task.creator.username}`}
                className="group inline-flex items-center gap-3 min-w-0"
              >
                <CreatorAvatar
                  name={task.creator.displayName}
                  username={task.creator.username}
                  avatarUrl={task.creator.user?.avatarUrl}
                  available={task.creator.isAvailable}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-sm text-[#111827] group-hover:text-[#1e3a8a] transition-colors">
                      {task.creator.displayName}
                    </span>
                    <BadgeCheck className="h-4 w-4 text-[#0f766e] shrink-0" />
                    <span className="font-tech text-xs text-stone-500">
                      @{task.creator.username}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 text-xs font-tech text-stone-600 mt-0.5">
                    <span className="inline-flex items-center gap-1 font-semibold text-stone-900">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {task.creator.ratingAverage.toFixed(1)}
                    </span>
                    {typeof task.creator.assessmentScore === "number" && (
                      <span className="font-semibold text-[#0f766e]">
                        {Math.round(task.creator.assessmentScore)}% Rubric
                      </span>
                    )}
                    <span className="text-stone-600">
                      {task.creator.isAvailable ? "Accepting orders" : "At capacity"}
                    </span>
                  </div>
                </div>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 text-xs text-stone-700">
                <BadgeCheck className="h-4 w-4 text-[#0f766e]" />
                Vetted Tovolana Specialist
              </span>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-tech inline-flex items-center gap-1.5 rounded-full border border-[#e6e0d4] bg-white/85 px-3 py-1.5 text-xs font-semibold text-[#111827] shadow-2xs backdrop-blur-md">
                <Clock className="h-3.5 w-3.5 text-[#1e3a8a]" />
                {task.deliveryTurnaroundDays}d Delivery
              </span>
              <span className="font-tech inline-flex items-center gap-1.5 rounded-full border border-[#e6e0d4] bg-white/85 px-3 py-1.5 text-xs font-semibold text-[#111827] shadow-2xs backdrop-blur-md">
                <RotateCcw className="h-3.5 w-3.5 text-[#0f766e]" />
                {task.maxRevisions} Revisions
              </span>
              <span className="font-tech inline-flex items-center gap-1.5 rounded-full border border-[#e6e0d4] bg-white/85 px-3 py-1.5 text-xs font-semibold text-[#111827] shadow-2xs backdrop-blur-md">
                <Layers className="h-3.5 w-3.5 text-[#b45309]" />
                {task.pricingType === "QUOTE_BASED" ? "Custom Quote" : "Fixed Scope"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Editorial Workspace */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 8 Columns: Uncluttered Editorial Sections */}
          <div className="lg:col-span-8 space-y-6">
            {/* 1. About This Service & Deliverables */}
            <section className="editorial-card bg-white p-6 sm:p-8 space-y-6">
              <div className="space-y-3">
                <h2 className="font-editorial text-xl sm:text-2xl font-bold tracking-tight text-[#111827]">
                  About this service
                </h2>
                <div className="whitespace-pre-line text-[15px] leading-[1.75] text-stone-700 max-w-[70ch]">
                  {task.fullDescription}
                </div>
              </div>

              {task.deliverablesSummary.length > 0 && (
                <div className="border-t border-[#e6e0d4] pt-6 space-y-3">
                  <h3 className="text-sm font-semibold text-[#111827]">
                    Included deliverables
                  </h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {task.deliverablesSummary.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 rounded-xl bg-[#faf7f2] px-3.5 py-3 text-sm text-stone-800"
                      >
                        <CheckCircle2 className="h-4 w-4 text-[#0f766e] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* 2. What We Need From You */}
            {reqFields.length > 0 && (
              <section className="editorial-card bg-white p-6 sm:p-8 space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-editorial text-xl sm:text-2xl font-bold tracking-tight text-[#111827]">
                    What we need from you
                  </h2>
                  <span className="text-xs text-stone-500">
                    Brief fields collected at checkout
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {reqFields.map((field) => (
                    <div
                      key={field.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#e6e0d4] bg-[#faf7f2]/75 px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#111827] truncate">
                          {field.label}
                        </p>
                        {field.options && field.options.length > 0 && (
                          <p className="text-[11px] text-stone-500 truncate">
                            {field.options.slice(0, 3).join(" · ")}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 text-[11px] font-medium ${
                          field.required ? "text-[#1e3a8a]" : "text-stone-400"
                        }`}
                      >
                        {field.required ? "Required" : "Optional"}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="flex items-center gap-2 text-xs text-stone-500 pt-1">
                  <FileText className="h-3.5 w-3.5 text-[#1e3a8a] shrink-0" />
                  <span>
                    Supports PDF, DOCX, XLSX, and ZIP brief attachments in Step 1 of checkout.
                  </span>
                </p>
              </section>
            )}

            {/* 3. Escrow Timeline & Protection */}
            <section className="editorial-card bg-white p-6 sm:p-8 space-y-5">
              <h2 className="font-editorial text-xl sm:text-2xl font-bold tracking-tight text-[#111827] flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#0f766e]" />
                Escrow protection
              </h2>

              <div className="rounded-xl bg-[#faf7f2] border border-[#e6e0d4] p-4">
                <EscrowStepVisualizer status="PAID_AWAITING_ACCEPTANCE" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1 text-xs leading-relaxed text-stone-600">
                <div>
                  <h3 className="text-sm font-semibold text-[#111827] mb-1">
                    Revisions ({task.maxRevisions} rounds)
                  </h3>
                  <p>{task.revisionPolicy}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#111827] mb-1">
                    Cancellation &amp; escrow
                  </h3>
                  <p>{task.cancellationPolicy}</p>
                </div>
              </div>
            </section>

            {/* 4. Warm Parchment Author Feature Card */}
            {task.creator && (
              <section className="rounded-2xl border border-[#e6e0d4] bg-[#f2ede3]/85 p-6 sm:p-8 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <CreatorAvatar
                      name={task.creator.displayName}
                      username={task.creator.username}
                      avatarUrl={task.creator.user?.avatarUrl}
                      available={task.creator.isAvailable}
                      size="lg"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <VettedCreatorBadge />
                        <span className="rounded-full bg-white/80 border border-[#e6e0d4] px-2.5 py-0.5 text-[11px] font-semibold text-[#1e3a8a]">
                          {getCreatorTierLabel(task.creator.creatorTier)}
                        </span>
                      </div>
                      <h2 className="font-editorial text-xl sm:text-2xl font-bold tracking-tight text-[#111827]">
                        {task.creator.displayName}
                      </h2>
                      <p className="text-xs sm:text-sm text-stone-700">
                        {task.creator.headline}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/creators/${task.creator.username}`}
                    className="btn-ghost px-4 py-2 text-xs shrink-0 self-start sm:self-center"
                  >
                    <span>View Portfolio</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-8 space-y-3">
                    <p className="text-sm text-stone-700 leading-relaxed">
                      {task.creator.bio}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {task.creator.educationCredentials && (
                        <span className="rounded-lg bg-white/80 border border-[#e6e0d4] px-2.5 py-1 font-medium text-stone-800">
                          {task.creator.educationCredentials}
                        </span>
                      )}
                      {task.creator.yearsExperience > 0 && (
                        <span className="font-tech rounded-lg bg-white/80 border border-[#e6e0d4] px-2.5 py-1 text-stone-700">
                          {task.creator.yearsExperience}+ yrs
                        </span>
                      )}
                      <span className="font-tech rounded-lg bg-white/80 border border-[#e6e0d4] px-2.5 py-1 text-[#0f766e]">
                        {task.creator.onTimeDeliveryRate.toFixed(0)}% on-time
                      </span>
                    </div>
                  </div>

                  <div className="md:col-span-4 grid grid-cols-2 gap-2 rounded-xl bg-white/80 border border-[#e6e0d4] p-3 text-center">
                    <ScoreRing
                      score={task.creator.assessmentScore ?? 90}
                      size={72}
                      tone="emerald"
                      sublabel="Rubric"
                    />
                    <ScoreRing
                      score={(task.creator.ratingAverage / 5) * 100}
                      label={`${task.creator.ratingAverage.toFixed(1)}★`}
                      size={72}
                      tone="gold"
                      sublabel="Rating"
                    />
                  </div>
                </div>

                {portfolioSamples.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {portfolioSamples.map((sample, idx) => {
                      const attachmentUrl = sample.attachmentUrl?.trim() || "";
                      const safeAttachment = isSafeMediaDisplayUrl(attachmentUrl)
                        ? attachmentUrl
                        : null;
                      return (
                        <div
                          key={idx}
                          className="rounded-xl bg-white/85 border border-[#e6e0d4] p-4 space-y-1.5"
                        >
                          {sample.category && (
                            <span className="text-[11px] font-medium text-[#0f766e] block">
                              {sample.category}
                            </span>
                          )}
                          <h3 className="font-editorial text-sm font-semibold text-[#111827] leading-snug">
                            {sample.title || "Writing Sample"}
                          </h3>
                          {sample.excerpt && (
                            <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                              {sample.excerpt}
                            </p>
                          )}
                          {safeAttachment && (
                            <a
                              href={safeAttachment}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 pt-1 text-[11px] font-semibold text-[#1e3a8a] hover:underline"
                            >
                              <span>Read sample</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* 5. Client Reviews */}
            {task.reviews.length > 0 ? (
              <section className="editorial-card bg-white p-6 sm:p-8 space-y-4">
                <h2 className="font-editorial text-xl sm:text-2xl font-bold tracking-tight text-[#111827]">
                  Client reviews ({task.reviews.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {task.reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="rounded-xl border border-[#e6e0d4] bg-[#faf7f2] p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#111827]">
                          {rev.customer.name}
                        </span>
                        <span className="font-tech inline-flex items-center gap-1 text-xs font-bold text-amber-800">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                          {rev.rating}.0
                          <span className="font-normal text-stone-400 ml-1">
                            {formatShortDate(rev.createdAt)}
                          </span>
                        </span>
                      </div>
                      <p className="text-xs text-stone-700 leading-relaxed">
                        {rev.comment}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <p className="text-xs text-stone-500 px-1">
                Reviews appear after verified escrow delivery and client approval.
              </p>
            )}
          </div>

          {/* Right 4 Columns: Streamlined Sticky Commissioning Sidebar */}
          <aside className="lg:col-span-4 lg:sticky lg:top-24">
            <TaskCommissionSidebar
              task={{
                id: task.id,
                slug: task.slug,
                title: task.title,
                basePrice: task.basePrice,
                currency: task.currency,
                deliveryTurnaroundDays: task.deliveryTurnaroundDays,
                maxRevisions: task.maxRevisions,
                pricingType: task.pricingType,
                validUntil: task.validUntil ? task.validUntil.toISOString() : null,
                validityType: task.validityType,
                manualAcceptanceRequired: task.manualAcceptanceRequired,
                status: task.status,
              }}
              isPublished={isPublished}
              userIsAuthenticated={Boolean(user)}
              userIsPro={userIsPro}
              feePct={feePct}
              proDiscountPct={proDiscountPct}
              freePricing={{
                listedPrice: freePricing.listedPrice,
                rawServiceFee: freePricing.rawServiceFee,
                effectiveServiceFee: freePricing.serviceFee,
                proDiscount: freePricing.proDiscount,
                totalPayable: freePricing.totalPayable,
              }}
              proPricing={{
                listedPrice: proPricing.listedPrice,
                rawServiceFee: proPricing.rawServiceFee,
                effectiveServiceFee: proPricing.serviceFee,
                proDiscount: proPricing.proDiscount,
                totalPayable: proPricing.totalPayable,
              }}
            />
          </aside>
        </div>

        {/* 6. Related Services */}
        {relatedTasks.length > 0 && (
          <section className="pt-8 border-t border-[#e6e0d4] space-y-6">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-[#111827]">
                Related services
              </h2>
              <Link
                href={`/explore?category=${encodeURIComponent(task.category.slug)}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#1e3a8a] hover:underline"
              >
                <span>Browse {task.category.name}</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedTasks.map((related) => (
                <TaskCard
                  key={related.id}
                  task={related}
                  standardFeePct={feePct}
                  proDiscountPct={proDiscountPct}
                  userIsPro={userIsPro}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

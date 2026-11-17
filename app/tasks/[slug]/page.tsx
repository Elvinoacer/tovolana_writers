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
  Quote,
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
      {/* Editorial hero */}
      <section className="relative overflow-hidden border-b border-[#e6e0d4] bg-[#f2ede3]">
        <Image
          src={photoSrc}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-[0.28]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#f2ede3] via-[#f2ede3]/92 to-[#f2ede3]/55"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#f2ede3] via-transparent to-[#f2ede3]/50"
        />

        <div className="relative z-10 mx-auto max-w-7xl space-y-7 px-4 pb-10 pt-6 sm:px-6 sm:pb-12 sm:pt-7 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-1.5 text-xs text-[#6b7280]"
            >
              <Link
                href="/explore"
                className="cursor-pointer font-semibold text-[#4b5563] transition-colors hover:text-[#1e3a8a]"
              >
                Explore
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-[#c4bdb0]" aria-hidden="true" />
              <Link
                href={`/explore?category=${encodeURIComponent(task.category.slug)}`}
                className="cursor-pointer font-medium transition-colors hover:text-[#1e3a8a]"
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
                  className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-full border border-[#d6cfc2] bg-white/90 px-3 py-1 text-xs font-semibold text-[#111827] backdrop-blur-sm transition-colors hover:bg-white"
                >
                  <Pencil className="h-3 w-3 text-[#1e3a8a]" aria-hidden="true" />
                  Edit
                </Link>
              )}
            </div>
          </div>

          <div className="max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-[#e6e0d4] bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#0f766e] backdrop-blur-sm">
                {task.category.name}
                <span className="mx-1.5 text-[#d6cfc2]">·</span>
                {task.serviceType}
              </span>
              {isProEarlyAccess && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50/95 px-2.5 py-1 text-xs font-semibold text-amber-900 backdrop-blur-sm">
                  <Crown className="h-3.5 w-3.5 text-[#b45309]" aria-hidden="true" />
                  Pro Early Access
                </span>
              )}
            </div>

            <h1 className="font-editorial text-[1.85rem] font-bold leading-[1.12] tracking-tight text-[#111827] sm:text-4xl lg:text-[2.65rem]">
              {task.title}
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-[#4b5563] sm:text-lg">
              {task.shortDescription}
            </p>
          </div>

          {/* Prospectus meta strip */}
          <div className="overflow-hidden rounded-2xl border border-[#e6e0d4] bg-white/90 shadow-[0_1px_2px_rgba(17,24,39,0.03)] backdrop-blur-sm">
            <div className="flex flex-col gap-0 lg:flex-row lg:items-stretch">
              {task.creator ? (
                <Link
                  href={`/creators/${task.creator.username}`}
                  className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 border-b border-[#e6e0d4] px-4 py-4 transition-colors hover:bg-[#faf7f2]/80 sm:px-5 lg:border-b-0 lg:border-r"
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
                      <span className="text-sm font-semibold text-[#111827] transition-colors group-hover:text-[#1e3a8a]">
                        {task.creator.displayName}
                      </span>
                      <BadgeCheck className="h-4 w-4 shrink-0 text-[#0f766e]" aria-hidden="true" />
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#4b5563]">
                      <span className="inline-flex items-center gap-1 font-tech font-semibold text-[#111827]">
                        <Star
                          className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                          aria-hidden="true"
                        />
                        {task.creator.ratingAverage.toFixed(1)}
                      </span>
                      {typeof task.creator.assessmentScore === "number" && (
                        <span className="font-semibold text-[#0f766e]">
                          {Math.round(task.creator.assessmentScore)}% rubric
                        </span>
                      )}
                      <span>
                        {task.creator.isAvailable
                          ? "Accepting orders"
                          : "At capacity"}
                      </span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="flex flex-1 items-center gap-2 border-b border-[#e6e0d4] px-4 py-4 text-sm text-[#4b5563] sm:px-5 lg:border-b-0 lg:border-r">
                  <BadgeCheck className="h-4 w-4 text-[#0f766e]" aria-hidden="true" />
                  Vetted Tovolana Specialist
                </div>
              )}

              <div className="grid flex-[1.2] grid-cols-3 divide-x divide-[#e6e0d4]">
                <div className="flex flex-col items-center justify-center gap-1 px-3 py-4 text-center">
                  <Clock className="h-4 w-4 text-[#1e3a8a]" aria-hidden="true" />
                  <span className="font-tech text-sm font-bold text-[#111827]">
                    {task.deliveryTurnaroundDays}d
                  </span>
                  <span className="text-[11px] text-[#6b7280]">Delivery</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 px-3 py-4 text-center">
                  <RotateCcw className="h-4 w-4 text-[#0f766e]" aria-hidden="true" />
                  <span className="font-tech text-sm font-bold text-[#111827]">
                    {task.maxRevisions}x
                  </span>
                  <span className="text-[11px] text-[#6b7280]">Revisions</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 px-3 py-4 text-center">
                  <Layers className="h-4 w-4 text-[#b45309]" aria-hidden="true" />
                  <span className="font-tech text-sm font-bold text-[#111827]">
                    {task.pricingType === "QUOTE_BASED" ? "Quote" : "Fixed"}
                  </span>
                  <span className="text-[11px] text-[#6b7280]">Scope</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main workspace */}
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="space-y-10 lg:col-span-8">
            {/* About */}
            <section className="space-y-5">
              <div className="space-y-2">
                <h2 className="font-editorial text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">
                  About this service
                </h2>
                <div className="h-0.5 w-12 rounded-full bg-[#1e3a8a]" aria-hidden="true" />
              </div>
              <div className="max-w-[70ch] whitespace-pre-line text-[15px] leading-[1.8] text-[#374151]">
                {task.fullDescription}
              </div>

              {task.deliverablesSummary.length > 0 && (
                <div className="mt-2 space-y-3 rounded-2xl border border-[#e6e0d4] bg-[#faf7f2]/80 p-5 sm:p-6">
                  <h3 className="text-sm font-semibold text-[#111827]">
                    Included deliverables
                  </h3>
                  <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {task.deliverablesSummary.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-sm text-[#1f2937]"
                      >
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#0f766e]"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Requirements */}
            {reqFields.length > 0 && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="space-y-2">
                    <h2 className="font-editorial text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">
                      What we need from you
                    </h2>
                    <div className="h-0.5 w-12 rounded-full bg-[#0f766e]" aria-hidden="true" />
                  </div>
                  <span className="text-xs text-[#6b7280]">
                    Collected at checkout
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {reqFields.map((field) => (
                    <div
                      key={field.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#111827]">
                          {field.label}
                        </p>
                        {field.options && field.options.length > 0 && (
                          <p className="truncate text-[11px] text-[#6b7280]">
                            {field.options.slice(0, 3).join(" · ")}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          field.required
                            ? "bg-[#eff6ff] text-[#1e3a8a]"
                            : "bg-[#f2ede3] text-[#6b7280]"
                        }`}
                      >
                        {field.required ? "Required" : "Optional"}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="flex items-center gap-2 text-xs text-[#6b7280]">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[#1e3a8a]" aria-hidden="true" />
                  PDF, DOCX, XLSX, and ZIP attachments accepted in checkout.
                </p>
              </section>
            )}

            {/* Escrow */}
            <section className="space-y-5 rounded-2xl border border-[#e6e0d4] bg-white p-5 sm:p-7">
              <div className="space-y-2">
                <h2 className="font-editorial flex items-center gap-2 text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">
                  <ShieldCheck className="h-5 w-5 text-[#0f766e]" aria-hidden="true" />
                  Escrow protection
                </h2>
                <p className="max-w-[60ch] text-sm text-[#4b5563]">
                  Payment stays locked until you approve the final delivery.
                </p>
              </div>

              <div className="rounded-xl border border-[#e6e0d4] bg-[#faf7f2] p-4">
                <EscrowStepVisualizer status="PAID_AWAITING_ACCEPTANCE" />
              </div>

              <div className="grid grid-cols-1 gap-5 border-t border-[#e6e0d4] pt-5 text-sm leading-relaxed text-[#4b5563] sm:grid-cols-2">
                <div>
                  <h3 className="mb-1.5 text-sm font-semibold text-[#111827]">
                    Revisions ({task.maxRevisions} rounds)
                  </h3>
                  <p className="text-xs leading-relaxed sm:text-sm">
                    {task.revisionPolicy}
                  </p>
                </div>
                <div>
                  <h3 className="mb-1.5 text-sm font-semibold text-[#111827]">
                    Cancellation &amp; escrow
                  </h3>
                  <p className="text-xs leading-relaxed sm:text-sm">
                    {task.cancellationPolicy}
                  </p>
                </div>
              </div>
            </section>

            {/* Creator plate */}
            {task.creator && (
              <section className="overflow-hidden rounded-2xl border border-[#e6e0d4] bg-[#f2ede3]/90">
                <div className="border-b border-[#e6e0d4]/80 px-5 py-5 sm:px-7 sm:py-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-4">
                      <CreatorAvatar
                        name={task.creator.displayName}
                        username={task.creator.username}
                        avatarUrl={task.creator.user?.avatarUrl}
                        available={task.creator.isAvailable}
                        size="lg"
                      />
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <VettedCreatorBadge />
                          <span className="rounded-full border border-[#e6e0d4] bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-[#1e3a8a]">
                            {getCreatorTierLabel(task.creator.creatorTier)}
                          </span>
                        </div>
                        <h2 className="font-editorial text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">
                          {task.creator.displayName}
                        </h2>
                        {task.creator.headline && (
                          <p className="text-sm text-[#4b5563]">
                            {task.creator.headline}
                          </p>
                        )}
                      </div>
                    </div>

                    <Link
                      href={`/creators/${task.creator.username}`}
                      className="btn-ghost min-h-[40px] shrink-0 cursor-pointer self-start px-4 py-2 text-xs sm:self-center"
                    >
                      View portfolio
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 items-center gap-6 px-5 py-5 sm:px-7 sm:py-6 md:grid-cols-12">
                  <div className="space-y-3 md:col-span-8">
                    <p className="text-sm leading-relaxed text-[#374151]">
                      {task.creator.bio}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {task.creator.educationCredentials && (
                        <span className="rounded-lg border border-[#e6e0d4] bg-white/90 px-2.5 py-1 font-medium text-[#1f2937]">
                          {task.creator.educationCredentials}
                        </span>
                      )}
                      {task.creator.yearsExperience > 0 && (
                        <span className="font-tech rounded-lg border border-[#e6e0d4] bg-white/90 px-2.5 py-1 text-[#4b5563]">
                          {task.creator.yearsExperience}+ yrs
                        </span>
                      )}
                      <span className="font-tech rounded-lg border border-[#e6e0d4] bg-white/90 px-2.5 py-1 text-[#0f766e]">
                        {task.creator.onTimeDeliveryRate.toFixed(0)}% on-time
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#e6e0d4] bg-white p-3 text-center md:col-span-4">
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
                  <div className="grid grid-cols-1 gap-3 border-t border-[#e6e0d4]/80 px-5 py-5 sm:grid-cols-2 sm:px-7 sm:py-6">
                    {portfolioSamples.map((sample, idx) => {
                      const attachmentUrl = sample.attachmentUrl?.trim() || "";
                      const safeAttachment = isSafeMediaDisplayUrl(attachmentUrl)
                        ? attachmentUrl
                        : null;
                      return (
                        <div
                          key={idx}
                          className="space-y-1.5 rounded-xl border border-[#e6e0d4] bg-white/95 p-4"
                        >
                          {sample.category && (
                            <span className="block text-[11px] font-medium text-[#0f766e]">
                              {sample.category}
                            </span>
                          )}
                          <h3 className="font-editorial text-sm font-semibold leading-snug text-[#111827]">
                            {sample.title || "Writing Sample"}
                          </h3>
                          {sample.excerpt && (
                            <p className="line-clamp-2 text-xs leading-relaxed text-[#4b5563]">
                              {sample.excerpt}
                            </p>
                          )}
                          {safeAttachment && (
                            <a
                              href={safeAttachment}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex cursor-pointer items-center gap-1 pt-1 text-[11px] font-semibold text-[#1e3a8a] hover:underline"
                            >
                              Read sample
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Reviews */}
            {task.reviews.length > 0 ? (
              <section className="space-y-5">
                <div className="space-y-2">
                  <h2 className="font-editorial text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">
                    Client reviews
                    <span className="ml-2 font-tech text-base font-semibold text-[#6b7280]">
                      ({task.reviews.length})
                    </span>
                  </h2>
                  <div className="h-0.5 w-12 rounded-full bg-[#b45309]" aria-hidden="true" />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {task.reviews.map((rev) => (
                    <figure
                      key={rev.id}
                      className="relative space-y-3 rounded-2xl border border-[#e6e0d4] bg-white p-5"
                    >
                      <Quote
                        className="absolute right-4 top-4 h-5 w-5 text-[#e6e0d4]"
                        aria-hidden="true"
                      />
                      <div className="flex items-center justify-between gap-2 pr-6">
                        <figcaption className="text-sm font-semibold text-[#111827]">
                          {rev.customer.name}
                        </figcaption>
                        <span className="font-tech inline-flex items-center gap-1 text-xs font-bold text-amber-800">
                          <Star
                            className="h-3 w-3 fill-amber-500 text-amber-500"
                            aria-hidden="true"
                          />
                          {rev.rating}.0
                        </span>
                      </div>
                      <blockquote className="text-sm leading-relaxed text-[#4b5563]">
                        {rev.comment}
                      </blockquote>
                      <time className="font-tech block text-[11px] text-[#9ca3af]">
                        {formatShortDate(rev.createdAt)}
                      </time>
                    </figure>
                  ))}
                </div>
              </section>
            ) : (
              <p className="text-xs text-[#6b7280]">
                Reviews appear after verified escrow delivery and client approval.
              </p>
            )}
          </div>

          {/* Sticky commission sidebar */}
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

        {/* Related */}
        {relatedTasks.length > 0 && (
          <section className="space-y-6 border-t border-[#e6e0d4] pt-10">
            <div className="flex items-end justify-between gap-3">
              <div className="space-y-2">
                <h2 className="font-editorial text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
                  Related services
                </h2>
                <div className="h-0.5 w-12 rounded-full bg-[#1e3a8a]" aria-hidden="true" />
              </div>
              <Link
                href={`/explore?category=${encodeURIComponent(task.category.slug)}`}
                className="inline-flex cursor-pointer items-center gap-1 text-sm font-semibold text-[#1e3a8a] hover:underline"
              >
                Browse {task.category.name}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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

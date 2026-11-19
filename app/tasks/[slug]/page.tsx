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
import { getCardHudTheme } from "@/lib/design-tokens";
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
  formatCreatorTier,
  formatShortDate,
} from "@/components/ui/Badges";
import { FlowSteps } from "@/components/ui/FlowGuide";
import {
  EscrowStepVisualizer,
  ScoreRing,
  getCategoryPhotoSrc,
} from "@/components/ui/EditorialVisuals";
import {
  AuroraHeading,
  HudBadge,
  HudMediaFrame,
  RadarAvatar,
} from "@/components/ui/AuroraPrimitives";
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
  const heroTheme = getCardHudTheme(task.category.slug);
  const portfolioSamples = Array.isArray(task.creator?.portfolioSamples)
    ? (task.creator?.portfolioSamples as PortfolioSample[]).slice(0, 2)
    : [];

  return (
    <div className="animate-reveal">
      {/* Dark Aurora HUD Service Hero */}
      <section
        data-hud-theme={heroTheme}
        className="relative overflow-hidden border-b border-white/[0.08] bg-[#060a14]/75"
      >
        <Image
          src={photoSrc}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-[0.18]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#05080f] via-[#05080f]/90 to-[#05080f]/60"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#05080f] via-transparent to-[#05080f]/55"
        />

        <div className="relative z-10 mx-auto max-w-7xl space-y-7 px-4 pb-10 pt-6 sm:px-6 sm:pb-12 sm:pt-7 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400"
            >
              <Link
                href="/explore"
                className="cursor-pointer font-semibold text-slate-300 transition-colors hover:text-cyan-300"
              >
                Find Writers
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <Link
                href={`/explore?category=${encodeURIComponent(task.category.slug)}`}
                className="cursor-pointer font-medium transition-colors hover:text-cyan-300"
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
                  className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.16] bg-white/[0.08] px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/[0.15]"
                >
                  <Pencil className="h-3 w-3 text-cyan-300" aria-hidden="true" />
                  Edit
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <HudBadge label={`${task.category.name} · ${task.serviceType}`} sparkle />
                {isProEarlyAccess && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/45 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200 backdrop-blur-sm">
                    <Crown className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                    Pro Early Access
                  </span>
                )}
              </div>

              <h1 className="font-editorial text-[1.85rem] font-bold leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-[2.65rem]">
                {task.title}
              </h1>

              <p className="max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                {task.shortDescription}
              </p>
            </div>

            <div className="lg:col-span-5">
              <HudMediaFrame
                src={photoSrc}
                alt={task.category.name}
                categoryLabel={task.category.name}
                theme={heroTheme}
                aspectClass="aspect-[16/9] w-full"
                sizes="(max-width: 1024px) 100vw, 480px"
                priority
              />
            </div>
          </div>

          {/* Prospectus Meta Strip */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.12] bg-white/[0.045] backdrop-blur-md">
            <div className="flex flex-col gap-0 lg:flex-row lg:items-stretch">
              {task.creator ? (
                <Link
                  href={`/creators/${task.creator.username}`}
                  className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 border-b border-white/[0.1] px-4 py-4 transition-colors hover:bg-white/[0.04] sm:px-5 lg:border-b-0 lg:border-r"
                >
                  <RadarAvatar
                    name={task.creator.displayName}
                    avatarUrl={task.creator.user?.avatarUrl}
                    available={task.creator.isAvailable}
                    theme={heroTheme}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-white transition-colors group-hover:text-cyan-300">
                        {task.creator.displayName}
                      </span>
                      <BadgeCheck className="h-4 w-4 shrink-0 text-teal-400" aria-hidden="true" />
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                      <span className="inline-flex items-center gap-1 font-tech font-semibold text-white">
                        <Star
                          className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                          aria-hidden="true"
                        />
                        {task.creator.ratingAverage.toFixed(1)}
                      </span>
                      {typeof task.creator.assessmentScore === "number" && (
                        <span className="font-semibold text-teal-300">
                          {Math.round(task.creator.assessmentScore)}% test score
                        </span>
                      )}
                      <span className="text-slate-400">
                        {task.creator.isAvailable
                          ? "Available"
                          : "Busy right now"}
                      </span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="flex flex-1 items-center gap-2 border-b border-white/[0.1] px-4 py-4 text-sm text-slate-300 sm:px-5 lg:border-b-0 lg:border-r">
                  <BadgeCheck className="h-4 w-4 text-teal-400" aria-hidden="true" />
                  Tested Tovolana Writer
                </div>
              )}

              <div className="grid flex-[1.2] grid-cols-3 divide-x divide-white/[0.1]">
                <div className="flex flex-col items-center justify-center gap-1 px-3 py-4 text-center">
                  <Clock className="h-4 w-4 text-sky-300" aria-hidden="true" />
                  <span className="font-tech text-sm font-bold text-white">
                    {task.deliveryTurnaroundDays}{" "}
                    {task.deliveryTurnaroundDays === 1 ? "day" : "days"}
                  </span>
                  <span className="text-[11px] text-slate-400">Delivery</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 px-3 py-4 text-center">
                  <RotateCcw className="h-4 w-4 text-teal-300" aria-hidden="true" />
                  <span className="font-tech text-sm font-bold text-white">
                    {task.maxRevisions}
                  </span>
                  <span className="text-[11px] text-slate-400">Free edits</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 px-3 py-4 text-center">
                  <Layers className="h-4 w-4 text-amber-300" aria-hidden="true" />
                  <span className="font-tech text-sm font-bold text-white">
                    {task.pricingType === "QUOTE_BASED" ? "Custom quote" : "Fixed"}
                  </span>
                  <span className="text-[11px] text-slate-400">Price type</span>
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
                <h2 className="font-editorial text-xl font-bold tracking-tight text-white sm:text-2xl">
                  About this service
                </h2>
                <div className="h-0.5 w-12 rounded-full bg-gradient-to-r from-cyan-400 to-sky-400" aria-hidden="true" />
              </div>
              <div className="max-w-[70ch] whitespace-pre-line text-[15px] leading-[1.8] text-slate-300">
                {task.fullDescription}
              </div>

              {task.deliverablesSummary.length > 0 && (
                <div className="mt-2 space-y-3 editorial-card p-5 sm:p-6">
                  <h3 className="text-sm font-semibold text-white">
                    What&apos;s included
                  </h3>
                  <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {task.deliverablesSummary.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-sm text-slate-200"
                      >
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-teal-400"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <FlowSteps
                steps={[
                  { label: "Share your details" },
                  { label: "Pay safely" },
                  { label: "Writer delivers" },
                  { label: "Approve & done" },
                ]}
                currentStep={1}
                goalLabel="Goal: Finished work you're happy with"
              />
            </section>

            {/* Requirements */}
            {reqFields.length > 0 && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="space-y-2">
                    <h2 className="font-editorial text-xl font-bold tracking-tight text-white sm:text-2xl">
                      What you&apos;ll fill in on the next page
                    </h2>
                    <div className="h-0.5 w-12 rounded-full bg-teal-400" aria-hidden="true" />
                  </div>
                  <span className="text-xs text-slate-400">
                    Takes 2 minutes
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {reqFields.map((field) => (
                    <div
                      key={field.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.11] bg-white/[0.045] px-3.5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {field.label}
                        </p>
                        {field.options && field.options.length > 0 && (
                          <p className="truncate text-[11px] text-slate-400">
                            {field.options.slice(0, 3).join(" · ")}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold border ${
                          field.required
                            ? "bg-sky-500/15 text-sky-300 border-sky-400/35"
                            : "bg-white/[0.06] text-slate-400 border-white/[0.12]"
                        }`}
                      >
                        {field.required ? "Required" : "Optional"}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="flex items-center gap-2 text-xs text-slate-400">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-sky-300" aria-hidden="true" />
                  You can attach PDF, Word, Excel, or ZIP files on the next page.
                </p>
              </section>
            )}

            {/* Escrow */}
            <section className="editorial-card space-y-5 p-5 sm:p-7">
              <div className="space-y-2">
                <h2 className="font-editorial flex items-center gap-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
                  <ShieldCheck className="h-5 w-5 text-teal-400" aria-hidden="true" />
                  Your money is safe
                </h2>
                <p className="max-w-[60ch] text-sm text-slate-300">
                  We hold your payment safely and only pay the writer after you
                  check and approve the finished work.
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.11] bg-white/[0.04] p-4">
                <EscrowStepVisualizer status="PAID_AWAITING_ACCEPTANCE" />
              </div>

              <div className="grid grid-cols-1 gap-5 border-t border-white/[0.1] pt-5 text-sm leading-relaxed text-slate-300 sm:grid-cols-2">
                <div>
                  <h3 className="mb-1.5 text-sm font-semibold text-white">
                    Free edits ({task.maxRevisions} included)
                  </h3>
                  <p className="text-xs leading-relaxed sm:text-sm">
                    {task.revisionPolicy}
                  </p>
                </div>
                <div>
                  <h3 className="mb-1.5 text-sm font-semibold text-white">
                    Cancellations &amp; refunds
                  </h3>
                  <p className="text-xs leading-relaxed sm:text-sm">
                    {task.cancellationPolicy}
                  </p>
                </div>
              </div>
            </section>

            {/* Creator plate */}
            {task.creator && (
              <section className="editorial-card overflow-hidden border-teal-400/25">
                <div className="border-b border-white/[0.1] px-5 py-5 sm:px-7 sm:py-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-4">
                      <RadarAvatar
                        name={task.creator.displayName}
                        avatarUrl={task.creator.user?.avatarUrl}
                        available={task.creator.isAvailable}
                        theme="cyan"
                        size="lg"
                      />
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <VettedCreatorBadge />
                          <span className="rounded-full border border-sky-400/35 bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300">
                            {formatCreatorTier(task.creator.creatorTier)}
                          </span>
                        </div>
                        <h2 className="font-editorial text-xl font-bold tracking-tight text-white sm:text-2xl">
                          Meet {task.creator.displayName}
                        </h2>
                        {task.creator.headline && (
                          <p className="text-sm text-slate-300">
                            {task.creator.headline}
                          </p>
                        )}
                      </div>
                    </div>

                    <Link
                      href={`/creators/${task.creator.username}`}
                      className="btn-ghost min-h-[40px] shrink-0 cursor-pointer self-start px-4 py-2 text-xs sm:self-center"
                    >
                      See full profile
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 items-center gap-6 px-5 py-5 sm:px-7 sm:py-6 md:grid-cols-12">
                  <div className="space-y-3 md:col-span-8">
                    <p className="text-sm leading-relaxed text-slate-300">
                      {task.creator.bio}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {task.creator.educationCredentials && (
                        <span className="rounded-lg border border-white/[0.12] bg-white/[0.05] px-2.5 py-1 font-medium text-slate-200">
                          {task.creator.educationCredentials}
                        </span>
                      )}
                      {task.creator.yearsExperience > 0 && (
                        <span className="font-tech rounded-lg border border-white/[0.12] bg-white/[0.05] px-2.5 py-1 text-slate-300">
                          {task.creator.yearsExperience}+ yrs experience
                        </span>
                      )}
                      <span className="font-tech rounded-lg border border-teal-400/35 bg-teal-500/15 px-2.5 py-1 text-teal-300">
                        {task.creator.onTimeDeliveryRate.toFixed(0)}% on time
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] p-3 text-center md:col-span-4">
                    <ScoreRing
                      score={task.creator.assessmentScore ?? 90}
                      size={72}
                      tone="emerald"
                      sublabel="Test score"
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
                  <div className="grid grid-cols-1 gap-3 border-t border-white/[0.1] px-5 py-5 sm:grid-cols-2 sm:px-7 sm:py-6">
                    {portfolioSamples.map((sample, idx) => {
                      const attachmentUrl = sample.attachmentUrl?.trim() || "";
                      const safeAttachment = isSafeMediaDisplayUrl(attachmentUrl)
                        ? attachmentUrl
                        : null;
                      return (
                        <div
                          key={idx}
                          className="space-y-1.5 rounded-xl border border-white/[0.11] bg-white/[0.045] p-4"
                        >
                          {sample.category && (
                            <span className="block text-[11px] font-medium text-teal-300">
                              {sample.category}
                            </span>
                          )}
                          <h3 className="font-editorial text-sm font-semibold leading-snug text-white">
                            {sample.title || "Writing Sample"}
                          </h3>
                          {sample.excerpt && (
                            <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
                              {sample.excerpt}
                            </p>
                          )}
                          {safeAttachment && (
                            <a
                              href={safeAttachment}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex cursor-pointer items-center gap-1 pt-1 text-[11px] font-semibold text-sky-300 hover:underline"
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
                  <h2 className="font-editorial text-xl font-bold tracking-tight text-white sm:text-2xl">
                    Client reviews
                    <span className="ml-2 font-tech text-base font-semibold text-slate-400">
                      ({task.reviews.length})
                    </span>
                  </h2>
                  <div className="h-0.5 w-12 rounded-full bg-amber-400" aria-hidden="true" />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {task.reviews.map((rev) => (
                    <figure
                      key={rev.id}
                      className="editorial-card relative space-y-3 p-5"
                    >
                      <Quote
                        className="absolute right-4 top-4 h-5 w-5 text-white/10"
                        aria-hidden="true"
                      />
                      <div className="flex items-center justify-between gap-2 pr-6">
                        <figcaption className="text-sm font-semibold text-white">
                          {rev.customer.name}
                        </figcaption>
                        <span className="font-tech inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                          <Star
                            className="h-3 w-3 fill-amber-400 text-amber-400"
                            aria-hidden="true"
                          />
                          {rev.rating}.0
                        </span>
                      </div>
                      <blockquote className="text-sm leading-relaxed text-slate-300">
                        {rev.comment}
                      </blockquote>
                      <time className="font-tech block text-[11px] text-slate-400">
                        {formatShortDate(rev.createdAt)}
                      </time>
                    </figure>
                  ))}
                </div>
              </section>
            ) : (
              <p className="text-xs text-slate-400">
                Reviews show up here once clients complete and approve an order.
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
          <section className="space-y-6 border-t border-white/[0.1] pt-10">
            <div className="flex items-end justify-between gap-3">
              <div className="space-y-2">
                <AuroraHeading
                  as="h2"
                  className="text-2xl sm:text-3xl"
                >
                  Similar services
                </AuroraHeading>
                <div className="h-0.5 w-12 rounded-full bg-cyan-400" aria-hidden="true" />
              </div>
              <Link
                href={`/explore?category=${encodeURIComponent(task.category.slug)}`}
                className="inline-flex cursor-pointer items-center gap-1 text-sm font-semibold text-sky-400 hover:text-sky-300 hover:underline"
              >
                See more in {task.category.name}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {relatedTasks.map((related, idx) => (
                <TaskCard
                  key={related.id}
                  task={related}
                  standardFeePct={feePct}
                  proDiscountPct={proDiscountPct}
                  userIsPro={userIsPro}
                  index={idx}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

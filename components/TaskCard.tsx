import { formatKes } from "@/components/ui/Badges";
import {
  CreatorAvatar,
  getCategoryPhotoSrc,
} from "@/components/ui/EditorialVisuals";
import { calculateBookingPricing, isFutureTimestamp } from "@/lib/pricing";
import {
  ArrowUpRight,
  BadgeCheck,
  Clock,
  Crown,
  FileCheck2,
  RotateCcw,
  Sparkles,
  Star,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export interface TaskCardItem {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  serviceType: string;
  pricingType: string;
  basePrice: number;
  currency: string;
  serviceFeePctOverride: number | null;
  deliveryTurnaroundDays: number;
  maxRevisions: number;
  validityType: string;
  validUntil: string | Date | null;
  proEarlyAccessUntil: string | Date | null;
  deliverablesSummary?: string[];
  manualAcceptanceRequired?: boolean;
  category: { id: string; slug: string; name: string };
  creator: {
    id: string;
    username: string;
    displayName: string;
    ratingAverage: number;
    completedBookingsCount: number;
    headline?: string | null;
    assessmentScore?: number | null;
    creatorTier?: string | null;
    isAvailable?: boolean;
    onTimeDeliveryRate?: number | null;
    user?: { avatarUrl: string | null } | null;
  } | null;
  _count?: { reviews: number };
}

/**
 * Luminous Editorial Service Card:
 * - Sweeping top light filament & glowing gradient perimeter on hover
 * - Decluttered single-line hook + inline spec pills for effortless scanning
 * - Supports both standard gallery cards and wide `featured` spotlight layout
 */
export function TaskCard({
  task,
  standardFeePct = 10,
  proDiscountPct = 50,
  userIsPro = false,
  featured = false,
}: {
  task: TaskCardItem;
  standardFeePct?: number;
  proDiscountPct?: number;
  userIsPro?: boolean;
  featured?: boolean;
}) {
  const pricing = calculateBookingPricing({
    listedPrice: task.basePrice,
    standardServiceFeePct: standardFeePct,
    proFeeDiscountPct: proDiscountPct,
    serviceFeePctOverride: task.serviceFeePctOverride,
    userIsPro,
  });

  const isProEarlyAccess = isFutureTimestamp(task.proEarlyAccessUntil);
  const photoSrc = getCategoryPhotoSrc(task.category.slug);
  const deliverables = Array.isArray(task.deliverablesSummary)
    ? task.deliverablesSummary.filter(Boolean)
    : [];
  const isQuoteBased = task.pricingType === "QUOTE_BASED";
  const taskHref = `/tasks/${task.slug}`;

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-[22px] p-[1px] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 ${
        featured
          ? "bg-gradient-to-r from-[#1e3a8a]/35 via-[#0f766e]/35 to-[#d97706]/35 shadow-[0_18px_48px_-18px_rgba(30,58,138,0.22)] hover:shadow-[0_24px_60px_-16px_rgba(30,58,138,0.3)] md:flex-row"
          : "bg-[#e6e0d4] shadow-[0_2px_8px_rgba(17,24,39,0.03),0_12px_30px_-16px_rgba(17,24,39,0.1)] hover:bg-gradient-to-br hover:from-[#1e3a8a]/65 hover:via-[#0f766e]/55 hover:to-[#d97706]/65 hover:shadow-[0_22px_48px_-16px_rgba(30,58,138,0.2)]"
      }`}
    >
      {/* Inner Card Surface */}
      <div
        className={`relative flex h-full w-full flex-col overflow-hidden rounded-[21px] bg-white ${
          featured ? "md:flex-row" : ""
        }`}
      >
        {/* Sweeping Luminous Top Light Line */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[2px] overflow-hidden"
        >
          <div className="h-full w-1/2 -translate-x-full bg-gradient-to-r from-transparent via-[#38bdf8] via-[#10b981] to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-[250%]" />
        </div>

        {/* Full-Card Primary Link */}
        <Link
          href={taskHref}
          aria-label={`View ${task.title}`}
          className="absolute inset-0 z-10 cursor-pointer rounded-[21px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a8a] focus-visible:ring-offset-2"
        />

        {/* Cover Photograph */}
        <div
          className={`relative shrink-0 overflow-hidden bg-[#f2ede3] ${
            featured
              ? "aspect-[16/10] w-full md:aspect-auto md:w-[44%]"
              : "aspect-[16/10] w-full"
          }`}
        >
          <Image
            src={photoSrc}
            alt=""
            fill
            sizes={
              featured
                ? "(max-width: 768px) 100vw, 520px"
                : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
            }
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent"
          />

          {/* Top Floating Badges */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 p-3.5">
            <span className="inline-flex max-w-full items-center truncate rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold tracking-tight text-[#111827] shadow-xs backdrop-blur-md">
              {task.category.name}
            </span>

            <div className="flex items-center gap-1.5">
              {featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#111827]/90 px-2.5 py-1 text-[10px] font-tech font-semibold uppercase tracking-wider text-white backdrop-blur-md">
                  <Sparkles className="h-3 w-3 text-amber-300" />
                  Spotlight
                </span>
              )}
              {isProEarlyAccess && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/90 bg-amber-50/95 px-2.5 py-1 text-[11px] font-semibold text-amber-950 shadow-xs backdrop-blur-md">
                  <Crown
                    className="h-3 w-3 text-[#b45309]"
                    aria-hidden="true"
                  />
                  Pro
                </span>
              )}
            </div>
          </div>

          {/* Bottom-Left Pricing Mode Pill (Only for Custom Quote) */}
          {isQuoteBased && (
            <div className="pointer-events-none absolute bottom-3 left-3.5 z-20">
              <span className="inline-flex items-center rounded-md border border-white/25 bg-black/55 px-2.5 py-0.5 text-[10px] font-tech font-semibold uppercase tracking-wider text-white backdrop-blur-md">
                Custom Quote
              </span>
            </div>
          )}
        </div>

        {/* Decluttered Content Panel */}
        <div
          className={`pointer-events-none relative z-20 flex flex-1 flex-col justify-between bg-white ${
            featured ? "gap-5 p-6 sm:p-8" : "gap-4 p-5"
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-tech text-[10px] font-semibold uppercase tracking-widest text-[#0f766e]">
                {task.serviceType}
              </span>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#faf7f2] text-stone-400 transition-all duration-300 group-hover:bg-[#1e3a8a] group-hover:text-white">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>

            <h3
              className={`font-editorial font-bold tracking-tight text-[#111827] transition-colors duration-200 group-hover:text-[#1e3a8a] line-clamp-2 ${
                featured
                  ? "text-xl leading-snug sm:text-2xl"
                  : "text-[1.08rem] leading-[1.32]"
              }`}
            >
              {task.title}
            </h3>

            <p
              className={`text-[13px] leading-relaxed text-stone-500 ${
                featured ? "line-clamp-2 max-w-2xl" : "line-clamp-1"
              }`}
            >
              {task.shortDescription}
            </p>
          </div>

          <div className="space-y-4">
            {/* Lightweight Inline Micro-Specs (Replaces Heavy 3-Box Table) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e6e0d4]/80 bg-[#faf7f2] px-2.5 py-1 font-tech text-[11px] font-semibold text-[#111827]">
                <Clock className="h-3 w-3 text-[#1e3a8a]" aria-hidden="true" />
                {task.deliveryTurnaroundDays}d delivery
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e6e0d4]/80 bg-[#faf7f2] px-2.5 py-1 font-tech text-[11px] font-semibold text-[#111827]">
                <RotateCcw
                  className="h-3 w-3 text-[#0f766e]"
                  aria-hidden="true"
                />
                {task.maxRevisions}x rev
              </span>

              {deliverables.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e6e0d4]/80 bg-[#faf7f2] px-2.5 py-1 font-tech text-[11px] font-semibold text-[#111827]">
                  <FileCheck2
                    className="h-3 w-3 text-[#b45309]"
                    aria-hidden="true"
                  />
                  {deliverables.length}{" "}
                  {deliverables.length === 1 ? "file" : "files"}
                </span>
              )}
            </div>

            {/* Creator + Price Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-[#e6e0d4]/80 pt-3.5">
              {task.creator ? (
                <Link
                  href={`/creators/${task.creator.username}`}
                  className="pointer-events-auto relative z-30 group/creator flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl py-0.5 pr-1.5 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a8a]"
                >
                  <CreatorAvatar
                    name={task.creator.displayName}
                    username={task.creator.username}
                    avatarUrl={task.creator.user?.avatarUrl}
                    available={task.creator.isAvailable ?? true}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[#111827] transition-colors group-hover/creator:text-[#1e3a8a]">
                      {task.creator.displayName}
                    </span>
                    <span className="inline-flex items-center gap-1 font-tech text-[11px] font-semibold text-stone-500">
                      <Star
                        className="h-3 w-3 fill-amber-400 text-amber-400"
                        aria-hidden="true"
                      />
                      {task.creator.ratingAverage.toFixed(1)}
                    </span>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-600">
                  <BadgeCheck
                    className="h-4 w-4 text-[#0f766e]"
                    aria-hidden="true"
                  />
                  <span>Vetted Writer</span>
                </div>
              )}

              <div className="shrink-0 text-right">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  {userIsPro ? "Pro total" : "From"}
                </span>
                <span className="font-tech mt-0.5 block text-[16px] font-bold tracking-tight text-[#111827] group-hover:text-[#b45309] transition-colors">
                  {formatKes(pricing.totalPayable, task.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

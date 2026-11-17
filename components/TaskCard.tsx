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
 * Full-bleed photographic task card with warm ivory gradient scrim
 * harmonizing cleanly with the parchment page canvas.
 */
export function TaskCard({
  task,
  standardFeePct = 10,
  proDiscountPct = 50,
  userIsPro = false,
}: {
  task: TaskCardItem;
  standardFeePct?: number;
  proDiscountPct?: number;
  userIsPro?: boolean;
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
    <article className="group relative flex min-h-[390px] sm:min-h-[410px] flex-col justify-between overflow-hidden rounded-2xl border border-[#e6e0d4] bg-[#faf7f2] shadow-[0_8px_24px_-10px_rgba(17,24,39,0.08)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-[#d6cfc2] hover:shadow-[0_20px_38px_-14px_rgba(17,24,39,0.13)]">
      {/* Full-Card Background Photograph */}
      <Image
        src={photoSrc}
        alt={task.title}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
        className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
      />

      {/* Top Subtle Vignette + Warm Luminous Ivory Scrim */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white from-[36%] via-[#faf7f2]/96 via-[58%] to-transparent to-[80%]"
      />

      {/* Full-Card Clickable Link Layer */}
      <Link
        href={taskHref}
        aria-label={task.title}
        className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a8a] focus-visible:ring-inset"
      />

      {/* Top Overlay Row: Category Pill & Action Indicator */}
      <div className="pointer-events-none relative z-20 flex items-start justify-between gap-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold tracking-tight text-[#111827] shadow-sm backdrop-blur-md">
            {task.category.name}
          </span>
          {isProEarlyAccess && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-amber-50/95 px-2 py-1 text-[11px] font-semibold text-amber-900 shadow-sm backdrop-blur-md">
              <Crown className="h-3 w-3 text-[#b45309]" />
              <span>Pro</span>
            </span>
          )}
        </div>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 text-[#111827] shadow-sm backdrop-blur-md transition-all duration-200 group-hover:bg-[#1e3a8a] group-hover:text-white">
          <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>

      {/* Open Image Breathing Zone + High-Contrast Light Information Layer */}
      <div className="pointer-events-none relative z-20 mt-auto flex flex-col justify-end p-5 sm:p-6 pt-20 space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-tight text-[#0f766e] truncate">
            {isQuoteBased
              ? `${task.serviceType} · Custom Quote`
              : task.serviceType}
          </p>

          <h3 className="font-editorial text-[1.15rem] font-bold leading-[1.28] tracking-tight text-[#111827] transition-colors duration-200 group-hover:text-[#1e3a8a] line-clamp-2">
            {task.title}
          </h3>

          <p className="text-[13.5px] leading-[1.52] text-stone-600 line-clamp-2">
            {task.shortDescription}
          </p>
        </div>

        {/* Inline Icon-Spec Row */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-tech text-stone-600">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#1e3a8a]" />
            <span>{task.deliveryTurnaroundDays}d</span>
          </span>

          <span className="inline-flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5 text-[#0f766e]" />
            <span>{task.maxRevisions}x</span>
          </span>

          {deliverables.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5 text-[#b45309]" />
              <span>
                {deliverables.length} deliverable
                {deliverables.length === 1 ? "" : "s"}
              </span>
            </span>
          )}
        </div>

        {/* High-Contrast 1-Line Creator & Burnished Gold Price Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[#e6e0d4] pt-3.5">
          {task.creator ? (
            <Link
              href={`/creators/${task.creator.username}`}
              className="pointer-events-auto relative z-30 group/creator flex min-w-0 items-center gap-2 rounded-lg py-0.5 pr-1 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a8a]"
            >
              <CreatorAvatar
                name={task.creator.displayName}
                username={task.creator.username}
                avatarUrl={task.creator.user?.avatarUrl}
                available={task.creator.isAvailable ?? true}
                size="sm"
              />
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold text-[#111827] transition-colors group-hover/creator:text-[#1e3a8a]">
                  {task.creator.displayName}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-tech font-semibold text-stone-800 shrink-0">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {task.creator.ratingAverage.toFixed(1)}
                </span>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-medium text-stone-600">
              <BadgeCheck className="h-4 w-4 text-[#0f766e]" />
              <span>Vetted Writer</span>
            </div>
          )}

          <div className="shrink-0 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-1.5 text-right transition-colors group-hover:border-amber-300 group-hover:bg-amber-100/80">
            <span className="block text-[10px] font-medium text-amber-800/80 leading-none">
              {userIsPro ? "Pro total" : "Total"}
            </span>
            <span className="font-tech mt-0.5 block text-[16px] font-bold tracking-tight text-[#b45309]">
              {formatKes(pricing.totalPayable, task.currency)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

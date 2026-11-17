import { formatKes } from "@/components/ui/Badges";
import {
  CreatorAvatar,
  getCategoryPhotoSrc,
} from "@/components/ui/EditorialVisuals";
import { calculateBookingPricing, isFutureTimestamp } from "@/lib/pricing";
import {
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
 * Editorial prospectus task card — photographic cover band +
 * parchment content panel with clear title → specs → price hierarchy.
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
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#e6e0d4] bg-white shadow-[0_1px_2px_rgba(17,24,39,0.03),0_10px_28px_-14px_rgba(17,24,39,0.1)] transition-[border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-[#cfc7b8] hover:shadow-[0_18px_40px_-16px_rgba(17,24,39,0.16)]">
      {/* Ink accent rail on hover */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 z-30 w-[3px] origin-top scale-y-0 bg-[#1e3a8a] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-y-100"
      />

      <Link
        href={taskHref}
        aria-label={`View ${task.title}`}
        className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a8a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf7f2]"
      />

      {/* Cover photograph */}
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-[#f2ede3]">
        <Image
          src={photoSrc}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
          className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent"
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 sm:p-3.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="inline-flex max-w-full items-center truncate rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold tracking-tight text-[#111827] shadow-sm backdrop-blur-sm">
              {task.category.name}
            </span>
            {isProEarlyAccess && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/80 bg-amber-50/95 px-2 py-1 text-[11px] font-semibold text-amber-900 shadow-sm backdrop-blur-sm">
                <Crown className="h-3 w-3 text-[#b45309]" aria-hidden="true" />
                Pro
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Parchment content panel */}
      <div className="pointer-events-none relative z-20 flex flex-1 flex-col gap-3.5 bg-white p-4 sm:p-5">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold tracking-wide text-[#0f766e]">
            {isQuoteBased
              ? `${task.serviceType} · Custom Quote`
              : task.serviceType}
          </p>

          <h3 className="font-editorial text-[1.05rem] font-bold leading-[1.3] tracking-tight text-[#111827] transition-colors duration-200 group-hover:text-[#1e3a8a] sm:text-[1.12rem] line-clamp-2">
            {task.title}
          </h3>

          <p className="text-[13px] leading-[1.55] text-[#4b5563] line-clamp-2">
            {task.shortDescription}
          </p>
        </div>

        {/* Spec strip */}
        <div className="mt-auto grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-[#e6e0d4] bg-[#e6e0d4]">
          <div className="flex flex-col items-center gap-0.5 bg-[#faf7f2] px-2 py-2 text-center">
            <Clock className="h-3.5 w-3.5 text-[#1e3a8a]" aria-hidden="true" />
            <span className="font-tech text-[12px] font-bold text-[#111827]">
              {task.deliveryTurnaroundDays}d
            </span>
            <span className="text-[10px] text-[#6b7280]">Delivery</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 bg-[#faf7f2] px-2 py-2 text-center">
            <RotateCcw className="h-3.5 w-3.5 text-[#0f766e]" aria-hidden="true" />
            <span className="font-tech text-[12px] font-bold text-[#111827]">
              {task.maxRevisions}x
            </span>
            <span className="text-[10px] text-[#6b7280]">Revisions</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 bg-[#faf7f2] px-2 py-2 text-center">
            <FileCheck2 className="h-3.5 w-3.5 text-[#b45309]" aria-hidden="true" />
            <span className="font-tech text-[12px] font-bold text-[#111827]">
              {deliverables.length > 0 ? deliverables.length : "—"}
            </span>
            <span className="text-[10px] text-[#6b7280]">
              {deliverables.length === 1 ? "File" : "Files"}
            </span>
          </div>
        </div>

        {/* Creator + price */}
        <div className="flex items-center justify-between gap-3 border-t border-[#e6e0d4] pt-3">
          {task.creator ? (
            <Link
              href={`/creators/${task.creator.username}`}
              className="pointer-events-auto relative z-30 group/creator flex min-w-0 cursor-pointer items-center gap-2 rounded-lg py-0.5 pr-1 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a8a]"
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
                <span className="inline-flex items-center gap-0.5 text-[11px] font-tech font-semibold text-[#4b5563]">
                  <Star
                    className="h-3 w-3 fill-amber-400 text-amber-400"
                    aria-hidden="true"
                  />
                  {task.creator.ratingAverage.toFixed(1)}
                </span>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#4b5563]">
              <BadgeCheck className="h-4 w-4 text-[#0f766e]" aria-hidden="true" />
              <span>Vetted Writer</span>
            </div>
          )}

          <div className="shrink-0 text-right">
            <span className="block text-[10px] font-medium leading-none text-[#6b7280]">
              {userIsPro ? "Pro total" : "From"}
            </span>
            <span className="font-tech mt-0.5 block text-[15px] font-bold tracking-tight text-[#b45309] sm:text-[16px]">
              {formatKes(pricing.totalPayable, task.currency)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

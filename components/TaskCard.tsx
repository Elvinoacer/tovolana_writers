import React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Clock,
  Crown,
  RefreshCw,
  Star,
} from "lucide-react";
import { calculateBookingPricing, isFutureTimestamp } from "@/lib/pricing";
import { formatKes, ListingValidityTag } from "@/components/ui/Badges";
import { CategoryCoverArt, CreatorAvatar } from "@/components/ui/EditorialVisuals";

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
  category: { id: string; slug: string; name: string };
  creator: {
    id: string;
    username: string;
    displayName: string;
    ratingAverage: number;
    completedBookingsCount: number;
  } | null;
  _count?: { reviews: number };
}

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

  return (
    <article className="editorial-card-interactive overflow-hidden flex flex-col justify-between group bg-white">
      <div>
        {/* Real Category Photograph Cover */}
        <CategoryCoverArt
          slug={task.category.slug}
          name={task.category.name}
          heightClass="h-44"
        >
          <div className="flex items-end justify-between gap-2 pt-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {isProEarlyAccess ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-950 border border-amber-300 shadow-xs">
                  <Crown className="w-3 h-3" />
                  Pro Early
                </span>
              ) : (
                <span className="text-[10px] font-tech px-2.5 py-1 rounded-full bg-black/55 text-white border border-white/15 backdrop-blur-md">
                  {task.serviceType}
                </span>
              )}
              <span className="text-[10px] font-tech uppercase px-2.5 py-1 rounded-full bg-white/15 text-white border border-white/15 backdrop-blur-md">
                {task.pricingType === "QUOTE_BASED" ? "Custom Quote" : "Fixed Scope"}
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 text-white border border-white/15 backdrop-blur-md text-[10px] font-tech shrink-0">
              <Clock className="w-3 h-3 text-emerald-300" />
              <span>{task.deliveryTurnaroundDays}d</span>
              <span className="text-white/35">·</span>
              <RefreshCw className="w-2.5 h-2.5 text-amber-300" />
              <span>{task.maxRevisions} rev</span>
            </div>
          </div>
        </CategoryCoverArt>

        {/* Concise Scannable Content */}
        <div className="p-5 pb-3 space-y-3">
          <Link href={`/tasks/${task.slug}`} className="block">
            <h3 className="font-editorial text-lg font-semibold text-[#111827] group-hover:text-[#1e3a8a] transition-colors leading-snug line-clamp-2">
              {task.title}
            </h3>
          </Link>

          <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
            {task.shortDescription}
          </p>

          {/* Creator Row */}
          {task.creator && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#efeae0]">
              <Link
                href={`/creators/${task.creator.username}`}
                className="flex items-center gap-2.5 min-w-0 group/creator"
              >
                <CreatorAvatar
                  name={task.creator.displayName}
                  username={task.creator.username}
                  available
                  size="sm"
                />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-stone-900 group-hover/creator:text-[#1e3a8a] truncate flex items-center gap-1">
                    <span className="truncate">{task.creator.displayName}</span>
                    <BadgeCheck className="w-3.5 h-3.5 text-[#0f766e] shrink-0" />
                  </span>
                </div>
              </Link>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-[11px] font-tech text-stone-800 shrink-0">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span>{task.creator.ratingAverage.toFixed(1)}</span>
                <span className="text-stone-400">
                  ({task.creator.completedBookingsCount})
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Visual Metrics & Action Strip */}
      <div className="px-5 pb-5 pt-1 space-y-3">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <ListingValidityTag
            validUntil={task.validUntil}
            validityType={task.validityType}
          />
          {userIsPro && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 font-tech text-[10px] font-semibold">
              <Crown className="w-2.5 h-2.5 text-amber-600" />
              Pro 5% Fee
            </span>
          )}
        </div>

        <Link
          href={`/tasks/${task.slug}`}
          className="flex items-center justify-between p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] group-hover:bg-[#111827] group-hover:border-[#111827] transition-colors"
        >
          <div>
            <p className="text-[10px] text-stone-500 group-hover:text-stone-400 font-tech uppercase tracking-wider">
              {formatKes(pricing.listedPrice, task.currency)} +{" "}
              {formatKes(pricing.serviceFee, task.currency)} fee
            </p>
            <p className="text-base font-bold text-[#111827] group-hover:text-white font-tech leading-tight">
              {formatKes(pricing.totalPayable, task.currency)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e3a8a] text-white group-hover:bg-white group-hover:text-[#111827] text-xs font-semibold transition-colors">
            <span>Book</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>
    </article>
  );
}

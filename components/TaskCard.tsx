import React from "react";
import Link from "next/link";
import { ArrowRight, Clock, Crown, Star, UserCheck } from "lucide-react";
import { calculateBookingPricing, isFutureTimestamp } from "@/lib/pricing";
import { formatKes, ListingValidityTag } from "@/components/ui/Badges";

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
    <article className="editorial-card p-5 flex flex-col justify-between hover:border-[#1e3a8a]/50 hover:shadow-md transition-all">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#f2ede3] text-[#111827] border border-[#e6e0d4]">
            {task.category.name}
          </span>
          <div className="flex items-center gap-1.5">
            {isProEarlyAccess && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                <Crown className="w-3 h-3" />
                Pro Early Access
              </span>
            )}
            <span className="text-[11px] font-tech text-stone-500 uppercase">
              {task.pricingType === "QUOTE_BASED" ? "Custom Quote Base" : "Fixed Scope"}
            </span>
          </div>
        </div>

        <Link href={`/tasks/${task.slug}`} className="group block">
          <h3 className="font-editorial text-lg font-semibold text-[#111827] group-hover:text-[#1e3a8a] transition-colors leading-snug">
            {task.title}
          </h3>
        </Link>

        <p className="text-sm text-stone-600 mt-2 line-clamp-2 leading-relaxed">
          {task.shortDescription}
        </p>

        {task.creator && (
          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-stone-100">
            <Link
              href={`/creators/${task.creator.username}`}
              className="flex items-center gap-1.5 text-xs font-medium text-stone-800 hover:text-[#1e3a8a]"
            >
              <UserCheck className="w-3.5 h-3.5 text-teal-700" />
              <span>{task.creator.displayName}</span>
              <span className="text-stone-400">@{task.creator.username}</span>
            </Link>
            <div className="flex items-center gap-1 text-xs font-tech text-stone-700">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>{task.creator.ratingAverage.toFixed(1)}</span>
              <span className="text-stone-400">
                ({task.creator.completedBookingsCount})
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[#e6e0d4] space-y-2.5">
        <div className="flex items-center justify-between text-xs text-stone-600">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#1e3a8a]" />
            Turnaround: <strong>{task.deliveryTurnaroundDays}d</strong>
          </span>
          <span className="font-tech">
            {task.maxRevisions} revisions included
          </span>
        </div>

        <ListingValidityTag
          validUntil={task.validUntil}
          validityType={task.validityType}
        />

        <div className="bg-[#faf7f2] rounded-lg p-3 border border-[#e6e0d4] flex items-center justify-between">
          <div>
            <p className="text-[11px] text-stone-500 font-tech">
              Listed {formatKes(pricing.listedPrice, task.currency)} + Fee{" "}
              {formatKes(pricing.serviceFee, task.currency)}
            </p>
            <p className="text-base font-bold text-[#111827] font-tech">
              Total: {formatKes(pricing.totalPayable, task.currency)}
            </p>
          </div>
          <Link
            href={`/tasks/${task.slug}`}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-[#1e3a8a] text-white hover:bg-[#172554] transition-colors"
          >
            Inspect
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

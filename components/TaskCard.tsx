import { formatKes } from "@/components/ui/Badges";
import {
  CreatorAvatar,
  getCategoryPhotoSrc,
} from "@/components/ui/EditorialVisuals";
import { calculateBookingPricing, isFutureTimestamp } from "@/lib/pricing";
import { ArrowUpRight, BadgeCheck, Crown, Star } from "lucide-react";
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
  category: { id: string; slug: string; name: string };
  creator: {
    id: string;
    username: string;
    displayName: string;
    ratingAverage: number;
    completedBookingsCount: number;
    user?: { avatarUrl: string | null } | null;
  } | null;
  _count?: { reviews: number };
}

/** Minimal editorial listing card used globally across landing, explore, and creator pages. */
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

  return (
    <article className="editorial-card-interactive overflow-hidden flex flex-col justify-between group bg-white">
      <div>
        <Link
          href={`/tasks/${task.slug}`}
          className="relative block h-48 overflow-hidden bg-[#111827]"
        >
          <Image
            src={photoSrc}
            alt={task.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent"
          />
          {isProEarlyAccess && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-100/95 text-amber-950 shadow-xs">
              <Crown className="w-3 h-3" />
              Pro Early
            </span>
          )}
        </Link>

        <div className="p-5 pb-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-medium text-[#0f766e] truncate">
              {task.category.name}
            </span>
            <span className="font-tech text-stone-500 shrink-0">
              {task.deliveryTurnaroundDays}d delivery
            </span>
          </div>

          <Link href={`/tasks/${task.slug}`} className="block">
            <h3 className="font-editorial text-[1.18rem] font-semibold text-[#111827] group-hover:text-[#1e3a8a] transition-colors leading-[1.3] line-clamp-2">
              {task.title}
            </h3>
          </Link>

          <p className="text-[13px] text-stone-600 line-clamp-1 leading-relaxed">
            {task.shortDescription}
          </p>
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="pt-3.5 border-t border-[#efeae0] flex items-center justify-between gap-3">
          {task.creator ? (
            <Link
              href={`/creators/${task.creator.username}`}
              className="flex items-center gap-2.5 min-w-0 group/creator"
            >
              <CreatorAvatar
                name={task.creator.displayName}
                username={task.creator.username}
                avatarUrl={task.creator.user?.avatarUrl}
                available
                size="sm"
              />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-[#111827] group-hover/creator:text-[#1e3a8a] truncate flex items-center gap-1">
                  <span className="truncate">{task.creator.displayName}</span>
                  <BadgeCheck className="w-3.5 h-3.5 text-[#0f766e] shrink-0" />
                </span>
                <span className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                  <span className="font-tech text-stone-700">
                    {task.creator.ratingAverage.toFixed(1)}
                  </span>
                </span>
              </div>
            </Link>
          ) : (
            <span className="text-xs text-stone-500">Vetted Creator</span>
          )}

          <Link
            href={`/tasks/${task.slug}`}
            className="inline-flex items-center gap-1.5 text-right shrink-0 group/price"
          >
            <span className="font-tech text-[15px] font-bold text-[#111827] group-hover:text-[#1e3a8a] transition-colors">
              {formatKes(pricing.totalPayable, task.currency)}
            </span>
            <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-[#1e3a8a] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </Link>
        </div>
      </div>
    </article>
  );
}

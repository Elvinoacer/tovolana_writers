# Code Bundle: `app/explore/page.tsx`

> **Primary Entry:** `app/explore/page.tsx`  
> **Total Files Included:** 10  
> **Total Lines of Code:** 2,748 lines  
> **Total Size:** 81.9 KB  
> **Last Updated:** 2026-11-17 12:40:36 UTC  
> **Mode:** ⚪ Single Export

## Table of Contents & File Register

| # | Relative File Path | Role | Lines | Size |
|---|--------------------|------|-------|------|
| 1 | [`app/explore/page.tsx`](#1-app-explore-page-tsx) | **Entry Page** | 300 | 10.0 KB |
| 2 | [`components/TaskCard.tsx`](#2-components-taskcard-tsx) | **Sub-Component** | 218 | 8.9 KB |
| 3 | [`components/ui/Badges.tsx`](#3-components-ui-badges-tsx) | **UI Primitive Component** | 218 | 6.2 KB |
| 4 | [`components/ui/EditorialVisuals.tsx`](#4-components-ui-editorialvisuals-tsx) | **UI Primitive Component** | 476 | 14.7 KB |
| 5 | [`lib/auth.ts`](#5-lib-auth-ts) | **Domain / Infrastructure Library** | 343 | 8.7 KB |
| 6 | [`lib/db.ts`](#6-lib-db-ts) | **Domain / Infrastructure Library** | 52 | 1.5 KB |
| 7 | [`lib/env.ts`](#7-lib-env-ts) | **Domain / Infrastructure Library** | 119 | 4.1 KB |
| 8 | [`lib/pricing.ts`](#8-lib-pricing-ts) | **Domain / Infrastructure Library** | 546 | 15.3 KB |
| 9 | [`lib/upload-constants.ts`](#9-lib-upload-constants-ts) | **Domain / Infrastructure Library** | 455 | 11.9 KB |
| 10 | [`neon.ts`](#10-neon-ts) | **Configuration / Schema** | 21 | 0.5 KB |

---

<a id="1-app-explore-page-tsx"></a>
## 1. `app/explore/page.tsx`

> **Relative Path:** `app/explore/page.tsx`  
> **Role:** Entry Page  
> **Language:** `tsx` | **Lines:** 300 | **Size:** 10.0 KB

```tsx
import React from "react";
import Link from "next/link";
import { Crown, Filter, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isUserProActive } from "@/lib/pricing";
import { TaskCard } from "@/components/TaskCard";

export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const categorySlug =
    typeof sp.category === "string" ? sp.category.trim() : "all";
  const pricingType =
    typeof sp.pricingType === "string" ? sp.pricingType : "ALL";
  const sort = typeof sp.sort === "string" ? sp.sort : "newest";
  const maxPriceRaw = typeof sp.maxPrice === "string" ? sp.maxPrice : "";
  const maxPrice = maxPriceRaw ? Number(maxPriceRaw) : undefined;

  const user = await getCurrentUser();
  const userIsPro = user
    ? isUserProActive(user.membershipTier, user.proExpiresAt)
    : false;
  const now = new Date();

  const where: Prisma.TaskListingWhereInput = {
    status: "PUBLISHED",
    validUntil: { gt: now },
    ...(!userIsPro
      ? {
          OR: [
            { proEarlyAccessUntil: null },
            { proEarlyAccessUntil: { lte: now } },
          ],
        }
      : {}),
  };

  if (q) {
    where.AND = [
      {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { shortDescription: { contains: q, mode: "insensitive" } },
          { serviceType: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  if (categorySlug && categorySlug !== "all") {
    where.category = { slug: categorySlug };
  }
  if (pricingType === "FIXED" || pricingType === "QUOTE_BASED") {
    where.pricingType = pricingType;
  }
  if (maxPrice !== undefined && !Number.isNaN(maxPrice) && maxPrice > 0) {
    where.basePrice = { lte: maxPrice };
  }

  const orderBy: Prisma.TaskListingOrderByWithRelationInput =
    sort === "price_asc"
      ? { basePrice: "asc" }
      : sort === "price_desc"
        ? { basePrice: "desc" }
        : sort === "fastest"
          ? { deliveryTurnaroundDays: "asc" }
          : { publishedAt: "desc" };

  const [config, categories, tasks] = await Promise.all([
    db.platformConfig.findUnique({ where: { id: "global" } }),
    db.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.taskListing.findMany({
      where,
      orderBy,
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
    }),
  ]);

  const hasFilters = Boolean(
    q || categorySlug !== "all" || pricingType !== "ALL" || maxPriceRaw
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-reveal">
      {/* Compact Header */}
      <div className="editorial-card p-6 bg-white ink-grid-bg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-tech uppercase tracking-wider text-[#1e3a8a]">
            <Sparkles className="w-3.5 h-3.5" />
            Verified Marketplace
          </span>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold mt-1 text-[#111827]">
            Explore Writing Services
          </h1>
        </div>
        {!userIsPro && (
          <Link
            href="/membership"
            className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-amber-50 text-amber-950 border border-amber-300 hover:bg-amber-100 transition-colors shrink-0"
          >
            <Crown className="w-4 h-4 text-amber-700" />
            Pro saves 50% on platform fees
          </Link>
        )}
      </div>

      {/* Visual Category Pills Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Link
          href="/explore"
          className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
            categorySlug === "all"
              ? "bg-[#111827] text-white border-[#111827]"
              : "bg-white text-stone-700 border-[#e6e0d4] hover:border-[#1e3a8a]"
          }`}
        >
          All Disciplines
        </Link>
        {categories.map((cat) => {
          const active = categorySlug === cat.slug;
          return (
            <Link
              key={cat.id}
              href={`/explore?category=${cat.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                active
                  ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                  : "bg-white text-stone-700 border-[#e6e0d4] hover:border-[#1e3a8a]"
              }`}
            >
              {cat.name}
            </Link>
          );
        })}
      </div>

      {/* Filter Engine Form */}
      <form
        method="GET"
        action="/explore"
        className="editorial-card p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end bg-white"
      >
        <div className="lg:col-span-2">
          <label className="block text-[11px] font-tech uppercase text-stone-500 mb-1">
            Keyword
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Literature review, APA, RFP..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[#e6e0d4] bg-[#faf7f2] focus:outline-none focus:border-[#1e3a8a]"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-tech uppercase text-stone-500 mb-1">
            Discipline
          </label>
          <select
            name="category"
            defaultValue={categorySlug}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[#e6e0d4] bg-[#faf7f2] focus:outline-none focus:border-[#1e3a8a]"
          >
            <option value="all">All Active</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-tech uppercase text-stone-500 mb-1">
            Pricing
          </label>
          <select
            name="pricingType"
            defaultValue={pricingType}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[#e6e0d4] bg-[#faf7f2]"
          >
            <option value="ALL">Fixed &amp; Quote</option>
            <option value="FIXED">Fixed Price</option>
            <option value="QUOTE_BASED">Custom Quote</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-tech uppercase text-stone-500 mb-1">
            Max Base (KES)
          </label>
          <input
            type="number"
            name="maxPrice"
            defaultValue={maxPriceRaw}
            placeholder="8000"
            className="w-full px-3 py-2 text-sm rounded-xl border border-[#e6e0d4] bg-[#faf7f2] font-tech"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[11px] font-tech uppercase text-stone-500 mb-1">
              Sort
            </label>
            <select
              name="sort"
              defaultValue={sort}
              className="w-full px-2.5 py-2 text-sm rounded-xl border border-[#e6e0d4] bg-[#faf7f2]"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Lowest KES</option>
              <option value="price_desc">Highest KES</option>
              <option value="fastest">Fastest</option>
            </select>
          </div>
          <button
            type="submit"
            className="btn-primary self-end px-4 py-2 text-sm"
          >
            <Filter className="w-3.5 h-3.5" />
            Go
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between text-xs text-stone-600">
        <span className="inline-flex items-center gap-1.5 font-tech">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {tasks.length} service{tasks.length === 1 ? "" : "s"} matched
        </span>
        {hasFilters && (
          <Link
            href="/explore"
            className="font-semibold text-[#1e3a8a] hover:underline"
          >
            Clear Filters
          </Link>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="editorial-card p-12 text-center space-y-4">
          <h3 className="font-editorial text-xl font-semibold">
            No matching services found
          </h3>
          <Link href="/explore" className="btn-primary px-5 py-2.5 text-sm">
            Reset Directory Filters
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              standardFeePct={config?.standardServiceFeePct ?? 10}
              proDiscountPct={config?.proFeeDiscountPct ?? 50}
              userIsPro={userIsPro}
            />
          ))}
        </div>
      )}
    </div>
  );
}

```

---

<a id="2-components-taskcard-tsx"></a>
## 2. `components/TaskCard.tsx`

> **Relative Path:** `components/TaskCard.tsx`  
> **Role:** Sub-Component  
> **Language:** `tsx` | **Lines:** 218 | **Size:** 8.9 KB

```tsx
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

```

---

<a id="3-components-ui-badges-tsx"></a>
## 3. `components/ui/Badges.tsx`

> **Relative Path:** `components/ui/Badges.tsx`  
> **Role:** UI Primitive Component  
> **Language:** `tsx` | **Lines:** 218 | **Size:** 6.2 KB

```tsx
import React from "react";
import { Calendar, Clock, Crown, ShieldCheck } from "lucide-react";
import { getDeadlineHoursLeft } from "@/lib/pricing";

export function formatKes(amount: number, currency = "KES"): string {
  return `${currency} ${Math.round(amount).toLocaleString("en-KE")}`;
}

export function formatShortDate(date: string | Date | null | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_STYLES: Record<string, { chip: string; dot: string }> = {
  PUBLISHED: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  APPROVED: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  COMPLETED: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  COMPLETE: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  AVAILABLE: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  PAID: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  ACTIVE: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  IN_PROGRESS: {
    chip: "bg-blue-50 text-blue-900 border-blue-200",
    dot: "bg-blue-600",
  },
  DELIVERED: {
    chip: "bg-indigo-50 text-indigo-900 border-indigo-200",
    dot: "bg-indigo-600",
  },
  PENDING_REVIEW: {
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  PENDING_PAYMENT: {
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  PENDING_ESCROW: {
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  UNDER_REVIEW: {
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  PAID_AWAITING_ACCEPTANCE: {
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  REVISION_REQUESTED: {
    chip: "bg-orange-50 text-orange-800 border-orange-200",
    dot: "bg-orange-500",
  },
  CHANGES_REQUESTED: {
    chip: "bg-orange-50 text-orange-800 border-orange-200",
    dot: "bg-orange-500",
  },
  EXPIRED: {
    chip: "bg-stone-100 text-stone-700 border-stone-300",
    dot: "bg-stone-500",
  },
  ARCHIVED: {
    chip: "bg-slate-100 text-slate-700 border-slate-300",
    dot: "bg-slate-500",
  },
  DRAFT: {
    chip: "bg-stone-100 text-stone-600 border-stone-200",
    dot: "bg-stone-400",
  },
  DISPUTED: {
    chip: "bg-rose-50 text-rose-800 border-rose-200",
    dot: "bg-rose-600",
  },
  OPEN: {
    chip: "bg-rose-50 text-rose-800 border-rose-200",
    dot: "bg-rose-600",
  },
  REJECTED: {
    chip: "bg-rose-50 text-rose-800 border-rose-200",
    dot: "bg-rose-600",
  },
  SUSPENDED: {
    chip: "bg-rose-50 text-rose-800 border-rose-200",
    dot: "bg-rose-600",
  },
  CANCELLED: {
    chip: "bg-stone-100 text-stone-600 border-stone-200",
    dot: "bg-stone-400",
  },
  REFUNDED: {
    chip: "bg-purple-50 text-purple-800 border-purple-200",
    dot: "bg-purple-600",
  },
};

export function StatusPill({ status }: { status: string }) {
  const tone = STATUS_STYLES[status] || {
    chip: "bg-stone-100 text-stone-700 border-stone-200",
    dot: "bg-stone-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border tracking-tight ${tone.chip}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function ProBadge({ label = "PRO" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
      <Crown className="w-3 h-3 text-amber-700" />
      {label}
    </span>
  );
}

export function VettedCreatorBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
      <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
      Vetted Writer
    </span>
  );
}

export function ListingValidityTag({
  validUntil,
  validityType,
}: {
  validUntil: string | Date | null | undefined;
  validityType?: string;
}) {
  return (
    <div
      title="Listing validity controls public discovery window only; confirmed bookings remain protected until their own delivery deadline."
      className="inline-flex items-center gap-1.5 text-[11px] text-stone-600 bg-stone-100/90 px-2.5 py-1 rounded-lg border border-stone-200 font-tech"
    >
      <Calendar className="w-3 h-3 text-stone-500 shrink-0" />
      <span>
        Valid <strong className="text-stone-800">{formatShortDate(validUntil)}</strong>
        {validityType
          ? ` · ${validityType
              .replace("STANDARD_", "")
              .replace("SHORT_", "")
              .replace("ADMIN_", "")}`
          : ""}
      </span>
    </div>
  );
}

export function BookingDeadlineTag({
  deadline,
  status,
}: {
  deadline: string | Date;
  status: string;
}) {
  const d = typeof deadline === "string" ? new Date(deadline) : deadline;
  const isCompleted =
    status === "COMPLETED" || status === "REFUNDED" || status === "CANCELLED";
  const hoursLeft = getDeadlineHoursLeft(d);

  const tone = isCompleted
    ? "bg-stone-100 text-stone-700 border-stone-200"
    : hoursLeft < 0
      ? "bg-rose-50 text-rose-800 border-rose-200"
      : hoursLeft < 48
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-blue-50 text-blue-900 border-blue-200";

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border font-tech ${tone}`}
    >
      <Clock className="w-3 h-3 shrink-0" />
      <span>
        Due <strong>{formatShortDate(d)}</strong>
        {!isCompleted && hoursLeft >= 0
          ? ` (${hoursLeft}h)`
          : !isCompleted && hoursLeft < 0
            ? " (Overdue)"
            : ""}
      </span>
    </div>
  );
}

```

---

<a id="4-components-ui-editorialvisuals-tsx"></a>
## 4. `components/ui/EditorialVisuals.tsx`

> **Relative Path:** `components/ui/EditorialVisuals.tsx`  
> **Role:** UI Primitive Component  
> **Language:** `tsx` | **Lines:** 476 | **Size:** 14.7 KB

```tsx
import React from "react";
import Image from "next/image";
import { isAllowedNextImageSrc } from "@/lib/upload-constants";
import {
  Award,
  BookOpen,
  Briefcase,
  Check,
  CheckCircle2,
  Compass,
  Feather,
  FileSearch,
  FlaskConical,
  Lock,
  PenTool,
  Sparkles,
} from "lucide-react";

interface DisciplineVisualConfig {
  gradient: string;
  accentBg: string;
  accentText: string;
  patternStroke: string;
  photoSrc: string;
  tag: string;
}

const DISCIPLINE_THEMES: Record<string, DisciplineVisualConfig> = {
  "academic-writing": {
    gradient: "from-[#1e3a8a]/80 via-[#1d4ed8]/55 to-[#0f172a]/90",
    accentBg: "bg-black/45 border border-white/20",
    accentText: "text-white",
    patternStroke: "#93c5fd",
    photoSrc: "/images/photos/cat-academic.jpg",
    tag: "Scholarly Monograph",
  },
  "essays-and-assignments": {
    gradient: "from-[#0f766e]/75 via-[#0d9488]/45 to-[#092927]/90",
    accentBg: "bg-black/45 border border-white/20",
    accentText: "text-white",
    patternStroke: "#5eead4",
    photoSrc: "/images/photos/cat-essays.jpg",
    tag: "Structured Rhetoric",
  },
  "research-papers": {
    gradient: "from-[#312e81]/80 via-[#4338ca]/50 to-[#0b1120]/90",
    accentBg: "bg-black/45 border border-white/20",
    accentText: "text-white",
    patternStroke: "#a5b4fc",
    photoSrc: "/images/photos/cat-research.jpg",
    tag: "Empirical Inquiry",
  },
  "articles-and-blog-writing": {
    gradient: "from-[#92400e]/75 via-[#b45309]/45 to-[#1c1917]/90",
    accentBg: "bg-black/45 border border-white/20",
    accentText: "text-white",
    patternStroke: "#fde68a",
    photoSrc: "/images/photos/cat-articles.jpg",
    tag: "Editorial Voice",
  },
  "business-writing-and-proposals": {
    gradient: "from-[#0f172a]/80 via-[#1e293b]/55 to-[#0b1120]/92",
    accentBg: "bg-black/45 border border-white/20",
    accentText: "text-white",
    patternStroke: "#7dd3fc",
    photoSrc: "/images/photos/cat-business.jpg",
    tag: "Executive Strategy",
  },
  "editing-and-proofreading": {
    gradient: "from-[#881337]/75 via-[#be123c]/45 to-[#1c0810]/90",
    accentBg: "bg-black/45 border border-white/20",
    accentText: "text-white",
    patternStroke: "#fda4af",
    photoSrc: "/images/photos/cat-editing.jpg",
    tag: "Precision Polish",
  },
  "other-services": {
    gradient: "from-[#1e293b]/75 via-[#334155]/45 to-[#0f172a]/90",
    accentBg: "bg-black/45 border border-white/20",
    accentText: "text-white",
    patternStroke: "#cbd5e1",
    photoSrc: "/images/photos/cat-other.jpg",
    tag: "Bespoke Craft",
  },
};

function getTheme(slug: string): DisciplineVisualConfig {
  if (DISCIPLINE_THEMES[slug]) return DISCIPLINE_THEMES[slug];
  for (const [k, val] of Object.entries(DISCIPLINE_THEMES)) {
    if (slug.includes(k.split("-")[0])) return val;
  }
  return DISCIPLINE_THEMES["other-services"];
}

export function getCategoryPhotoSrc(slug: string): string {
  return getTheme(slug).photoSrc;
}

function DisciplineIcon({ slug }: { slug: string }) {
  const cls = "w-4 h-4";
  if (slug.includes("academic")) return <BookOpen className={cls} />;
  if (slug.includes("essay")) return <PenTool className={cls} />;
  if (slug.includes("research")) return <FlaskConical className={cls} />;
  if (slug.includes("article")) return <Feather className={cls} />;
  if (slug.includes("business")) return <Briefcase className={cls} />;
  if (slug.includes("editing")) return <FileSearch className={cls} />;
  return <Compass className={cls} />;
}

export function CategoryCoverArt({
  slug,
  name,
  heightClass = "h-36",
  children,
}: {
  slug: string;
  name: string;
  heightClass?: string;
  children?: React.ReactNode;
}) {
  const theme = getTheme(slug);

  return (
    <div
      className={`relative overflow-hidden bg-[#111827] ${heightClass} p-4 flex flex-col justify-between select-none`}
    >
      {/* Real Discipline Photograph */}
      <Image
        src={theme.photoSrc}
        alt={`${name} writing studio photography`}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 420px"
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />

      {/* Directional Legibility & High-Contrast Scrim */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-gradient-to-t ${theme.gradient}`}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-black/75"
      />

      <div className="relative z-10 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${theme.accentBg} ${theme.accentText} backdrop-blur-md text-[11px] font-semibold tracking-tight shadow-xs`}
        >
          <DisciplineIcon slug={slug} />
          <span className="truncate max-w-[180px]">{name}</span>
        </span>
      </div>

      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
}

const AVATAR_BG_TONES = [
  "bg-[#1e293b]",
  "bg-[#1e3a8a]",
  "bg-[#0f766e]",
  "bg-[#312e81]",
  "bg-[#7c2d12]",
];

function getMonogramInitials(name: string): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "TV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function CreatorAvatar({
  name,
  username,
  avatarUrl,
  available,
  size = "md",
}: {
  name: string;
  username?: string;
  avatarUrl?: string | null;
  available?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const seedStr = (username || name || "T").toLowerCase();
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) % 997;
  }
  const bgTone = AVATAR_BG_TONES[hash % AVATAR_BG_TONES.length];

  const dims =
    size === "lg"
      ? "w-16 h-16 rounded-2xl"
      : size === "sm"
        ? "w-8 h-8 rounded-full"
        : "w-10 h-10 rounded-xl";
  const textSize =
    size === "lg" ? "text-lg" : size === "sm" ? "text-[11px]" : "text-xs";
  const imgSize = size === "lg" ? 64 : size === "sm" ? 32 : 40;

  const trimmedAvatarUrl = avatarUrl?.trim() || "";
  const hasAvatarImage = isAllowedNextImageSrc(trimmedAvatarUrl);

  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={`${dims} relative overflow-hidden ${bgTone} shadow-sm ring-2 ring-white flex items-center justify-center`}
      >
        {hasAvatarImage ? (
          <Image
            src={trimmedAvatarUrl}
            alt={name}
            width={imgSize}
            height={imgSize}
            unoptimized={Boolean(trimmedAvatarUrl.startsWith("/api/"))}
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            aria-label={name}
            className={`font-tech font-semibold tracking-wider text-white select-none leading-none ${textSize}`}
          >
            {getMonogramInitials(name)}
          </span>
        )}
      </div>
      {available !== undefined && (
        <span
          title={available ? "Accepting Bookings" : "At Capacity"}
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
            available ? "bg-emerald-500" : "bg-stone-400"
          }`}
        />
      )}
    </div>
  );
}

export function ScoreRing({
  score,
  max = 100,
  size = 86,
  strokeWidth = 7,
  label,
  sublabel,
  tone = "emerald",
}: {
  score: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  tone?: "emerald" | "blue" | "gold" | "rose";
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / max));
  const dash = circ * pct;

  const strokeColor =
    tone === "blue"
      ? "#1e3a8a"
      : tone === "gold"
        ? "#b45309"
        : tone === "rose"
          ? "#be123c"
          : "#0f766e";

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#e6e0d4"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-tech text-sm font-bold text-[#111827] leading-none">
            {label ?? `${Math.round(score)}${max === 100 ? "%" : ""}`}
          </span>
        </div>
      </div>
      {sublabel && (
        <span className="text-[11px] font-medium text-stone-600 text-center leading-tight">
          {sublabel}
        </span>
      )}
    </div>
  );
}

const PIPELINE_STEPS = [
  { label: "Booked", short: "Booked" },
  { label: "Escrow", short: "Escrow" },
  { label: "In Progress", short: "Active" },
  { label: "Delivered", short: "Delivered" },
  { label: "Settled", short: "Done" },
];

export function getEscrowStepIndex(status: string): number {
  switch (status) {
    case "PENDING_PAYMENT":
      return 0;
    case "PAID_AWAITING_ACCEPTANCE":
      return 1;
    case "IN_PROGRESS":
    case "REVISION_REQUESTED":
      return 2;
    case "DELIVERED":
      return 3;
    case "COMPLETED":
      return 4;
    default:
      return 1;
  }
}

export function EscrowStepVisualizer({
  status,
  compact = false,
}: {
  status: string;
  compact?: boolean;
}) {
  const activeStep = getEscrowStepIndex(status);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-1">
        {PIPELINE_STEPS.map((step, idx) => {
          const done = idx < activeStep || (status === "COMPLETED" && idx === 4);
          const current = idx === activeStep && status !== "COMPLETED";
          return (
            <React.Fragment key={step.label}>
              <div className="flex flex-col items-center gap-1 min-w-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-tech font-bold border transition-all ${
                    done
                      ? "bg-[#0f766e] border-[#0f766e] text-white"
                      : current
                        ? "bg-[#1e3a8a] border-[#1e3a8a] text-white ring-4 ring-blue-100"
                        : "bg-[#faf7f2] border-[#e6e0d4] text-stone-400"
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                {!compact && (
                  <span
                    className={`text-[10px] font-medium truncate ${
                      done || current ? "text-[#111827]" : "text-stone-400"
                    }`}
                  >
                    {step.short}
                  </span>
                )}
              </div>
              {idx < PIPELINE_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 rounded-full ${
                    idx < activeStep ? "bg-[#0f766e]" : "bg-[#e6e0d4]"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export function HeroManuscriptShowcase({
  creatorsCount,
  publishedCount,
  bookingsCount,
}: {
  creatorsCount: number;
  publishedCount: number;
  bookingsCount: number;
}) {
  return (
    <div className="relative animate-reveal stagger-2">
      <div className="editorial-card overflow-hidden bg-white p-2 sm:p-3">
        <div className="relative rounded-2xl overflow-hidden bg-[#faf7f2] aspect-[4/3]">
          <Image
            src="/images/photos/hero-nature-desk.jpg"
            alt="Tovolana Writers vetted editorial workspace with laptop and planning notes"
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            priority
            className="object-cover"
          />
        </div>

        {/* Visual Live Telemetry Strip */}
        <div className="grid grid-cols-3 gap-2 pt-2.5">
          <div className="rounded-xl bg-[#faf7f2] border border-[#e6e0d4] px-3 py-2.5 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0f766e] shrink-0">
              <Award className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-tech text-base font-bold text-[#111827] leading-none">
                {creatorsCount}
              </p>
              <p className="text-[11px] text-stone-500 truncate mt-1">
                Vetted Writers
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#faf7f2] border border-[#e6e0d4] px-3 py-2.5 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1e3a8a] shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-tech text-base font-bold text-[#111827] leading-none">
                {publishedCount}
              </p>
              <p className="text-[11px] text-stone-500 truncate mt-1">
                Active Services
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#faf7f2] border border-[#e6e0d4] px-3 py-2.5 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-[#b45309] shrink-0">
              <Lock className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-tech text-base font-bold text-[#111827] leading-none">
                {bookingsCount}
              </p>
              <p className="text-[11px] text-stone-500 truncate mt-1">
                Escrow Orders
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Floating Guarantee Pill */}
      <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#111827] text-white text-xs font-medium shadow-lg absolute -bottom-3 left-5 animate-float-subtle">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>Valid Until ≠ Delivery Deadline Guaranteed</span>
      </div>
    </div>
  );
}

```

---

<a id="5-lib-auth-ts"></a>
## 5. `lib/auth.ts`

> **Relative Path:** `lib/auth.ts`  
> **Role:** Domain / Infrastructure Library  
> **Language:** `ts` | **Lines:** 343 | **Size:** 8.7 KB

```ts
import crypto from "crypto";
import { cookies } from "next/headers";
import type { AdminScope, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function signSessionToken(userId: string): string {
  const payload = JSON.stringify({
    userId,
    exp: Date.now() + SESSION_TTL_MS,
  });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", env.authSecret)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined | null
): { userId: string; exp: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac("sha256", env.authSecret)
    .update(payloadB64)
    .digest("base64url");

  const sigBuf = Buffer.from(sigB64);
  const expectedBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as { userId?: string; exp?: number };
    if (!parsed.userId || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return { userId: parsed.userId, exp: parsed.exp };
  } catch {
    return null;
  }
}

export function extractSessionTokenFromCookieHeader(
  cookieHeader: string | null | undefined
): string | null {
  if (!cookieHeader) return null;
  const cookieName = env.sessionCookieName;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${cookieName}=`)) {
      return decodeURIComponent(part.slice(cookieName.length + 1));
    }
  }
  return null;
}

export function buildSessionCookieHeader(token: string): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${env.sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function buildClearSessionCookieHeader(): string {
  return `${env.sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function getCurrentUser(request?: Request) {
  let token: string | null | undefined = null;

  if (request) {
    token = extractSessionTokenFromCookieHeader(request.headers.get("cookie"));
    if (!token) {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7).trim();
      }
    }
  } else {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(env.sessionCookieName)?.value ?? null;
    } catch {
      token = null;
    }
  }

  const verified = verifySessionToken(token);
  if (!verified) return null;

  const user = await db.user.findUnique({
    where: { id: verified.userId },
    include: {
      customerProfile: true,
      creatorProfile: true,
    },
  });

  if (!user) return null;

  // Enforce automatic Pro expiry fallback cleanly to FREE without losing history
  if (
    user.membershipTier === "PRO" &&
    user.proExpiresAt &&
    user.proExpiresAt.getTime() <= Date.now()
  ) {
    return db.user.update({
      where: { id: user.id },
      data: { membershipTier: "FREE" },
      include: {
        customerProfile: true,
        creatorProfile: true,
      },
    });
  }

  return user;
}

export type AuthenticatedUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>;

export async function requireAuth(
  request?: Request
): Promise<AuthenticatedUser> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new AuthError("UNAUTHORIZED", "Authentication required.", 401);
  }
  if (user.status === "SUSPENDED") {
    throw new AuthError(
      "ACCOUNT_SUSPENDED",
      "Your account is currently suspended. Contact platform support.",
      403
    );
  }
  return user;
}

export async function requireRole(
  role: UserRole,
  request?: Request
): Promise<AuthenticatedUser> {
  const user = await requireAuth(request);
  if (!user.roles.includes(role)) {
    throw new AuthError(
      "FORBIDDEN",
      `This action requires the ${role} role.`,
      403
    );
  }
  return user;
}

export async function requireAdminScope(
  scope: AdminScope,
  request?: Request
): Promise<AuthenticatedUser> {
  const user = await requireRole("ADMIN", request);
  if (
    !user.adminScopes.includes("SUPER_ADMIN") &&
    !user.adminScopes.includes(scope)
  ) {
    throw new AuthError(
      "INSUFFICIENT_ADMIN_SCOPE",
      `Administrator scope ${scope} is required.`,
      403
    );
  }
  return user;
}

export function hashToken(raw: string): string {
  return crypto
    .createHash("sha256")
    .update(`${raw}:${env.authSecret}`)
    .digest("hex");
}

export async function createEmailVerificationToken(
  userId: string,
  email: string
): Promise<string> {
  const rawToken = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashToken(rawToken);
  await db.verificationToken.create({
    data: {
      userId,
      identifier: email.toLowerCase(),
      tokenHash,
      type: "EMAIL_VERIFY",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return rawToken;
}

export async function consumeEmailVerificationToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const record = await db.verificationToken.findUnique({
    where: { tokenHash },
  });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return null;
  }

  await db.$transaction(async (tx) => {
    await tx.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    if (record.userId) {
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerified: new Date() },
      });
    }
  });

  return record;
}

export async function createPhoneOtp(
  userId: string,
  phone: string,
  purpose: string = "PHONE_VERIFY"
): Promise<{ code: string; expiresAt: Date }> {
  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = hashToken(`${userId}:${phone}:${code}`);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.otpVerification.create({
    data: {
      userId,
      phone,
      codeHash,
      purpose,
      expiresAt,
    },
  });

  return { code, expiresAt };
}

export async function verifyPhoneOtp(
  userId: string,
  phone: string,
  code: string
): Promise<{ ok: boolean; reason?: string }> {
  const latest = await db.otpVerification.findFirst({
    where: {
      userId,
      phone,
      verifiedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) {
    return { ok: false, reason: "OTP_NOT_FOUND" };
  }
  if (latest.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "OTP_EXPIRED" };
  }
  if (latest.attempts >= latest.maxAttempts) {
    return { ok: false, reason: "OTP_MAX_ATTEMPTS" };
  }

  const candidateHash = hashToken(`${userId}:${phone}:${code.trim()}`);
  const matches = crypto.timingSafeEqual(
    Buffer.from(candidateHash, "hex"),
    Buffer.from(latest.codeHash, "hex")
  );

  if (!matches) {
    await db.otpVerification.update({
      where: { id: latest.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "OTP_INVALID" };
  }

  await db.$transaction([
    db.otpVerification.update({
      where: { id: latest.id },
      data: { verifiedAt: new Date() },
    }),
    db.user.update({
      where: { id: userId },
      data: { phone, phoneVerified: new Date() },
    }),
  ]);

  return { ok: true };
}

export class AuthError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function sanitizeCallbackUrl(url: string | null | undefined): string {
  if (!url) return "/dashboard";
  if (url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }
  return "/dashboard";
}

```

---

<a id="6-lib-db-ts"></a>
## 6. `lib/db.ts`

> **Relative Path:** `lib/db.ts`  
> **Role:** Domain / Infrastructure Library  
> **Language:** `ts` | **Lines:** 52 | **Size:** 1.5 KB

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseEnv } from "@neon/env";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import neonConfig from "../neon";

const globalForPrisma = globalThis as unknown as {
  prismaPool?: Pool;
  prisma?: PrismaClient;
};

function resolveConnectionString(): string | undefined {
  if (process.env.DATABASE_URL) {
    return parseEnv(neonConfig, ["DATABASE_URL"]).postgres.databaseUrl;
  }
  return process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL || undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString = resolveConnectionString();

  if (!globalForPrisma.prismaPool) {
    const pool = new Pool(
      connectionString
        ? { connectionString, max: 10, connectionTimeoutMillis: 15_000 }
        : { max: 10, connectionTimeoutMillis: 15_000 }
    );
    attachDatabasePool(pool);
    globalForPrisma.prismaPool = pool;
  }

  const adapter = new PrismaPg(globalForPrisma.prismaPool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export async function closeDbConnections() {
  await db.$disconnect();
  if (globalForPrisma.prismaPool) {
    await globalForPrisma.prismaPool.end();
  }
}

```

---

<a id="7-lib-env-ts"></a>
## 7. `lib/env.ts`

> **Relative Path:** `lib/env.ts`  
> **Role:** Domain / Infrastructure Library  
> **Language:** `ts` | **Lines:** 119 | **Size:** 4.1 KB

```ts
export { MAX_BROWSER_UPLOAD_BYTES } from "./upload-constants";

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL || "",
  directUrl:
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL ||
    "",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  upstashRestUrl: process.env.UPSTASH_REDIS_REST_URL || "",
  upstashRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  authSecret:
    process.env.AUTH_SECRET || "tovolana-dev-fallback-secret-change-in-prod",
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "tovolana_session",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`,
  intasendPublishableKey: process.env.INTASEND_PUBLISHABLE_KEY || "",
  intasendSecretKey: process.env.INTASEND_SECRET_KEY || "",
  intasendIsTest: process.env.INTASEND_IS_TEST !== "false",
  intasendWebhookChallenge:
    process.env.INTASEND_WEBHOOK_CHALLENGE || "dev-intasend-challenge",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "",
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
  firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(
    /\\n/g,
    "\n"
  ),
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom:
    process.env.EMAIL_FROM || "Tovolana Writers <noreply@tovolana.example.com>",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || "587"),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smsProviderApiKey: process.env.SMS_PROVIDER_API_KEY || "",
  smsSenderId: process.env.SMS_SENDER_ID || "TOVOLANA",
  storageSigningSecret:
    process.env.STORAGE_SIGNING_SECRET ||
    process.env.AUTH_SECRET ||
    "tovolana-storage-signing-secret",
  storageBucketUrl: process.env.STORAGE_BUCKET_URL || "",
  cronSecret: process.env.CRON_SECRET || "tovolana-cron-secret",
  r2AccountId: process.env.R2_ACCOUNT_ID || "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  r2BucketName: process.env.R2_BUCKET_NAME || "",
  r2PublicUrl:
    process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "",
  nextPublicR2PublicUrl:
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || "",
  r2Endpoint:
    process.env.R2_ENDPOINT ||
    (process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : ""),
  r2KeyPrefix:
    (process.env.R2_KEY_PREFIX || "tovolana_writers").replace(
      /^\/+|\/+$/g,
      ""
    ) || "tovolana_writers",
};

function isPlaceholder(value: string | undefined | null): boolean {
  if (!value) return true;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) return true;
  return (
    trimmed.includes("your-") ||
    trimmed.includes("replace-") ||
    trimmed.includes("changeme") ||
    trimmed.includes("example")
  );
}

export function hasR2Config(
  config: {
    r2AccountId?: string;
    r2Endpoint?: string;
    r2AccessKeyId?: string;
    r2SecretAccessKey?: string;
    r2BucketName?: string;
  } = env
): boolean {
  const hasAccountOrEndpoint =
    !isPlaceholder(config.r2AccountId) || !isPlaceholder(config.r2Endpoint);

  return (
    hasAccountOrEndpoint &&
    !isPlaceholder(config.r2AccessKeyId) &&
    !isPlaceholder(config.r2SecretAccessKey) &&
    !isPlaceholder(config.r2BucketName)
  );
}

export function hasLiveIntaSendKeys(): boolean {
  return (
    Boolean(env.intasendPublishableKey) &&
    Boolean(env.intasendSecretKey) &&
    !env.intasendSecretKey.startsWith("replace-")
  );
}

export function hasGoogleOAuthKeys(): boolean {
  return Boolean(env.googleClientId) && Boolean(env.googleClientSecret);
}

export function hasFirebaseAdminKeys(): boolean {
  return (
    Boolean(env.firebaseProjectId) &&
    Boolean(env.firebaseClientEmail) &&
    Boolean(env.firebasePrivateKey)
  );
}

```

---

<a id="8-lib-pricing-ts"></a>
## 8. `lib/pricing.ts`

> **Relative Path:** `lib/pricing.ts`  
> **Role:** Domain / Infrastructure Library  
> **Language:** `ts` | **Lines:** 546 | **Size:** 15.3 KB

```ts
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isUserProActive(
  membershipTier: string | null | undefined,
  proExpiresAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (membershipTier !== "PRO") return false;
  if (!proExpiresAt) return true;
  const expiry =
    typeof proExpiresAt === "string" ? new Date(proExpiresAt) : proExpiresAt;
  return expiry.getTime() > now.getTime();
}

export function isFutureTimestamp(
  value: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!value) return false;
  const parsed = typeof value === "string" ? new Date(value) : value;
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > now.getTime();
}

export function getDeadlineHoursLeft(value: Date | string): number {
  const parsed = typeof value === "string" ? new Date(value) : value;
  return Math.round((parsed.getTime() - Date.now()) / (1000 * 60 * 60));
}

export const TRIPWIRE_OUTLINE_PRICE_KES = 490;
export const MILESTONE_SPLIT_RATIO = 0.25;
export const EARNINGS_TO_CONNECT_RATE_KES = 15;
export const BID_SEALED_CONNECTS_COST = 4;
export const BID_FEATURED_CONNECTS_COST = 3;

export const BOOST_CONNECTS_COSTS = {
  AVAILABLE_NOW: 5,
  FEATURED_PROFILE: 15,
  CREATOR_PLUS: 60,
} as const;

export type CheckoutMode =
  | "FULL_ESCROW"
  | "TRIPWIRE_OUTLINE"
  | "MILESTONE_SPLIT";

export interface CheckoutAddOnConfig {
  id: string;
  label: string;
  description: string;
  pricingKind: "FLAT" | "PERCENTAGE";
  value: number;
  badge?: string;
}

export const CLIENT_CHECKOUT_ADDONS: CheckoutAddOnConfig[] = [
  {
    id: "originality_report",
    label: "Originality & AI-Free Authenticity Report",
    description:
      "Official similarity & human-authorship verification PDF bundled with final delivery.",
    pricingKind: "FLAT",
    value: 450,
    badge: "Most Selected",
  },
  {
    id: "executive_summary",
    label: "1-Page Executive Summary & Key Takeaways",
    description:
      "Distilled board-ready brief highlighting core arguments, data points, and citations.",
    pricingKind: "FLAT",
    value: 850,
  },
  {
    id: "nda_sealed",
    label: "Strict NDA & Sealed Confidential Workspace",
    description:
      "Locks non-disclosure terms and keeps project files & briefs excluded from samples.",
    pricingKind: "FLAT",
    value: 600,
  },
  {
    id: "elite_writer",
    label: "Top 5% Elite Writer Guarantee",
    description:
      "Routes priority quality review and assigns top-decile rubric & rating specialists.",
    pricingKind: "PERCENTAGE",
    value: 15,
    badge: "Top Rated",
  },
  {
    id: "priority_rush",
    label: "Priority Express Rush Turnaround",
    description:
      "Halves standard delivery turnaround window with urgent milestone SLA alerts.",
    pricingKind: "PERCENTAGE",
    value: 20,
    badge: "Fastest",
  },
];

export function calculateAddOnsTotal(
  basePrice: number,
  selectedAddOnIds: string[] = []
): {
  addOnsTotal: number;
  itemized: Array<{ id: string; label: string; amount: number }>;
} {
  const uniqueIds = [...new Set(selectedAddOnIds)];
  const itemized: Array<{ id: string; label: string; amount: number }> = [];

  for (const id of uniqueIds) {
    const addon = CLIENT_CHECKOUT_ADDONS.find((item) => item.id === id);
    if (!addon) continue;
    const amount =
      addon.pricingKind === "FLAT"
        ? roundCurrency(addon.value)
        : roundCurrency(Math.max(0, basePrice) * (addon.value / 100));
    itemized.push({ id: addon.id, label: addon.label, amount });
  }

  const addOnsTotal = roundCurrency(
    itemized.reduce((sum, item) => sum + item.amount, 0)
  );
  return { addOnsTotal, itemized };
}

export interface BookingPricingInput {
  listedPrice: number;
  extraCharges?: number;
  addOnsTotal?: number;
  standardServiceFeePct: number;
  proFeeDiscountPct: number;
  serviceFeePctOverride?: number | null;
  userIsPro: boolean;
  checkoutMode?: CheckoutMode;
  creatorCommissionPct?: number;
}

export interface BookingPricingBreakdown {
  listedPrice: number;
  extraCharges: number;
  addOnsTotal: number;
  baseSubtotal: number;
  rawServiceFee: number;
  proDiscount: number;
  serviceFee: number;
  fullOrderTotal: number;
  totalPayable: number;
  remainingBalance: number;
  creatorCommission: number;
  creatorNetAmount: number;
  effectiveFeePct: number;
  checkoutMode: CheckoutMode;
}

export function calculateBookingPricing(
  input: BookingPricingInput
): BookingPricingBreakdown {
  const listedPrice = roundCurrency(Math.max(0, input.listedPrice));
  const extraCharges = roundCurrency(Math.max(0, input.extraCharges ?? 0));
  const addOnsTotal = roundCurrency(Math.max(0, input.addOnsTotal ?? 0));
  const baseSubtotal = roundCurrency(listedPrice + extraCharges);
  const checkoutMode: CheckoutMode = input.checkoutMode ?? "FULL_ESCROW";

  const feePct =
    input.serviceFeePctOverride !== null &&
    input.serviceFeePctOverride !== undefined
      ? input.serviceFeePctOverride
      : input.standardServiceFeePct;

  const rawServiceFee = roundCurrency(baseSubtotal * (feePct / 100));
  const proDiscount = input.userIsPro
    ? roundCurrency(rawServiceFee * (input.proFeeDiscountPct / 100))
    : 0;
  const fullServiceFee = roundCurrency(Math.max(0, rawServiceFee - proDiscount));
  const fullOrderTotal = roundCurrency(
    baseSubtotal + addOnsTotal + fullServiceFee
  );

  const commissionPct = Math.max(0, Math.min(50, input.creatorCommissionPct ?? 0));

  if (checkoutMode === "TRIPWIRE_OUTLINE") {
    const tripwireFee = roundCurrency(
      TRIPWIRE_OUTLINE_PRICE_KES * (input.userIsPro ? 0.05 : 0.1)
    );
    const tripwireCreatorNet = roundCurrency(
      TRIPWIRE_OUTLINE_PRICE_KES - tripwireFee
    );
    return {
      listedPrice,
      extraCharges,
      addOnsTotal,
      baseSubtotal,
      rawServiceFee,
      proDiscount,
      serviceFee: tripwireFee,
      fullOrderTotal,
      totalPayable: TRIPWIRE_OUTLINE_PRICE_KES,
      remainingBalance: roundCurrency(
        Math.max(0, fullOrderTotal - TRIPWIRE_OUTLINE_PRICE_KES)
      ),
      creatorCommission: tripwireFee,
      creatorNetAmount: tripwireCreatorNet,
      effectiveFeePct: feePct,
      checkoutMode,
    };
  }

  if (checkoutMode === "MILESTONE_SPLIT") {
    const dueNow = roundCurrency(fullOrderTotal * MILESTONE_SPLIT_RATIO);
    const depositServiceFee = roundCurrency(
      fullServiceFee * MILESTONE_SPLIT_RATIO
    );
    const depositBase = roundCurrency(baseSubtotal * MILESTONE_SPLIT_RATIO);
    const creatorCommission = roundCurrency(
      depositBase * (commissionPct / 100)
    );
    const creatorNetAmount = roundCurrency(
      Math.max(0, depositBase - creatorCommission)
    );
    return {
      listedPrice,
      extraCharges,
      addOnsTotal,
      baseSubtotal,
      rawServiceFee,
      proDiscount,
      serviceFee: depositServiceFee,
      fullOrderTotal,
      totalPayable: dueNow,
      remainingBalance: roundCurrency(Math.max(0, fullOrderTotal - dueNow)),
      creatorCommission,
      creatorNetAmount,
      effectiveFeePct: feePct,
      checkoutMode,
    };
  }

  const creatorCommission = roundCurrency(
    baseSubtotal * (commissionPct / 100)
  );
  const creatorNetAmount = roundCurrency(
    Math.max(0, baseSubtotal - creatorCommission)
  );

  return {
    listedPrice,
    extraCharges,
    addOnsTotal,
    baseSubtotal,
    rawServiceFee,
    proDiscount,
    serviceFee: fullServiceFee,
    fullOrderTotal,
    totalPayable: fullOrderTotal,
    remainingBalance: 0,
    creatorCommission,
    creatorNetAmount,
    effectiveFeePct: feePct,
    checkoutMode,
  };
}

export interface ConnectsBundle {
  id: "starter" | "growth" | "studio" | "agency";
  name: string;
  baseConnects: number;
  bonusConnects: number;
  totalConnects: number;
  priceKes: number;
  badge?: string;
  tagline: string;
}

export const CONNECTS_BUNDLES: ConnectsBundle[] = [
  {
    id: "starter",
    name: "Starter Pack",
    baseConnects: 20,
    bonusConnects: 0,
    totalConnects: 20,
    priceKes: 400,
    tagline: "Test 3–5 targeted bids & activate 1 availability pulse.",
  },
  {
    id: "growth",
    name: "Growth Pack",
    baseConnects: 60,
    bonusConnects: 5,
    totalConnects: 65,
    priceKes: 1000,
    badge: "Most Popular",
    tagline: "Win #1 boosted slots across high-budget briefs + Sealed bids.",
  },
  {
    id: "studio",
    name: "Studio Pro Pack",
    baseConnects: 150,
    bonusConnects: 25,
    totalConnects: 175,
    priceKes: 2200,
    badge: "Best Value",
    tagline: "Covers Creator Plus Pass (60⚡) + Featured Spotlight + 20 bids.",
  },
  {
    id: "agency",
    name: "Agency Power Pack",
    baseConnects: 400,
    bonusConnects: 80,
    totalConnects: 480,
    priceKes: 5000,
    tagline: "Dominate Top-3 auction placements all month at KES 10.4/Connect.",
  },
];

export function calculateRequiredConnectsForBrief(
  budgetMax: number,
  isUrgent: boolean = false
): number {
  const base = budgetMax < 5000 ? 2 : budgetMax <= 15000 ? 4 : 6;
  return base + (isUrgent ? 1 : 0);
}

const CREATOR_TIER_BONUS: Record<string, number> = {
  STANDARD: 0,
  RISING_TALENT: 10,
  TOP_RATED: 20,
  ELITE: 40,
};

export interface BidRankInput {
  boostConnects: number;
  isFeatured: boolean;
  isSealed: boolean;
  creatorTier?: string | null;
  assessmentScore?: number | null;
  ratingAverage?: number | null;
  profileCompletenessScore?: number | null;
}

export function computeBidRankScore(input: BidRankInput): number {
  const boostPoints = Math.max(0, input.boostConnects) * 10;
  const featuredPoints = input.isFeatured ? 25 : 0;
  const sealedPoints = input.isSealed ? 10 : 0;
  const tierBonus = CREATOR_TIER_BONUS[input.creatorTier || "STANDARD"] ?? 0;
  const assessmentPoints = Math.max(0, input.assessmentScore ?? 75) * 0.35;
  const ratingPoints = Math.max(0, input.ratingAverage ?? 5) * 8;
  const profilePoints =
    Math.max(0, input.profileCompletenessScore ?? 70) * 0.15;

  return (
    Math.round(
      (boostPoints +
        featuredPoints +
        sealedPoints +
        tierBonus +
        assessmentPoints +
        ratingPoints +
        profilePoints) *
        100
    ) / 100
  );
}

export interface RankableBid {
  id: string;
  creatorProfileId: string;
  boostConnects: number;
  isFeatured: boolean;
  isSealed: boolean;
  rankScore: number;
  createdAt: Date | string;
}

export type RankedBid<T extends RankableBid> = T & {
  rankPosition: number;
  totalBidders: number;
  isTopBoostedSlot: boolean;
  connectsNeededForRank1: number;
  connectsNeededForTop3: number;
};

export function rankBidsForBrief<T extends RankableBid>(
  bids: T[]
): Array<RankedBid<T>> {
  const sorted = [...bids].sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    if (b.boostConnects !== a.boostConnects) {
      return b.boostConnects - a.boostConnects;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const totalBidders = sorted.length;
  const topScore = sorted[0]?.rankScore ?? 0;
  const thirdScore = sorted[Math.min(2, Math.max(0, totalBidders - 1))]?.rankScore ?? 0;

  return sorted.map((bid, idx) => {
    const rankPosition = idx + 1;
    const isTopBoostedSlot = rankPosition <= 3 && bid.boostConnects > 0;
    const connectsNeededForRank1 =
      rankPosition === 1
        ? 0
        : Math.max(1, Math.floor((topScore - bid.rankScore) / 10) + 1);
    const connectsNeededForTop3 =
      rankPosition <= 3
        ? 0
        : Math.max(1, Math.floor((thirdScore - bid.rankScore) / 10) + 1);

    return {
      ...bid,
      rankPosition,
      totalBidders,
      isTopBoostedSlot,
      connectsNeededForRank1,
      connectsNeededForTop3,
    };
  });
}

export interface CreatorStandoutInput {
  displayName?: string | null;
  headline?: string | null;
  bio?: string | null;
  writingCategories?: string[] | null;
  portfolioSamples?: unknown;
  taglineBadge?: string | null;
  educationCredentials?: string | null;
  introVideoUrl?: string | null;
  yearsExperience?: number | null;
  responseTimeMinutes?: number | null;
  avatarUrl?: string | null;
  availableNowBadgeUntil?: Date | string | null;
  featuredProfileUntil?: Date | string | null;
}

export interface StandoutBreakdownItem {
  key: string;
  label: string;
  completed: boolean;
  points: number;
  impactHint: string;
}

export function computeCreatorProfileStandoutScore(
  profile: CreatorStandoutInput
): {
  score: number;
  tierRecommendation: string;
  breakdown: StandoutBreakdownItem[];
} {
  const samples = Array.isArray(profile.portfolioSamples)
    ? profile.portfolioSamples
    : [];
  const hasAttachment = samples.some(
    (s) =>
      typeof s === "object" &&
      s !== null &&
      Boolean((s as { attachmentUrl?: string }).attachmentUrl)
  );

  const breakdown: StandoutBreakdownItem[] = [
    {
      key: "avatar",
      label: "Professional Studio Portrait",
      completed: Boolean(profile.avatarUrl?.trim()),
      points: 10,
      impactHint: "+24% profile click-through on bidding cards",
    },
    {
      key: "bio_headline",
      label: "Detailed Editorial Bio & Headline",
      completed:
        Boolean(profile.headline && profile.headline.trim().length >= 15) &&
        Boolean(profile.bio && profile.bio.trim().length >= 60),
      points: 15,
      impactHint: "Clarifies niche expertise for high-ticket clients",
    },
    {
      key: "tagline_badge",
      label: "Signature Tagline Badge",
      completed: Boolean(profile.taglineBadge && profile.taglineBadge.trim().length >= 5),
      points: 10,
      impactHint: "Highlighted directly next to your bid rank",
    },
    {
      key: "credentials",
      label: "Domain & Academic Credentials",
      completed: Boolean(
        profile.educationCredentials &&
          profile.educationCredentials.trim().length >= 5
      ),
      points: 15,
      impactHint: "Justifies premium KES rates & Top-Writer upgrades",
    },
    {
      key: "portfolio_samples",
      label: "2+ Portfolio Excerpts with File Attachment",
      completed: samples.length >= 2 && hasAttachment,
      points: 20,
      impactHint: "Proof of craft converts hesitant first-time buyers",
    },
    {
      key: "intro_video",
      label: "Intro Pitch Video or Audio Link",
      completed: Boolean(profile.introVideoUrl && profile.introVideoUrl.trim().length >= 8),
      points: 10,
      impactHint: "2.3x higher shortlisting rate on B2B & thesis briefs",
    },
    {
      key: "sla",
      label: "Fast Response SLA (≤ 30 mins) & Experience",
      completed:
        (profile.responseTimeMinutes ?? 60) <= 30 &&
        (profile.yearsExperience ?? 0) >= 2,
      points: 10,
      impactHint: "Signals readiness for urgent deadlines",
    },
    {
      key: "active_boost",
      label: "Active Standout Boost (Available Now / Featured)",
      completed:
        isFutureTimestamp(profile.availableNowBadgeUntil) ||
        isFutureTimestamp(profile.featuredProfileUntil),
      points: 10,
      impactHint: "Adds +10 to +20 organic lift in bid rank auctions",
    },
  ];

  const score = breakdown.reduce(
    (sum, item) => sum + (item.completed ? item.points : 0),
    0
  );

  const tierRecommendation =
    score >= 85
      ? "Standout Authority — Ready to dominate #1 boosted slots"
      : score >= 60
        ? "Strong Profile — Add credentials or intro pitch to hit 85%+"
        : "Starter Profile — Complete missing proof items to win 2x more bids";

  return { score, tierRecommendation, breakdown };
}

```

---

<a id="9-lib-upload-constants-ts"></a>
## 9. `lib/upload-constants.ts`

> **Relative Path:** `lib/upload-constants.ts`  
> **Role:** Domain / Infrastructure Library  
> **Language:** `ts` | **Lines:** 455 | **Size:** 11.9 KB

```ts
/**
 * Pure TypeScript client-safe upload constants.
 * This file MUST NOT import any server modules, fs, AWS SDK, or secrets,
 * allowing safe usage in "use client" components as well as server runtimes.
 */

export const MAX_BROWSER_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB
export const MAX_BROWSER_UPLOAD_LABEL = "4 MB";

export const BOOKING_FILE_LOCKED_STATUSES = new Set([
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
  "REFUNDED",
]);

export const BOOKING_FILE_DELETE_WINDOW_MS = 24 * 60 * 60 * 1000;

const BLOCKED_ACTIVE_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".xhtml",
  ".svg",
  ".svgz",
  ".xml",
  ".xsl",
  ".xslt",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".exe",
  ".dll",
  ".msi",
  ".bat",
  ".cmd",
  ".sh",
  ".bash",
  ".zsh",
  ".ps1",
  ".psm1",
  ".php",
  ".phtml",
  ".py",
  ".rb",
  ".pl",
  ".cgi",
  ".jar",
  ".com",
  ".scr",
  ".vbs",
  ".vbe",
  ".wsf",
  ".hta",
]);

const BLOCKED_ACTIVE_MIMES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/javascript",
  "text/javascript",
  "application/x-javascript",
  "application/ecmascript",
  "text/ecmascript",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-sh",
  "application/x-shellscript",
  "application/x-httpd-php",
  "text/x-php",
  "application/x-bat",
  "application/x-csh",
  "application/x-python",
  "text/xml",
  "application/xml",
]);

const AVATAR_MIME_BY_EXT: Record<string, string[]> = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
};

const PORTFOLIO_DOC_MIME_BY_EXT: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".txt": ["text/plain"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

const BOOKING_MIME_BY_EXT: Record<string, string[]> = {
  ".jpg": ["image/jpeg", "image/jpg"],
  ".jpeg": ["image/jpeg", "image/jpg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".avif": ["image/avif"],
  ".pdf": ["application/pdf"],
  ".txt": ["text/plain"],
  ".md": ["text/markdown", "text/x-markdown", "text/plain"],
  ".markdown": ["text/markdown", "text/x-markdown", "text/plain"],
  ".csv": ["text/csv", "application/csv", "text/plain"],
  ".rtf": ["application/rtf", "text/rtf"],
  ".doc": ["application/msword"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ".ppt": ["application/vnd.ms-powerpoint"],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  ".zip": ["application/zip", "application/x-zip-compressed"],
};

function getClientExtension(fileName: string): string {
  const base = String(fileName ?? "")
    .split(/[/\\]+/)
    .filter(Boolean)
    .pop()
    ?.trim() ?? "";
  if (!base || base.endsWith(".")) return "";
  const idx = base.lastIndexOf(".");
  if (idx <= 0 || idx >= base.length - 1) return "";
  return base.slice(idx).toLowerCase();
}

function normalizeClientMime(rawMime: string): string {
  return String(rawMime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

export function validateClientAvatarFile(file: File): string | null {
  if (file.size <= 0) {
    return "Selected image file cannot be empty.";
  }
  if (file.size > MAX_BROWSER_UPLOAD_BYTES) {
    return `Maximum file size is ${MAX_BROWSER_UPLOAD_LABEL}.`;
  }
  const ext = getClientExtension(file.name);
  const mime = normalizeClientMime(file.type);
  const allowedMimes = AVATAR_MIME_BY_EXT[ext];
  if (
    !allowedMimes ||
    BLOCKED_ACTIVE_EXTENSIONS.has(ext) ||
    BLOCKED_ACTIVE_MIMES.has(mime)
  ) {
    return "Please choose a JPG, PNG, or WEBP image (max 4 MB).";
  }
  if (mime && !allowedMimes.includes(mime)) {
    return "File extension does not match its image MIME type (JPG, PNG, or WEBP required).";
  }
  return null;
}

export function validateClientPortfolioFile(file: File): {
  error: string | null;
  purpose: "CREATOR_PORTFOLIO_IMAGE" | "CREATOR_PORTFOLIO_DOCUMENT" | null;
  inferredMimeType: string | null;
} {
  if (file.size <= 0) {
    return {
      error: "Selected file cannot be empty.",
      purpose: null,
      inferredMimeType: null,
    };
  }
  if (file.size > MAX_BROWSER_UPLOAD_BYTES) {
    return {
      error: `Maximum file size is ${MAX_BROWSER_UPLOAD_LABEL}.`,
      purpose: null,
      inferredMimeType: null,
    };
  }
  const ext = getClientExtension(file.name);
  const mime = normalizeClientMime(file.type);
  if (BLOCKED_ACTIVE_EXTENSIONS.has(ext) || BLOCKED_ACTIVE_MIMES.has(mime)) {
    return {
      error: "Active or executable file types are not permitted.",
      purpose: null,
      inferredMimeType: null,
    };
  }
  const imageMimes = AVATAR_MIME_BY_EXT[ext];
  if (imageMimes) {
    if (mime && !imageMimes.includes(mime)) {
      return {
        error: "Image extension does not match its MIME type.",
        purpose: null,
        inferredMimeType: null,
      };
    }
    return {
      error: null,
      purpose: "CREATOR_PORTFOLIO_IMAGE",
      inferredMimeType: mime || imageMimes[0],
    };
  }
  const docMimes = PORTFOLIO_DOC_MIME_BY_EXT[ext];
  if (docMimes) {
    if (mime && !docMimes.includes(mime)) {
      return {
        error: "Document extension does not match its MIME type.",
        purpose: null,
        inferredMimeType: null,
      };
    }
    return {
      error: null,
      purpose: "CREATOR_PORTFOLIO_DOCUMENT",
      inferredMimeType: mime || docMimes[0],
    };
  }
  return {
    error:
      "Allowed portfolio attachments: JPG, PNG, WEBP, PDF, DOCX, or TXT (max 4 MB).",
    purpose: null,
    inferredMimeType: null,
  };
}

export function validateClientBookingFile(file: File): string | null {
  if (file.size <= 0) {
    return "Selected file cannot be empty.";
  }
  if (file.size > MAX_BROWSER_UPLOAD_BYTES) {
    return `Maximum file size is ${MAX_BROWSER_UPLOAD_LABEL}.`;
  }
  const ext = getClientExtension(file.name);
  const mime = normalizeClientMime(file.type);
  if (
    !ext ||
    BLOCKED_ACTIVE_EXTENSIONS.has(ext) ||
    BLOCKED_ACTIVE_MIMES.has(mime)
  ) {
    return "This file type is blocked for security reasons. Upload PDF, Office docs, TXT/MD, CSV, ZIP, or raster images.";
  }
  const allowedMimes = BOOKING_MIME_BY_EXT[ext];
  if (!allowedMimes) {
    return "Unsupported file extension. Upload PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, MD, CSV, RTF, ZIP, or JPG/PNG/WEBP/AVIF (max 4 MB).";
  }
  if (
    mime &&
    mime !== "application/octet-stream" &&
    !allowedMimes.includes(mime)
  ) {
    return "File extension does not match the detected file content type.";
  }
  return null;
}

export function canDeleteBookingFile(
  file: {
    uploaderId?: string | null;
    fileCategory: string;
    createdAt: string | Date;
    revisionId?: string | null;
    disputeId?: string | null;
  },
  bookingStatus: string,
  currentUser: { id: string; roles: string[] } | null | undefined
): boolean {
  if (!currentUser) return false;
  if (currentUser.roles.includes("ADMIN")) return true;
  if (!file.uploaderId || file.uploaderId !== currentUser.id) return false;
  if (BOOKING_FILE_LOCKED_STATUSES.has(bookingStatus)) return false;
  if (
    file.fileCategory === "CREATOR_DELIVERABLE" &&
    bookingStatus === "DELIVERED"
  ) {
    return false;
  }
  if (file.revisionId || file.disputeId) return false;
  const createdMs = new Date(file.createdAt).getTime();
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs <= BOOKING_FILE_DELETE_WINDOW_MS;
}

const SAFE_RASTER_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const SAFE_RASTER_IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp|avif)$/i;

const ALLOWED_NEXT_IMAGE_EXACT_HOSTS = new Set([
  "lh3.googleusercontent.com",
  "images.unsplash.com",
  "pub-cc07856d657b4a7197710051042b3eda.r2.dev",
]);

function getConfiguredPublicR2Hostname(): string | null {
  const raw = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").trim();
  if (!raw) return null;
  try {
    const normalized =
      raw.startsWith("https://") || raw.startsWith("http://")
        ? raw
        : `https://${raw}`;
    const parsed = new URL(normalized);
    return parsed.hostname ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function isSafeRasterImageMimeOrExt(
  mimeType?: string | null,
  urlOrName?: string | null
): boolean {
  const normalizedMime = normalizeClientMime(mimeType ?? "");
  if (normalizedMime) {
    return SAFE_RASTER_IMAGE_MIMES.has(normalizedMime);
  }
  const candidate = String(urlOrName ?? "").trim();
  if (!candidate) return false;
  let pathname = candidate;
  try {
    if (candidate.startsWith("https://") || candidate.startsWith("http://")) {
      pathname = new URL(candidate).pathname;
    } else {
      pathname = candidate.split(/[?#]/)[0] ?? "";
    }
  } catch {
    pathname = candidate.split(/[?#]/)[0] ?? "";
  }
  return SAFE_RASTER_IMAGE_EXT_RE.test(pathname);
}

export function isAllowedNextImageSrc(url?: string | null): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (
    !trimmed ||
    /[\x00-\x1f\x7f\s\\]/.test(trimmed) ||
    trimmed.includes("..")
  ) {
    return false;
  }
  if (trimmed.startsWith("//")) return false;
  if (trimmed.startsWith("/api/media/")) {
    return true;
  }
  if (trimmed.startsWith("/images/")) {
    return !/[?#]/.test(trimmed);
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (!host) return false;
    if (ALLOWED_NEXT_IMAGE_EXACT_HOSTS.has(host)) return true;
    const configuredHost = getConfiguredPublicR2Hostname();
    if (configuredHost && host === configuredHost) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isSafeMediaDisplayUrl(url?: string | null): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (
    !trimmed ||
    /[\x00-\x1f\x7f\s\\]/.test(trimmed) ||
    trimmed.includes("..")
  ) {
    return false;
  }
  if (trimmed.startsWith("/api/media/")) {
    return !trimmed.startsWith("//");
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export type BookingUploadCategory =
  | "CUSTOMER_BRIEF"
  | "CREATOR_DELIVERABLE"
  | "REVISION_ATTACHMENT"
  | "DISPUTE_EVIDENCE";

export interface UploadedBookingFileMeta {
  id: string;
  fileName: string;
  sizeBytes: number;
  fileCategory: string;
}

export async function uploadBookingFile(
  bookingRef: string,
  file: File,
  fileCategory: BookingUploadCategory
): Promise<UploadedBookingFileMeta> {
  const validationError = validateClientBookingFile(file);
  if (validationError) {
    throw new Error(validationError);
  }
  const fd = new FormData();
  fd.append("file", file);
  fd.append("fileCategory", fileCategory);
  const res = await fetch(
    `/api/bookings/${encodeURIComponent(bookingRef)}/files/presign`,
    {
      method: "POST",
      body: fd,
    }
  );
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      j?.error?.message || `File upload failed (${res.status}).`
    );
  }
  const uploaded = j?.data?.file;
  if (!uploaded?.id) {
    throw new Error("Server returned an invalid file upload response.");
  }
  return {
    id: uploaded.id,
    fileName: uploaded.fileName || file.name,
    sizeBytes: uploaded.sizeBytes ?? file.size,
    fileCategory: uploaded.fileCategory || fileCategory,
  };
}

export async function deleteBookingFileById(fileId: string): Promise<void> {
  const res = await fetch(`/api/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      j?.error?.message || `Could not delete file (${res.status}).`
    );
  }
}

```

---

<a id="10-neon-ts"></a>
## 10. `neon.ts`

> **Relative Path:** `neon.ts`  
> **Role:** Configuration / Schema  
> **Language:** `ts` | **Lines:** 21 | **Size:** 0.5 KB

```ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});

```

---

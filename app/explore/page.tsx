import React from "react";
import Link from "next/link";
import { ArrowRight, Crown, Search, Sparkles, Tag, X } from "lucide-react";
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
    q ||
    categorySlug !== "all" ||
    pricingType !== "ALL" ||
    maxPriceRaw ||
    sort !== "newest",
  );

  /**
   * Preserves active search, discipline, pricing, budget, and sort state
   * whenever a user clicks a pill or quick-filter chip.
   */
  function buildExploreHref(overrides: {
    q?: string;
    category?: string;
    pricingType?: string;
    maxPrice?: string;
    sort?: string;
  }) {
    const params = new URLSearchParams();
    const nextQ = overrides.q !== undefined ? overrides.q : q;
    const nextCat =
      overrides.category !== undefined ? overrides.category : categorySlug;
    const nextPricing =
      overrides.pricingType !== undefined ? overrides.pricingType : pricingType;
    const nextMax =
      overrides.maxPrice !== undefined ? overrides.maxPrice : maxPriceRaw;
    const nextSort = overrides.sort !== undefined ? overrides.sort : sort;

    if (nextQ) params.set("q", nextQ);
    if (nextCat && nextCat !== "all") params.set("category", nextCat);
    if (nextPricing && nextPricing !== "ALL")
      params.set("pricingType", nextPricing);
    if (nextMax) params.set("maxPrice", nextMax);
    if (nextSort && nextSort !== "newest") params.set("sort", nextSort);

    const qs = params.toString();
    return qs ? `/explore?${qs}` : "/explore";
  }

  const showSpotlight = !hasFilters && tasks.length >= 4;
  const spotlightTask = showSpotlight ? tasks[0] : null;
  const gridTasks = showSpotlight ? tasks.slice(1) : tasks;

  const standardFeePct = config?.standardServiceFeePct ?? 10;
  const proDiscountPct = config?.proFeeDiscountPct ?? 50;

  return (
    <div className="relative min-h-screen overflow-x-clip pb-20">
      {/* Scoped Aurora & Moving Luminous Line Animations */}
      <style>{`
        @keyframes exploreAuroraDrift {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(2.5%, -2%, 0) scale(1.06);
          }
        }
        @keyframes exploreBeamSweep {
          0% {
            transform: translateX(-120%);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateX(320%);
            opacity: 0;
          }
        }
        @keyframes exploreBorderGlow {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .explore-aurora-blob {
          animation: exploreAuroraDrift 16s ease-in-out infinite;
        }
        .explore-aurora-blob-delayed {
          animation: exploreAuroraDrift 20s ease-in-out infinite reverse;
        }
        .explore-moving-line {
          animation: exploreBeamSweep 6.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .explore-glow-frame {
          background-size: 220% 220%;
          animation: exploreBorderGlow 9s ease infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .explore-aurora-blob,
          .explore-aurora-blob-delayed,
          .explore-moving-line,
          .explore-glow-frame {
            animation: none !important;
          }
        }
      `}</style>

      {/* Ambient Page-Top Aurora Wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden"
      >
        <div className="explore-aurora-blob absolute -top-32 left-1/4 h-[420px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-blue-300/30 via-teal-200/35 to-amber-200/30 blur-3xl" />
        <div className="explore-aurora-blob-delayed absolute -top-24 right-1/4 h-[380px] w-[480px] translate-x-1/3 rounded-full bg-gradient-to-bl from-amber-200/35 via-sky-200/30 to-emerald-200/30 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#faf7f2]/65 to-[#faf7f2]" />
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        {/* Luminous Aurora Showcase Header + Unified Command Bar */}
        <section className="relative overflow-hidden rounded-[28px] border border-[#e6e0d4]/90 bg-[#fffdf9]/85 p-6 shadow-[0_20px_60px_-25px_rgba(30,58,138,0.12)] backdrop-blur-xl sm:p-9">
          {/* Moving Glowing Top Filament Line */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-gradient-to-r from-transparent via-[#e6e0d4]/60 to-transparent"
          >
            <div className="explore-moving-line h-full w-1/3 bg-gradient-to-r from-transparent via-[#1e3a8a] via-[#0f766e] to-transparent shadow-[0_0_12px_rgba(15,118,110,0.8)]" />
          </div>

          {/* Subtle Inner Aurora Orbs */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-teal-300/20 via-blue-300/15 to-transparent blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-gradient-to-tr from-amber-300/20 via-rose-200/10 to-transparent blur-2xl"
          />

          <div className="relative z-10 space-y-6">
            {/* Top Bar: Minimal Eyebrow + Optional Pro Pill */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#1e3a8a]/15 bg-white/90 px-3.5 py-1.5 text-[11px] font-tech font-semibold tracking-wider text-[#1e3a8a] uppercase shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0f766e] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0f766e]" />
                </span>
                Vetted Editorial Studio
              </div>

              {!userIsPro && (
                <Link
                  href="/membership"
                  className="group inline-flex items-center gap-2 rounded-full border border-amber-300/90 bg-gradient-to-r from-amber-50 via-yellow-50/90 to-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-950 shadow-2xs transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md"
                >
                  <Crown className="h-3.5 w-3.5 text-amber-600" />
                  <span>Pro saves 50% on fees</span>
                  <ArrowRight className="h-3 w-3 text-amber-700 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>

            {/* Clean, Inspiring Headline (Zero Wall-of-Text) */}
            <div className="max-w-2xl space-y-2">
              <h1 className="font-editorial text-3xl font-semibold tracking-tight text-[#111827] sm:text-5xl sm:leading-[1.1]">
                Find the right writer,{" "}
                <span className="bg-gradient-to-r from-[#1e3a8a] via-[#0f766e] to-[#b45309] bg-clip-text italic text-transparent">
                  effortlessly.
                </span>
              </h1>
              <p className="text-sm text-stone-600 sm:text-base">
                Vetted Kenyan specialists &amp; editors. Escrow-protected from
                brief to final draft.
              </p>
            </div>

            {/* Glowing Unified Search & Budget Bar */}
            <div className="explore-glow-frame rounded-2xl bg-gradient-to-r from-[#1e3a8a]/25 via-[#0f766e]/30 to-[#d97706]/25 p-[1.5px] shadow-[0_12px_32px_-12px_rgba(17,24,39,0.12)]">
              <form
                method="GET"
                action="/explore"
                className="flex flex-col gap-2 rounded-[15px] bg-white/95 p-2 backdrop-blur-md lg:flex-row lg:items-center"
              >
                {/* Preserve active pill selections on form submit */}
                {categorySlug !== "all" && (
                  <input type="hidden" name="category" value={categorySlug} />
                )}
                {pricingType !== "ALL" && (
                  <input type="hidden" name="pricingType" value={pricingType} />
                )}

                {/* Primary Keyword Search */}
                <div className="relative flex flex-1 items-center">
                  <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#1e3a8a]" />
                  <input
                    type="text"
                    name="q"
                    defaultValue={q}
                    placeholder="Try 'literature review', 'APA editing', 'grant proposal'..."
                    aria-label="Search writing services"
                    className="w-full rounded-xl bg-transparent py-2.5 pl-10 pr-3 text-sm text-[#111827] placeholder:text-stone-400 focus:bg-[#faf7f2]/70 focus:outline-none"
                  />
                </div>

                <div
                  aria-hidden="true"
                  className="hidden h-7 w-px bg-[#e6e0d4] lg:block"
                />

                {/* Compact Max Budget & Sort Controls */}
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                  <div className="relative flex items-center rounded-xl border border-[#e6e0d4]/80 bg-[#faf7f2]/80 px-3 py-2 focus-within:border-[#1e3a8a] focus-within:bg-white">
                    <span className="mr-1.5 font-tech text-[11px] font-semibold text-stone-400">
                      MAX KES
                    </span>
                    <input
                      type="number"
                      name="maxPrice"
                      defaultValue={maxPriceRaw}
                      placeholder="Any"
                      min={1}
                      aria-label="Maximum budget in KES"
                      className="w-20 bg-transparent font-tech text-sm font-semibold text-[#111827] placeholder:font-normal placeholder:text-stone-400 focus:outline-none"
                    />
                  </div>

                  <select
                    name="sort"
                    defaultValue={sort}
                    aria-label="Sort services"
                    className="cursor-pointer rounded-xl border border-[#e6e0d4]/80 bg-[#faf7f2]/80 px-3 py-2 text-sm font-medium text-[#111827] transition-colors hover:border-[#cfc7b8] focus:border-[#1e3a8a] focus:bg-white focus:outline-none"
                  >
                    <option value="newest">Sort: Newest</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="fastest">Speed: Fastest</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111827] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#1e3a8a] hover:shadow-[0_8px_20px_-6px_rgba(30,58,138,0.5)] active:scale-[0.99] cursor-pointer"
                >
                  <span>Search</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>

            {/* Interactive Discipline Pills (Single Source of Truth — No Duplicate Dropdown) */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <Link
                  href={buildExploreHref({ category: "all" })}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    categorySlug === "all"
                      ? "bg-[#111827] text-white shadow-[0_6px_18px_-6px_rgba(17,24,39,0.55)]"
                      : "border border-[#e6e0d4] bg-white/90 text-stone-700 hover:-translate-y-0.5 hover:border-[#1e3a8a]/50 hover:text-[#1e3a8a]"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  All Disciplines
                </Link>

                {categories.map((cat) => {
                  const active = categorySlug === cat.slug;
                  return (
                    <Link
                      key={cat.id}
                      href={buildExploreHref({ category: cat.slug })}
                      className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                        active
                          ? "bg-[#1e3a8a] text-white shadow-[0_6px_18px_-6px_rgba(30,58,138,0.6)]"
                          : "border border-[#e6e0d4] bg-white/90 text-stone-700 hover:-translate-y-0.5 hover:border-[#1e3a8a]/50 hover:text-[#1e3a8a]"
                      }`}
                    >
                      {cat.name}
                    </Link>
                  );
                })}
              </div>

              {/* One-Click Pricing & Quick Budget Micro-Chips + Live Count */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6e0d4]/70 pt-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: "ALL", label: "All Rates" },
                    { id: "FIXED", label: "Fixed Price" },
                    { id: "QUOTE_BASED", label: "Custom Quote" },
                  ].map((mode) => {
                    const isActive = pricingType === mode.id;
                    return (
                      <Link
                        key={mode.id}
                        href={buildExploreHref({ pricingType: mode.id })}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          isActive
                            ? "bg-[#0f766e]/12 text-[#0f766e] ring-1 ring-[#0f766e]/30"
                            : "text-stone-600 hover:bg-stone-100/80 hover:text-[#111827]"
                        }`}
                      >
                        {mode.label}
                      </Link>
                    );
                  })}

                  <span
                    aria-hidden="true"
                    className="mx-1 hidden h-3.5 w-px bg-[#e6e0d4] sm:inline-block"
                  />

                  {[
                    { val: "3000", label: "≤ KES 3,000" },
                    { val: "8000", label: "≤ KES 8,000" },
                  ].map((preset) => {
                    const isActive = maxPriceRaw === preset.val;
                    return (
                      <Link
                        key={preset.val}
                        href={buildExploreHref({
                          maxPrice: isActive ? "" : preset.val,
                        })}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-tech text-[11px] font-semibold transition-colors ${
                          isActive
                            ? "bg-amber-100/90 text-amber-950 ring-1 ring-amber-400/60"
                            : "text-stone-500 hover:bg-stone-100/80 hover:text-[#111827]"
                        }`}
                      >
                        <Tag className="h-3 w-3" />
                        {preset.label}
                      </Link>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="font-tech font-semibold text-stone-600">
                    <strong className="text-[#111827]">{tasks.length}</strong>{" "}
                    {tasks.length === 1 ? "service" : "services"}
                  </span>

                  {hasFilters && (
                    <Link
                      href="/explore"
                      className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200 transition-colors hover:bg-rose-100"
                    >
                      <X className="h-3 w-3" />
                      Reset all
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Results Canvas */}
        {tasks.length === 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-[#e6e0d4] bg-white p-12 text-center shadow-xs">
            <div className="mx-auto max-w-md space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#1e3a8a]">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="font-editorial text-2xl font-semibold text-[#111827]">
                No services match those filters
              </h2>
              <p className="text-sm text-stone-500">
                Try broadening your budget or clearing active filters to explore
                all available writers.
              </p>
              <div className="pt-2">
                <Link
                  href="/explore"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1e3a8a]"
                >
                  Show All Services
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Editorial Lead Spotlight (shown when browsing the full directory) */}
            {spotlightTask && (
              <div>
                <TaskCard
                  task={spotlightTask}
                  standardFeePct={standardFeePct}
                  proDiscountPct={proDiscountPct}
                  userIsPro={userIsPro}
                  featured
                />
              </div>
            )}

            {/* Airy Gallery Grid */}
            <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
              {gridTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  standardFeePct={standardFeePct}
                  proDiscountPct={proDiscountPct}
                  userIsPro={userIsPro}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

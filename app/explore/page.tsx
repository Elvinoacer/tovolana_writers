import React from "react";
import Link from "next/link";
import { ArrowRight, Crown, Search, Sparkles, Tag, X } from "lucide-react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isUserProActive } from "@/lib/pricing";
import { TaskCard } from "@/components/TaskCard";
import { AuroraHeading } from "@/components/ui/AuroraPrimitives";

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
    sort !== "newest"
  );

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
      <style>{`
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
        .explore-moving-line {
          animation: exploreBeamSweep 6.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .explore-glow-frame {
          background-size: 220% 220%;
          animation: exploreBorderGlow 9s ease infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .explore-moving-line,
          .explore-glow-frame {
            animation: none !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl space-y-8 px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        {/* Dark HUD Showcase Header + Command Bar */}
        <section className="relative overflow-hidden rounded-[26px] border border-cyan-400/25 bg-[#080f1d]/75 p-6 shadow-[0_20px_60px_-25px_rgba(45,212,191,0.2)] backdrop-blur-xl sm:p-9">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-gradient-to-r from-transparent via-white/15 to-transparent"
          >
            <div className="explore-moving-line h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-400 via-violet-400 to-transparent shadow-[0_0_12px_rgba(45,212,191,0.8)]" />
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-teal-400/20 via-sky-400/15 to-transparent blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-gradient-to-tr from-violet-500/20 via-amber-400/10 to-transparent blur-2xl"
          />

          <div className="relative z-10 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/35 bg-teal-500/15 px-3.5 py-1.5 text-[11px] font-tech font-semibold tracking-wider text-teal-200 uppercase">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
                </span>
                Tested Writers
              </div>

              {!userIsPro && (
                <Link
                  href="/membership"
                  className="group inline-flex items-center gap-2 rounded-full border border-amber-400/45 bg-amber-500/15 px-4 py-1.5 text-xs font-semibold text-amber-200 transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-500/25"
                >
                  <Crown className="h-3.5 w-3.5 text-amber-300" />
                  <span>Pro saves 50% on fees</span>
                  <ArrowRight className="h-3 w-3 text-amber-300 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>

            <div className="max-w-2xl space-y-2">
              <AuroraHeading
                as="h1"
                className="text-3xl sm:text-5xl sm:leading-[1.1]"
              >
                Find the right writer, easily.
              </AuroraHeading>
              <p className="text-sm text-slate-300 sm:text-base">
                Pick a ready writing service. Clear prices upfront — your
                payment stays safe until you approve.
              </p>
            </div>

            {/* Glowing Unified Search & Budget Bar */}
            <div className="explore-glow-frame rounded-2xl bg-gradient-to-r from-cyan-400/35 via-sky-400/35 to-violet-400/35 p-[1.5px] shadow-[0_12px_32px_-12px_rgba(45,212,191,0.22)]">
              <form
                method="GET"
                action="/explore"
                className="flex flex-col gap-2 rounded-[15px] bg-[#060c18]/92 p-2 backdrop-blur-md lg:flex-row lg:items-center"
              >
                {categorySlug !== "all" && (
                  <input type="hidden" name="category" value={categorySlug} />
                )}
                {pricingType !== "ALL" && (
                  <input type="hidden" name="pricingType" value={pricingType} />
                )}

                <div className="relative flex flex-1 items-center">
                  <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-cyan-300" />
                  <input
                    type="text"
                    name="q"
                    defaultValue={q}
                    placeholder="Search: essay, research paper, business plan, editing..."
                    aria-label="Search writing services"
                    className="w-full rounded-xl bg-transparent py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-400 focus:bg-white/[0.04] focus:outline-none"
                  />
                </div>

                <div
                  aria-hidden="true"
                  className="hidden h-7 w-px bg-white/[0.12] lg:block"
                />

                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                  <div className="relative flex items-center rounded-xl border border-white/[0.14] bg-white/[0.05] px-3 py-2 focus-within:border-cyan-400/60">
                    <span className="mr-1.5 font-tech text-[11px] font-semibold text-slate-400">
                      MAX KES
                    </span>
                    <input
                      type="number"
                      name="maxPrice"
                      defaultValue={maxPriceRaw}
                      placeholder="Any"
                      min={1}
                      aria-label="Maximum budget in KES"
                      className="w-20 bg-transparent font-tech text-sm font-semibold text-white placeholder:font-normal placeholder:text-slate-500 focus:outline-none"
                    />
                  </div>

                  <select
                    name="sort"
                    defaultValue={sort}
                    aria-label="Sort services"
                    className="cursor-pointer rounded-xl border border-white/[0.14] bg-white/[0.05] px-3 py-2 text-sm font-medium text-white transition-colors hover:border-cyan-400/40 focus:border-cyan-400/60 focus:outline-none"
                  >
                    <option value="newest">Newest</option>
                    <option value="price_asc">Lowest price</option>
                    <option value="price_desc">Highest price</option>
                    <option value="fastest">Fastest delivery</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn-primary px-6 py-2.5 text-sm"
                >
                  <span>Search</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>

            {/* Category Filter Pills */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <Link
                  href={buildExploreHref({ category: "all" })}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-all ${
                    categorySlug === "all"
                      ? "border-cyan-400/65 bg-cyan-400/20 text-cyan-100 shadow-[0_0_16px_rgba(45,212,191,0.28)]"
                      : "border-white/[0.12] bg-white/[0.05] text-slate-300 hover:-translate-y-0.5 hover:border-cyan-400/45 hover:text-white"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  All Categories
                </Link>

                {categories.map((cat) => {
                  const active = categorySlug === cat.slug;
                  return (
                    <Link
                      key={cat.id}
                      href={buildExploreHref({ category: cat.slug })}
                      className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-all ${
                        active
                          ? "border-sky-400/65 bg-sky-500/25 text-sky-100 shadow-[0_0_16px_rgba(56,189,248,0.28)]"
                          : "border-white/[0.12] bg-white/[0.05] text-slate-300 hover:-translate-y-0.5 hover:border-sky-400/45 hover:text-white"
                      }`}
                    >
                      {cat.name}
                    </Link>
                  );
                })}
              </div>

              {/* Pricing & Budget Micro-Chips + Live Count */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.1] pt-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: "ALL", label: "All Prices" },
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
                            ? "bg-teal-400/20 text-teal-200 ring-1 ring-teal-400/45"
                            : "text-slate-400 hover:bg-white/[0.07] hover:text-white"
                        }`}
                      >
                        {mode.label}
                      </Link>
                    );
                  })}

                  <span
                    aria-hidden="true"
                    className="mx-1 hidden h-3.5 w-px bg-white/[0.14] sm:inline-block"
                  />

                  {[
                    { val: "3000", label: "Under KES 3,000" },
                    { val: "8000", label: "Under KES 8,000" },
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
                            ? "bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/50"
                            : "text-slate-400 hover:bg-white/[0.07] hover:text-white"
                        }`}
                      >
                        <Tag className="h-3 w-3" />
                        {preset.label}
                      </Link>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="font-tech font-semibold text-slate-400">
                    <strong className="text-white">{tasks.length}</strong>{" "}
                    {tasks.length === 1 ? "service" : "services"}
                  </span>

                  {hasFilters && (
                    <Link
                      href="/explore"
                      className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-3 py-1 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-400/35 transition-colors hover:bg-rose-500/25"
                    >
                      <X className="h-3 w-3" />
                      Clear filters
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Results Canvas */}
        {tasks.length === 0 ? (
          <div className="editorial-card p-12 text-center">
            <div className="mx-auto max-w-md space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 border border-sky-400/35 text-sky-300">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="font-editorial text-2xl font-semibold text-white">
                No services match your search
              </h2>
              <p className="text-sm text-slate-400">
                Clear your filters to see all services, or post your project for
                free and let writers send you offers.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/explore"
                  className="btn-primary px-5 py-2.5 text-sm"
                >
                  Show All Services
                </Link>
                <Link
                  href="/bidding"
                  className="btn-ghost px-5 py-2.5 text-sm"
                >
                  Post a Free Job Instead
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {spotlightTask && (
              <div>
                <TaskCard
                  task={spotlightTask}
                  standardFeePct={standardFeePct}
                  proDiscountPct={proDiscountPct}
                  userIsPro={userIsPro}
                  featured
                  themeOverride="cyan"
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
              {gridTasks.map((task, idx) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  standardFeePct={standardFeePct}
                  proDiscountPct={proDiscountPct}
                  userIsPro={userIsPro}
                  index={idx}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

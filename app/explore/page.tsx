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
            ratingAverage: true,
            completedBookingsCount: true,
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

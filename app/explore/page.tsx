import React from "react";
import Link from "next/link";
import { Filter, Search, SlidersHorizontal } from "lucide-react";
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#e6e0d4] pb-6">
        <div>
          <p className="text-xs font-tech uppercase tracking-wider text-[#1e3a8a]">
            Marketplace Directory (Screen 1.2)
          </p>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold mt-1">
            Explore Vetted Writing Services
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Every listing shows transparent KES fees, customer prerequisites,
            delivery turnaround, and public validity dates upfront.
          </p>
        </div>
        {!userIsPro && (
          <Link
            href="/membership"
            className="text-xs font-medium px-3.5 py-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 shrink-0"
          >
            Pro Members see early-access listings &amp; pay 50% less in fees
          </Link>
        )}
      </div>

      {/* Filter Engine Form */}
      <form
        method="GET"
        action="/explore"
        className="editorial-card p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
      >
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Keyword Search
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Literature review, APA, RFP..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#e6e0d4] bg-[#faf7f2] focus:outline-none focus:border-[#1e3a8a]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Category
          </label>
          <select
            name="category"
            defaultValue={categorySlug}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[#e6e0d4] bg-[#faf7f2] focus:outline-none focus:border-[#1e3a8a]"
          >
            <option value="all">All Active Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Pricing Model
          </label>
          <select
            name="pricingType"
            defaultValue={pricingType}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[#e6e0d4] bg-[#faf7f2]"
          >
            <option value="ALL">Fixed &amp; Quote</option>
            <option value="FIXED">Fixed Price Only</option>
            <option value="QUOTE_BASED">Quotation-Based</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Max Base (KES)
          </label>
          <input
            type="number"
            name="maxPrice"
            defaultValue={maxPriceRaw}
            placeholder="e.g. 8000"
            className="w-full px-3 py-2 text-sm rounded-lg border border-[#e6e0d4] bg-[#faf7f2] font-tech"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Sort By
            </label>
            <select
              name="sort"
              defaultValue={sort}
              className="w-full px-2.5 py-2 text-sm rounded-lg border border-[#e6e0d4] bg-[#faf7f2]"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Lowest Price</option>
              <option value="price_desc">Highest Price</option>
              <option value="fastest">Fastest Delivery</option>
            </select>
          </div>
          <button
            type="submit"
            className="self-end px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold hover:bg-[#172554] inline-flex items-center gap-1.5"
          >
            <Filter className="w-3.5 h-3.5" />
            Apply
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between text-xs text-stone-600">
        <span className="inline-flex items-center gap-1.5 font-tech">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Showing {tasks.length} active published service{tasks.length === 1 ? "" : "s"}
        </span>
        {(q || categorySlug !== "all" || pricingType !== "ALL" || maxPriceRaw) && (
          <Link href="/explore" className="text-[#1e3a8a] hover:underline">
            Clear all filters
          </Link>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="editorial-card p-12 text-center space-y-3">
          <h3 className="font-editorial text-xl font-semibold">
            No matching services found
          </h3>
          <p className="text-sm text-stone-600 max-w-md mx-auto">
            Try clearing your price cap or selecting a broader writing discipline.
          </p>
          <Link
            href="/explore"
            className="inline-block px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold"
          >
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

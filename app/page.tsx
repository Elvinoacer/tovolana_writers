import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Crown,
  Feather,
  FileCheck2,
  Lock,
  Search,
  Sparkles,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isUserProActive } from "@/lib/pricing";
import { TaskCard } from "@/components/TaskCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const userIsPro = user
    ? isUserProActive(user.membershipTier, user.proExpiresAt)
    : false;
  const now = new Date();

  const [config, categories, featuredTasks, stats] = await Promise.all([
    db.platformConfig.findUnique({ where: { id: "global" } }),
    db.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { listings: { where: { status: "PUBLISHED" } } } },
      },
    }),
    db.taskListing.findMany({
      where: {
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
      },
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
      orderBy: { publishedAt: "desc" },
      take: 6,
    }),
    Promise.all([
      db.creatorProfile.count({ where: { applicationStatus: "APPROVED" } }),
      db.taskListing.count({ where: { status: "PUBLISHED" } }),
      db.booking.count(),
    ]),
  ]);

  const [creatorsCount, publishedCount, bookingsCount] = stats;

  return (
    <div className="space-y-16 pb-12">
      {config?.announcementBanner && (
        <div className="bg-[#1e3a8a] text-white text-xs sm:text-sm py-2.5 px-4 text-center">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{config.announcementBanner}</span>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#e6e0d4] text-xs font-medium text-stone-700">
              <Award className="w-3.5 h-3.5 text-teal-700" />
              100% Writing-Assessment Vetted Creators · IntaSend Escrow Protected
            </div>

            <h1 className="font-editorial text-4xl sm:text-5xl font-semibold tracking-tight text-[#111827] leading-[1.12]">
              Commission writing services with full clarity before you commit.
            </h1>

            <p className="text-base sm:text-lg text-stone-600 leading-relaxed max-w-2xl">
              Discover scoped academic research, essays, business proposals, and
              developmental editing backed by upfront fee breakdowns, explicit
              delivery deadlines, and structured revision protection.
            </p>

            {/* Quick Search Bar */}
            <form
              action="/explore"
              method="GET"
              className="flex flex-col sm:flex-row gap-2.5 bg-white p-2 rounded-xl border border-[#e6e0d4] shadow-sm max-w-2xl"
            >
              <div className="flex-1 flex items-center gap-2 px-3">
                <Search className="w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  name="q"
                  placeholder="Search literature reviews, RFP proposals, APA editing..."
                  className="w-full py-2 text-sm bg-transparent focus:outline-none text-[#111827]"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold hover:bg-[#172554] transition-colors shrink-0"
              >
                Explore Services
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-6 pt-2 text-sm text-stone-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-700" />
                <span>Free accounts book every public service</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#1e3a8a]" />
                <span>Escrow releases only after delivery approval</span>
              </div>
            </div>
          </div>

          {/* Right Editorial Summary Card */}
          <div className="lg:col-span-5 editorial-card p-6 sm:p-7 space-y-5 bg-white">
            <div className="flex items-center justify-between border-b border-[#e6e0d4] pb-4">
              <div>
                <p className="text-xs font-tech uppercase tracking-wider text-stone-500">
                  Live Platform Registry
                </p>
                <h2 className="font-editorial text-xl font-semibold mt-0.5">
                  Transparent Guarantees
                </h2>
              </div>
              <Feather className="w-6 h-6 text-[#1e3a8a]" />
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-[#faf7f2] border border-[#e6e0d4]">
                <p className="text-2xl font-bold font-tech text-[#111827]">
                  {creatorsCount}
                </p>
                <p className="text-xs text-stone-500 mt-0.5">Vetted Creators</p>
              </div>
              <div className="p-3 rounded-lg bg-[#faf7f2] border border-[#e6e0d4]">
                <p className="text-2xl font-bold font-tech text-[#111827]">
                  {publishedCount}
                </p>
                <p className="text-xs text-stone-500 mt-0.5">Live Listings</p>
              </div>
              <div className="p-3 rounded-lg bg-[#faf7f2] border border-[#e6e0d4]">
                <p className="text-2xl font-bold font-tech text-[#111827]">
                  {bookingsCount}
                </p>
                <p className="text-xs text-stone-500 mt-0.5">Tracked Orders</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/70 border border-blue-200/70">
                <CalendarClock className="w-4 h-4 text-[#1e3a8a] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-950 text-xs">
                    Listing Validity != Delivery Deadline
                  </p>
                  <p className="text-xs text-blue-900/80 mt-0.5">
                    When a listing expires, already-confirmed bookings remain
                    100% protected until their agreed delivery deadline.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-teal-50/70 border border-teal-200/70">
                <FileCheck2 className="w-4 h-4 text-teal-800 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-teal-950 text-xs">
                    Merit-First Creator Onboarding
                  </p>
                  <p className="text-xs text-teal-900/80 mt-0.5">
                    Writers qualify through a timed 6-criteria writing test —
                    zero ID card or certificate barriers.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Link
                href="/creators-hub/join"
                className="flex-1 text-center px-4 py-2.5 rounded-lg border border-teal-700 text-teal-900 text-xs font-semibold hover:bg-teal-50 transition-colors"
              >
                Join Creators Hub
              </Link>
              <Link
                href="/auth"
                className="flex-1 text-center px-4 py-2.5 rounded-lg bg-[#111827] text-white text-xs font-semibold hover:bg-stone-800 transition-colors"
              >
                Sign In / Quick Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7 Categories Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-xs font-tech uppercase tracking-wider text-[#1e3a8a]">
              Explicit Taxonomy
            </p>
            <h2 className="font-editorial text-2xl font-semibold mt-1">
              Browse by Writing Discipline
            </h2>
          </div>
          <Link
            href="/explore"
            className="text-sm font-medium text-[#1e3a8a] hover:underline inline-flex items-center gap-1"
          >
            All Categories
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/explore?category=${cat.slug}`}
              className="editorial-card p-4 hover:border-[#1e3a8a]/50 hover:bg-white transition-all group"
            >
              <div className="flex items-center justify-between">
                <BookOpen className="w-4 h-4 text-[#1e3a8a]" />
                <span className="text-xs font-tech text-stone-500">
                  {cat._count.listings} active
                </span>
              </div>
              <h3 className="font-semibold text-sm text-[#111827] group-hover:text-[#1e3a8a] mt-2.5">
                {cat.name}
              </h3>
              <p className="text-xs text-stone-600 line-clamp-2 mt-1">
                {cat.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Published Listings */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-xs font-tech uppercase tracking-wider text-[#1e3a8a]">
              Upfront Requirements &amp; Pricing
            </p>
            <h2 className="font-editorial text-2xl font-semibold mt-1">
              Featured Published Tasks
            </h2>
          </div>
          <Link
            href="/explore"
            className="text-sm font-medium text-[#1e3a8a] hover:underline inline-flex items-center gap-1"
          >
            Full Directory
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              standardFeePct={config?.standardServiceFeePct ?? 10}
              proDiscountPct={config?.proFeeDiscountPct ?? 50}
              userIsPro={userIsPro}
            />
          ))}
        </div>
      </section>

      {/* Free vs Pro Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="editorial-card p-8 bg-gradient-to-br from-white to-[#fef3c7]/40 border-amber-200 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              <Crown className="w-3.5 h-3.5" />
              Sustainable Membership Model
            </div>
            <h2 className="font-editorial text-2xl font-semibold text-[#111827]">
              Free customers book freely. Pro members save 50% on platform fees.
            </h2>
            <p className="text-sm text-stone-600 max-w-2xl">
              Core booking access is never locked behind a paywall. Upgrade to
              Tovolana Pro ({config?.currency ?? "KES"}{" "}
              {(config?.proMonthlyPrice ?? 2500).toLocaleString()}/month) for{" "}
              {config?.proFeeDiscountPct ?? 50}% lower service fees, priority
              dispute support, and early access to newly published high-demand
              listings.
            </p>
          </div>
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-end">
            <Link
              href="/membership"
              className="px-5 py-3 rounded-lg bg-[#111827] text-white text-sm font-semibold text-center hover:bg-stone-800 transition-colors"
            >
              Compare Free vs Pro Plans
            </Link>
            <Link
              href="/dashboard/membership"
              className="px-5 py-2.5 rounded-lg border border-amber-400 bg-amber-50 text-amber-950 text-sm font-semibold text-center hover:bg-amber-100 transition-colors"
            >
              Manage / Upgrade Subscription
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

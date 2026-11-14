import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Crown,
  Feather,
  FileText,
  Lock,
  Search,
  Sparkles,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isUserProActive } from "@/lib/pricing";
import { TaskCard } from "@/components/TaskCard";
import {
  CategoryCoverArt,
  HeroManuscriptShowcase,
} from "@/components/ui/EditorialVisuals";

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
    <div className="space-y-20 pb-8">
      {config?.announcementBanner && (
        <div className="bg-[#111827] text-white text-xs py-2 px-4 text-center">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{config.announcementBanner}</span>
          </div>
        </div>
      )}

      {/* Visual-First Editorial Hero */}
      <section className="relative overflow-hidden ink-grid-bg pt-8 sm:pt-12 pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-6 animate-reveal">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#e6e0d4] text-xs font-medium text-stone-700 shadow-2xs">
              <Award className="w-3.5 h-3.5 text-[#0f766e]" />
              <span>Assessment-Vetted Writers · IntaSend Escrow</span>
            </div>

            <h1 className="font-editorial text-4xl sm:text-5xl lg:text-[3.35rem] font-semibold tracking-tight text-[#111827] leading-[1.06]">
              Clear pricing. Vetted writers. Locked deadlines.
            </h1>

            <p className="text-base text-stone-600 leading-relaxed max-w-xl">
              Commission academic research, proposals, and editing with every
              fee, deliverable, and date visible before you commit.
            </p>

            <form
              action="/explore"
              method="GET"
              className="flex flex-col sm:flex-row gap-2 bg-white p-2 rounded-2xl border border-[#e6e0d4] shadow-sm max-w-xl"
            >
              <div className="flex-1 flex items-center gap-2.5 px-3">
                <Search className="w-4 h-4 text-stone-400 shrink-0" />
                <input
                  type="text"
                  name="q"
                  placeholder="Literature review, RFP, APA edit..."
                  className="w-full py-2 text-sm bg-transparent focus:outline-none text-[#111827]"
                />
              </div>
              <button
                type="submit"
                className="btn-primary px-6 py-2.5 text-sm shrink-0"
              >
                Explore Services
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick Category Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {categories.slice(0, 4).map((c) => (
                <Link
                  key={c.id}
                  href={`/explore?category=${c.slug}`}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-white/90 border border-[#e6e0d4] text-stone-700 hover:border-[#1e3a8a] hover:text-[#1e3a8a] transition-colors"
                >
                  {c.name}
                </Link>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-1 text-xs font-medium text-stone-600">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#0f766e]" />
                Free accounts book freely
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-[#1e3a8a]" />
                Escrow releases on approval
              </span>
            </div>
          </div>

          <div className="lg:col-span-6">
            <HeroManuscriptShowcase
              creatorsCount={creatorsCount}
              publishedCount={publishedCount}
              bookingsCount={bookingsCount}
            />
          </div>
        </div>
      </section>

      {/* Visual Discipline Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-reveal stagger-1">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#111827]">
              Disciplines
            </h2>
          </div>
          <Link
            href="/explore"
            className="text-sm font-semibold text-[#1e3a8a] hover:underline inline-flex items-center gap-1"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/explore?category=${cat.slug}`}
              className="editorial-card-interactive overflow-hidden group block"
            >
              <CategoryCoverArt
                slug={cat.slug}
                name={cat.name}
                heightClass="h-24"
              >
                <div className="flex items-center justify-between text-white">
                  <span className="font-editorial font-semibold text-base leading-tight">
                    {cat.name}
                  </span>
                  <span className="text-[11px] font-tech px-2 py-0.5 rounded-full bg-black/25 backdrop-blur-xs shrink-0">
                    {cat._count.listings}
                  </span>
                </div>
              </CategoryCoverArt>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Published Tasks */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-reveal stagger-2">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#111827]">
              Featured Services
            </h2>
          </div>
          <Link
            href="/explore"
            className="text-sm font-semibold text-[#1e3a8a] hover:underline inline-flex items-center gap-1"
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

      {/* Visual 3-Step Escrow Diagram */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-reveal stagger-3">
        <div className="editorial-card p-6 sm:p-8 bg-white grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-4">
            <span className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-[#1e3a8a] font-tech font-bold text-sm flex items-center justify-center shrink-0">
              01
            </span>
            <div>
              <h3 className="font-editorial text-lg font-semibold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#1e3a8a]" />
                Inspect &amp; Brief
              </h3>
              <p className="text-xs text-stone-600 mt-1">
                See KES totals, turnaround days, and requirements before paying.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <span className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-tech font-bold text-sm flex items-center justify-center shrink-0">
              02
            </span>
            <div>
              <h3 className="font-editorial text-lg font-semibold flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-700" />
                M-Pesa / Card Escrow
              </h3>
              <p className="text-xs text-stone-600 mt-1">
                Funds lock safely via IntaSend until your delivery arrives.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <span className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-[#0f766e] font-tech font-bold text-sm flex items-center justify-center shrink-0">
              03
            </span>
            <div>
              <h3 className="font-editorial text-lg font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#0f766e]" />
                Review &amp; Release
              </h3>
              <p className="text-xs text-stone-600 mt-1">
                Request included revisions or release payment with one tap.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dual Spotlight: Pro Membership + Creators Hub */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-reveal stagger-4">
        <div className="editorial-card p-7 bg-gradient-to-br from-white to-amber-50/70 border-amber-200 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              <Crown className="w-3.5 h-3.5" />
              Free vs Pro
            </span>
            <h2 className="font-editorial text-2xl font-semibold text-[#111827]">
              Book free anytime. Save {config?.proFeeDiscountPct ?? 50}% on fees with Pro.
            </h2>
            <p className="text-sm text-stone-600">
              {config?.currency ?? "KES"}{" "}
              {(config?.proMonthlyPrice ?? 2500).toLocaleString()}/month for
              halved fees &amp; early access.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/membership" className="btn-dark px-5 py-2.5 text-xs sm:text-sm">
              Compare Tiers
            </Link>
            <Link
              href="/dashboard/membership"
              className="btn-ghost px-5 py-2.5 text-xs sm:text-sm border-amber-300"
            >
              Upgrade
            </Link>
          </div>
        </div>

        <div className="editorial-card p-7 bg-gradient-to-br from-[#0f766e] to-[#134e4a] text-white border-teal-800 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-white/15 text-teal-50 backdrop-blur-xs">
              <Feather className="w-3.5 h-3.5" />
              Creators Hub
            </span>
            <h2 className="font-editorial text-2xl font-semibold">
              Qualify by writing craft alone. Zero ID gatekeeping.
            </h2>
            <p className="text-sm text-teal-100/90">
              Pass our 6-criteria assessment to publish services right on your
              existing account.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/creators-hub/join"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#0f766e] text-xs sm:text-sm font-semibold hover:bg-teal-50 transition-colors"
            >
              Take Assessment
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white border border-white/20 text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

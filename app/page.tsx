import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  CheckCircle2,
  Crown,
  Feather,
  Leaf,
  Lock,
  Search,
  Sparkles,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isUserProActive } from "@/lib/pricing";
import { TaskCard } from "@/components/TaskCard";
import { CategoryCoverArt } from "@/components/ui/EditorialVisuals";
import { IphoneJourneyShowcase } from "@/components/IphoneJourneyShowcase";
import { InteractiveFeeCalculator } from "@/components/InteractiveFeeCalculator";

export const dynamic = "force-dynamic";

const HERO_CREATOR_PORTRAITS = [
  { src: "/images/photos/avatar-1.jpg", alt: "Dr. Amina W." },
  { src: "/images/photos/avatar-2.jpg", alt: "David K." },
  { src: "/images/photos/avatar-3.jpg", alt: "Wanjiku M." },
  { src: "/images/photos/avatar-4.jpg", alt: "Brian O." },
];

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
    <div className="space-y-16 sm:space-y-20 pb-12">
      {config?.announcementBanner && (
        <div className="bg-[#0b1120] text-white text-xs py-2 px-4 text-center border-b border-white/10">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{config.announcementBanner}</span>
          </div>
        </div>
      )}

      {/* Nature + Digital Writing Studio Hero */}
      <section className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="relative rounded-3xl overflow-hidden min-h-[580px] sm:min-h-[640px] flex items-stretch shadow-2xl border border-[#e6e0d4] bg-[#0b1120]">
          {/* Real Nature & Digital Writing Scene Photograph */}
          <Image
            src="/images/photos/hero-botanical-desk.jpg"
            alt="Sunlit walnut writing desk beside lush garden foliage with laptop manuscript draft, planner, fountain pen, coffee cup, and ceramic vase of flowers"
            fill
            priority
            sizes="(max-width: 1440px) 100vw, 1400px"
            className="object-cover object-center"
          />

          {/* Directional Scrims — High Text Contrast on Left, Vivid Desk Scene on Right */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[#090f1d]/96 via-[#090f1d]/75 via-52% to-[#090f1d]/10"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#090f1d]/75 via-transparent to-[#090f1d]/25"
          />

          <div className="relative z-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-end p-6 sm:p-10 lg:p-14">
            {/* Left Copy & Search Controls */}
            <div className="lg:col-span-7 space-y-6 self-center animate-reveal">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-xs font-medium text-emerald-200 shadow-sm">
                <Leaf className="w-3.5 h-3.5 text-emerald-300" />
                <span>Vetted Writers · Transparent KES Escrow · M-Pesa</span>
              </div>

              <h1 className="font-editorial text-4xl sm:text-5xl lg:text-[3.45rem] font-semibold tracking-tight text-white leading-[1.06] max-w-2xl">
                Clear pricing. Vetted craft.{" "}
                <span className="italic font-normal text-amber-200">
                  Calmly delivered.
                </span>
              </h1>

              <p className="text-sm sm:text-base text-stone-200/95 leading-relaxed max-w-xl">
                Commission academic research, proposals, and editing with locked
                KES totals, milestone deliverables, and guaranteed delivery dates
                before paying.
              </p>

              {/* Search Bar */}
              <form
                action="/explore"
                method="GET"
                className="flex flex-col sm:flex-row gap-2 bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-white/50 shadow-2xl max-w-xl"
              >
                <div className="flex-1 flex items-center gap-2.5 px-3">
                  <Search className="w-4 h-4 text-stone-500 shrink-0" />
                  <input
                    type="text"
                    name="q"
                    placeholder="Literature review, RFP, APA edit..."
                    className="w-full py-2 text-sm bg-transparent focus:outline-none text-[#111827] placeholder:text-stone-400"
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
              <div className="flex flex-wrap items-center gap-2">
                {categories.slice(0, 4).map((c) => (
                  <Link
                    key={c.id}
                    href={`/explore?category=${c.slug}`}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-black/45 backdrop-blur-md border border-white/20 text-white/90 hover:bg-white hover:text-[#111827] transition-colors"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>

              {/* Human Portrait Trust Strip */}
              <div className="flex flex-wrap items-center gap-5 pt-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex -space-x-2">
                    {HERO_CREATOR_PORTRAITS.map((p) => (
                      <div
                        key={p.src}
                        className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-[#0b1120] bg-stone-800 shrink-0"
                      >
                        <Image
                          src={p.src}
                          alt={p.alt}
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-medium text-stone-200">
                    6-criteria assessed writers
                  </span>
                </div>

                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Free accounts book anytime
                </span>
              </div>
            </div>

            {/* Right Column — Leaves Desk Scene Unobstructed Above, Telemetry Bar Pinned Below */}
            <div className="lg:col-span-5 flex flex-col items-start lg:items-end justify-end gap-3 animate-reveal stagger-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0b1120]/80 backdrop-blur-md border border-emerald-400/35 text-xs font-medium text-emerald-200 shadow-lg animate-float-subtle">
                <BadgeCheck className="w-4 h-4 text-emerald-400" />
                <span>Valid Until ≠ Delivery Deadline</span>
              </div>

              <div className="w-full max-w-md rounded-2xl bg-[#0b1120]/78 backdrop-blur-xl border border-white/15 p-4 text-white grid grid-cols-3 gap-3 shadow-2xl">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-300">
                    <Award className="w-3.5 h-3.5" />
                    <span className="font-tech text-[10px] uppercase tracking-wider text-stone-300">
                      Writers
                    </span>
                  </div>
                  <p className="font-tech text-xl font-bold leading-none">
                    {creatorsCount}
                  </p>
                </div>

                <div className="space-y-1 border-x border-white/10 px-3">
                  <div className="flex items-center gap-1.5 text-amber-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="font-tech text-[10px] uppercase tracking-wider text-stone-300">
                      Services
                    </span>
                  </div>
                  <p className="font-tech text-xl font-bold leading-none">
                    {publishedCount}
                  </p>
                </div>

                <div className="space-y-1 pl-1">
                  <div className="flex items-center gap-1.5 text-sky-300">
                    <Lock className="w-3.5 h-3.5" />
                    <span className="font-tech text-[10px] uppercase tracking-wider text-stone-300">
                      Escrow
                    </span>
                  </div>
                  <p className="font-tech text-xl font-bold leading-none">
                    {bookingsCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Services with Real Category Photography & Creator Portraits */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-reveal stagger-1">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="font-tech text-[11px] uppercase tracking-widest text-[#0f766e] font-semibold">
              Transparent Scope · Upfront KES Total
            </span>
            <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#111827]">
              Featured Writing Services
            </h2>
          </div>
          <Link
            href="/explore"
            className="text-sm font-semibold text-[#1e3a8a] hover:underline inline-flex items-center gap-1.5 shrink-0"
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

      {/* 5-iPhone Real Photography & M-Pesa Payout Journey */}
      <IphoneJourneyShowcase />

      {/* Photographic Disciplines Bento Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-reveal stagger-2">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="font-tech text-[11px] uppercase tracking-widest text-[#1e3a8a] font-semibold">
              Curated Categories
            </span>
            <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#111827]">
              Browse by Writing Discipline
            </h2>
          </div>
          <Link
            href="/explore"
            className="text-sm font-semibold text-[#1e3a8a] hover:underline inline-flex items-center gap-1.5 shrink-0"
          >
            View All Categories
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat, idx) => (
            <Link
              key={cat.id}
              href={`/explore?category=${cat.slug}`}
              className={`editorial-card-interactive overflow-hidden group block ${
                idx === 0 ? "sm:col-span-2" : ""
              }`}
            >
              <CategoryCoverArt
                slug={cat.slug}
                name={cat.name}
                heightClass="h-44"
              >
                <div className="flex items-end justify-between gap-3 text-white pt-6">
                  <div className="min-w-0">
                    <span className="font-editorial font-semibold text-lg sm:text-xl leading-tight block truncate">
                      {cat.name}
                    </span>
                    <span className="text-xs text-white/80 line-clamp-1 mt-0.5 block">
                      {cat.description}
                    </span>
                  </div>
                  <span className="text-xs font-tech px-2.5 py-1 rounded-full bg-white/15 border border-white/20 backdrop-blur-md shrink-0 inline-flex items-center gap-1">
                    {cat._count.listings}
                    <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </CategoryCoverArt>
            </Link>
          ))}
        </div>
      </section>

      {/* Live Pro Fee Calculator + Creators Hub Photographic Invitation */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch animate-reveal stagger-3">
        <div className="lg:col-span-7 flex flex-col">
          <InteractiveFeeCalculator
            standardFeePct={config?.standardServiceFeePct ?? 10}
            proDiscountPct={config?.proFeeDiscountPct ?? 50}
            monthlyProPrice={config?.proMonthlyPrice ?? 2500}
            currency={config?.currency ?? "KES"}
          />
        </div>

        <div className="lg:col-span-5 relative rounded-3xl overflow-hidden shadow-xl border border-[#134e4a] bg-[#0f2925] text-white flex flex-col justify-between p-7 sm:p-8 min-h-[380px]">
          <Image
            src="/images/photos/journey-2-work.jpg"
            alt="Creators collaborating on digital manuscripts in a warm studio"
            fill
            sizes="(max-width: 1024px) 100vw, 520px"
            className="object-cover opacity-35"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#0b2520] via-[#0b2520]/80 to-[#0f2925]/60"
          />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-emerald-200 backdrop-blur-md">
                <Feather className="w-3.5 h-3.5" />
                Creators Hub
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-tech px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-300/25 text-amber-200">
                <Crown className="w-3 h-3" />
                Pro · {config?.proFeeDiscountPct ?? 50}% Off Fees
              </span>
            </div>

            <h2 className="font-editorial text-2xl sm:text-3xl font-semibold leading-tight">
              Qualify by writing craft alone. Zero ID gatekeeping.
            </h2>

            <p className="text-sm text-stone-200 leading-relaxed">
              Pass our 6-criteria writing assessment to unlock your creator
              studio, publish listings, and withdraw approved earnings directly
              to M-Pesa.
            </p>
          </div>

          <div className="relative z-10 space-y-4 pt-6">
            <div className="grid grid-cols-2 gap-2.5 text-xs font-tech">
              <div className="rounded-xl bg-white/10 border border-white/15 backdrop-blur-md p-3">
                <p className="text-stone-300 text-[10px] uppercase">Vetting</p>
                <p className="text-white font-bold mt-0.5">6-Criteria Exam</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/15 backdrop-blur-md p-3">
                <p className="text-stone-300 text-[10px] uppercase">Settlement</p>
                <p className="text-emerald-300 font-bold mt-0.5">
                  Instant M-Pesa
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/creators-hub/join"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#0b2520] text-xs sm:text-sm font-semibold hover:bg-emerald-50 transition-colors"
              >
                Take Assessment
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/membership"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white border border-white/25 text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors"
              >
                Compare Free vs Pro
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

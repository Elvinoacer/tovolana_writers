import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isUserProActive } from "@/lib/pricing";
import { TaskCard } from "@/components/TaskCard";
import { getCategoryPhotoSrc } from "@/components/ui/EditorialVisuals";
import { IphoneJourneyShowcase } from "@/components/IphoneJourneyShowcase";
import { InteractiveFeeCalculator } from "@/components/InteractiveFeeCalculator";

export const dynamic = "force-dynamic";

const HERO_CREATOR_PORTRAITS = [
  { src: "/images/photos/avatar-1.jpg", alt: "Dr. Amina W." },
  { src: "/images/photos/avatar-2.jpg", alt: "David K." },
  { src: "/images/photos/avatar-3.jpg", alt: "Wanjiku M." },
  { src: "/images/photos/avatar-4.jpg", alt: "Brian O." },
];

const SHORT_DISCIPLINE_LINES: Record<string, string> = {
  "academic-writing": "Literature reviews & capstones",
  "essays-and-assignments": "Thesis-driven analytical essays",
  "research-papers": "Empirical & systematic studies",
  "articles-and-blog-writing": "Editorial voice & SEO features",
  "business-writing-and-proposals": "RFPs, grants & strategy memos",
  "editing-and-proofreading": "Structural polish & citations",
  "other-services": "Speeches, scripts & policy briefs",
};

function shortDisciplineLine(slug: string, fallback: string): string {
  if (SHORT_DISCIPLINE_LINES[slug]) return SHORT_DISCIPLINE_LINES[slug];
  const firstClause = fallback.split(/[.,;]/)[0]?.trim();
  return firstClause && firstClause.length <= 42
    ? firstClause
    : "Specialized editorial craft";
}

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
            user: { select: { avatarUrl: true } },
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
    ]),
  ]);

  const [creatorsCount, publishedCount] = stats;

  return (
    <div>
      {/* Full-Bleed Botanical Writing Studio Hero */}
      <section className="relative w-full overflow-hidden bg-[#090d14] min-h-[560px] lg:min-h-[650px] flex items-end lg:items-center">
        <Image
          src="/images/photos/hero-botanical-desk.jpg"
          alt="Sunlit walnut writing desk beside lush garden foliage with laptop manuscript draft, notebook, brass fountain pen, and coffee cup"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[76%_56%] lg:object-center"
        />

        {/* Mobile bottom-up contrast scrim; desktop left-to-right scrim keeping desk scene clear */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#090d14] via-[#090d14]/90 via-[60%] to-[#090d14]/20 lg:bg-gradient-to-r lg:from-[#090d14] lg:via-[#090d14]/88 lg:via-[45%] lg:to-transparent"
        />
        <div
          aria-hidden="true"
          className="hidden lg:block absolute inset-0 bg-gradient-to-b from-[#090d14]/35 via-transparent to-[#090d14]/45"
        />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-44 pb-12 sm:pt-48 sm:pb-16 lg:py-24">
          <div className="max-w-xl space-y-6 animate-reveal">
            <h1 className="font-editorial text-[2.45rem] sm:text-5xl lg:text-[3.75rem] font-semibold tracking-[-0.025em] text-[#faf7f2] leading-[1.04]">
              Serious writing,
              <br />
              commissioned clearly.
            </h1>

            <p className="text-[15px] sm:text-[17px] text-stone-300 leading-relaxed max-w-md">
              Book vetted researchers, strategists, and editors with locked KES
              totals and escrow protection.
            </p>

            {/* Search Bar */}
            <form
              action="/explore"
              method="GET"
              className="flex flex-col sm:flex-row gap-1.5 bg-white p-1.5 rounded-2xl shadow-2xl max-w-lg"
            >
              <div className="flex-1 flex items-center gap-2.5 px-3">
                <Search className="w-4 h-4 text-stone-400 shrink-0" />
                <input
                  type="text"
                  name="q"
                  aria-label="Search writing services"
                  placeholder="Literature review, RFP, APA edit..."
                  className="w-full py-2.5 text-sm bg-transparent focus:outline-none text-[#111827] placeholder:text-stone-400"
                />
              </div>
              <button
                type="submit"
                className="btn-primary px-6 py-3 text-sm shrink-0"
              >
                Find a writer
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Overlapping Creator Portraits + Single Human Line */}
            <div className="flex items-center gap-3.5 pt-1">
              <div className="flex -space-x-2.5 shrink-0">
                {HERO_CREATOR_PORTRAITS.map((p) => (
                  <div
                    key={p.src}
                    className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-[#090d14] bg-stone-800 shrink-0"
                  >
                    <Image
                      src={p.src}
                      alt={p.alt}
                      width={36}
                      height={36}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs sm:text-sm font-medium text-stone-300">
                {creatorsCount} vetted writers across {publishedCount} active
                services
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Writing Services */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-8 animate-reveal stagger-1">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="font-editorial text-3xl sm:text-4xl font-semibold tracking-tight text-[#111827]">
              Featured services
            </h2>
            <p className="text-sm sm:text-base text-stone-600">
              Upfront KES pricing with revisions and escrow built in.
            </p>
          </div>
          <Link
            href="/explore"
            className="text-sm font-semibold text-[#1e3a8a] hover:underline inline-flex items-center gap-1.5 shrink-0"
          >
            Explore all services
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

      {/* Full-Bleed 5-iPhone Real Journey Showcase */}
      <IphoneJourneyShowcase />

      {/* Curated Categories — High Contrast & Short Copy */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-8 animate-reveal stagger-2">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="font-editorial text-3xl sm:text-4xl font-semibold tracking-tight text-[#111827]">
              Browse by discipline
            </h2>
            <p className="text-sm sm:text-base text-stone-600">
              Focused writing categories assessed to editorial rubric.
            </p>
          </div>
          <Link
            href="/explore"
            className="text-sm font-semibold text-[#1e3a8a] hover:underline inline-flex items-center gap-1.5 shrink-0"
          >
            View directory
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat, idx) => (
            <Link
              key={cat.id}
              href={`/explore?category=${cat.slug}`}
              className={`relative h-52 sm:h-56 rounded-2xl overflow-hidden group block bg-[#090d14] shadow-sm hover:shadow-xl transition-all duration-300 ${
                idx === 0 ? "sm:col-span-2" : ""
              }`}
            >
              <Image
                src={getCategoryPhotoSrc(cat.slug)}
                alt={cat.name}
                fill
                sizes={
                  idx === 0
                    ? "(max-width: 1024px) 100vw, 640px"
                    : "(max-width: 640px) 100vw, 320px"
                }
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#070b12]/96 via-[#070b12]/65 via-[52%] to-[#070b12]/10"
              />

              <div className="relative z-10 h-full p-5 sm:p-6 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-editorial text-xl sm:text-[1.35rem] font-semibold text-white leading-tight">
                    {cat.name}
                  </h3>
                  <p className="text-xs sm:text-[13px] text-stone-200/95 mt-1.5">
                    {shortDisciplineLine(cat.slug, cat.description)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-tech font-medium text-stone-200 group-hover:text-white shrink-0 pb-0.5">
                  <span>{cat._count.listings}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Transparent Fee Simulator Split */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20 animate-reveal stagger-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-5 space-y-5">
            <h2 className="font-editorial text-3xl sm:text-4xl font-semibold tracking-tight text-[#111827] leading-[1.08]">
              Every shilling accounted for before you pay.
            </h2>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
              Free accounts can book any public listing anytime. Upgrade to
              Tovolana Pro to halve service fees and get early access to newly
              vetted tasks.
            </p>
            <div className="pt-1">
              <Link
                href="/membership"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#1e3a8a] hover:underline"
              >
                Compare Free and Pro plans
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7">
            <InteractiveFeeCalculator
              standardFeePct={config?.standardServiceFeePct ?? 10}
              proDiscountPct={config?.proFeeDiscountPct ?? 50}
              monthlyProPrice={config?.proMonthlyPrice ?? 2500}
              currency={config?.currency ?? "KES"}
            />
          </div>
        </div>
      </section>

      {/* Closing Creators Hub Editorial Spotlight */}
      <section className="w-full bg-[#0c1b18] text-white py-16 sm:py-22">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <h2 className="font-editorial text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight leading-[1.08] text-[#faf7f2]">
              Qualify by craft alone. Never by paperwork.
            </h2>

            <p className="text-base text-stone-300 leading-relaxed max-w-lg">
              Pass our 6-criteria writing assessment to open your creator
              studio, publish clear rates, and withdraw approved earnings
              straight to M-Pesa.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div className="border-l-2 border-emerald-400/70 pl-4 space-y-1">
                <p className="text-sm font-semibold text-[#faf7f2]">
                  Live writing exam
                </p>
                <p className="text-xs text-stone-300">
                  Zero ID or certificate uploads
                </p>
              </div>
              <div className="border-l-2 border-emerald-400/70 pl-4 space-y-1">
                <p className="text-sm font-semibold text-[#faf7f2]">
                  Direct M-Pesa payouts
                </p>
                <p className="text-xs text-stone-300">
                  Settled upon client approval
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <Link
                href="/creators-hub/join"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#faf7f2] text-[#0c1b18] text-sm font-semibold hover:bg-emerald-100 transition-colors"
              >
                Take the assessment
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl border border-white/30 bg-white/5 text-white text-sm font-medium hover:bg-white/15 transition-colors"
              >
                Browse open tasks
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative aspect-[16/10] rounded-3xl overflow-hidden shadow-2xl border border-white/15 bg-stone-900">
              <Image
                src="/images/photos/journey-2-work.jpg"
                alt="Writers collaborating on editorial drafts in studio"
                fill
                loading="eager"
                sizes="(max-width: 1024px) 100vw, 620px"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

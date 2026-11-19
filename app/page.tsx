import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isUserProActive } from "@/lib/pricing";
import { HUD_THEME_CYCLE, type HudThemeKey } from "@/lib/design-tokens";
import { TaskCard } from "@/components/TaskCard";
import { getCategoryPhotoSrc } from "@/components/ui/EditorialVisuals";
import {
  AuroraHeading,
  HudActionOrb,
  HudBadge,
  HudCard,
  HudMediaFrame,
  HudPriceDock,
  RadarAvatar,
} from "@/components/ui/AuroraPrimitives";
import { RapidReelMediaFrame } from "@/components/ui/RapidReelMediaFrame";
import { IphoneJourneyShowcase } from "@/components/IphoneJourneyShowcase";
import { InteractiveFeeCalculator } from "@/components/InteractiveFeeCalculator";

export const dynamic = "force-dynamic";

const HERO_CREATOR_PORTRAITS: Array<{
  src: string;
  alt: string;
  theme: HudThemeKey;
  query: string;
}> = [
  {
    src: "/images/photos/avatar-1.jpg",
    alt: "Dr. Amina",
    theme: "cyan",
    query: "Research paper",
  },
  {
    src: "/images/photos/avatar-2.jpg",
    alt: "David",
    theme: "sky",
    query: "Business plan",
  },
  {
    src: "/images/photos/avatar-3.jpg",
    alt: "Wanjiku",
    theme: "emerald",
    query: "Essay",
  },
  {
    src: "/images/photos/avatar-4.jpg",
    alt: "Brian",
    theme: "amber",
    query: "Editing",
  },
];

const SHORT_DISCIPLINE_LINES: Record<string, string> = {
  "academic-writing": "Literature reviews & thesis help",
  "essays-and-assignments": "School essays & assignments",
  "research-papers": "Research papers & reports",
  "articles-and-blog-writing": "Blog posts & web articles",
  "business-writing-and-proposals": "Business plans & proposals",
  "editing-and-proofreading": "Editing & proofreading",
  "other-services": "Speeches, scripts & custom writing",
};

function shortDisciplineLine(slug: string, fallback: string): string {
  if (SHORT_DISCIPLINE_LINES[slug]) return SHORT_DISCIPLINE_LINES[slug];
  const firstClause = fallback.split(/[.,;]/)[0]?.trim();
  return firstClause && firstClause.length <= 42
    ? firstClause
    : "Custom writing help";
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const userIsPro = user
    ? isUserProActive(user.membershipTier, user.proExpiresAt)
    : false;
  const now = new Date();

  const [config, categories, featuredTasks, stats, openBriefs] = await Promise.all([
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
      orderBy: { publishedAt: "desc" },
      take: 6,
    }),
    Promise.all([
      db.creatorProfile.count({ where: { applicationStatus: "APPROVED" } }),
      db.taskListing.count({ where: { status: "PUBLISHED" } }),
    ]),
    db.openBrief.findMany({
      where: { status: "OPEN" },
      orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
      take: 2,
      include: {
        category: { select: { name: true } },
        _count: { select: { bids: true } },
      },
    }),
  ]);

  const [creatorsCount, publishedCount] = stats;

  return (
    <div>
      {/* Minimalist Art-of-Tech Botanical Hero: Visual Sculpture, Zero Clutter, Zero Purple/Pink */}
      <section className="cyber-hero relative w-full overflow-hidden bg-[#040811] min-h-[600px] lg:min-h-[700px] flex items-center">
        {/* Original Botanical Desk Background Image — Open & Vivid */}
        <Image
          src="/images/photos/hero-botanical-desk.jpg"
          alt="Sunlit walnut writing desk beside lush garden foliage with laptop manuscript draft, notebook, brass fountain pen, and coffee cup"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[74%_54%] lg:object-[66%_50%] brightness-[0.9] contrast-[1.04] saturate-[1.06]"
        />

        {/* Sculpted directional glass scrim: readable left stage, open sunlit studio desk on right */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#05080f] via-[#040a15]/78 via-[50%] to-[#040a15]/25 lg:bg-gradient-to-r lg:from-[#040811]/92 lg:via-[#040a15]/62 lg:via-[44%] lg:to-transparent"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-[#040811]/45 via-transparent to-[#05080f]"
        />

        {/* Pure Cyan, Ice-Blue & Emerald Aurora Light (Zero Purple/Pink) */}
        <div
          aria-hidden="true"
          className="animate-aurora-a pointer-events-none absolute -top-36 -left-20 h-[480px] w-[720px] rounded-full opacity-45 blur-[115px]"
          style={{
            background:
              "radial-gradient(ellipse at 42% 48%, rgba(34, 211, 238, 0.46) 0%, rgba(16, 185, 129, 0.22) 48%, transparent 74%)",
          }}
        />
        <div
          aria-hidden="true"
          className="animate-aurora-b pointer-events-none absolute -top-28 right-[-8%] h-[500px] w-[700px] rounded-full opacity-40 blur-[120px]"
          style={{
            background:
              "radial-gradient(ellipse at 55% 45%, rgba(56, 189, 248, 0.44) 0%, rgba(37, 99, 235, 0.26) 48%, transparent 76%)",
          }}
        />

        {/* Glowing Traced SVG Light Bridge Connecting Left Command Stage to Right Holographic Card */}
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 700"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 z-[1] hidden lg:block h-full w-full opacity-65"
        >
          <defs>
            <linearGradient id="hero-bridge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="40%" stopColor="#22d3ee" stopOpacity="0.5" />
              <stop offset="68%" stopColor="#38bdf8" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M 180,388 H 695 C 770,388 790,260 865,260 H 1240"
            fill="none"
            stroke="url(#hero-bridge-grad)"
            strokeWidth="1.3"
          />
          <path
            d="M 180,388 H 695 C 770,388 790,260 865,260 H 1240"
            pathLength={100}
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeDasharray="8 92"
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 6px #22d3ee)" }}
            className="animate-hud-path-flow"
          />
          <circle cx="695" cy="388" r="3" fill="#22d3ee" />
          <circle cx="865" cy="260" r="3.5" fill="#7dd3fc" />
        </svg>

        {/* Bottom cyan-to-sky horizon hairline */}
        <span
          aria-hidden="true"
          className="aurora-horizon-line pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[1.5px] opacity-85"
        />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-18 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Left Stage (7 Cols): Punchy Typography + Sleek Neon Search Dock + Orbital Avatar Constellation */}
            <div className="lg:col-span-7 space-y-7 animate-reveal">
              {/* Caliper-Framed Display Headline & Single-Line Value Promise */}
              <div className="relative pl-4 sm:pl-6 space-y-3.5">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-gradient-to-b from-cyan-300 via-sky-400 to-emerald-400 shadow-[0_0_14px_rgba(34,211,238,0.85)]"
                >
                  <span className="absolute -top-1 -left-[2.5px] h-2 w-2 rounded-full bg-white shadow-[0_0_8px_#22d3ee]" />
                  <span className="absolute -bottom-1 -left-[2.5px] h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_#34d399]" />
                </div>

                <h1 className="font-editorial font-bold tracking-[-0.034em] leading-[1.03] text-[2.35rem] sm:text-[3.35rem] lg:text-[3.7rem] xl:text-[4.05rem]">
                  <span className="cyber-chroma block text-white sm:whitespace-nowrap">
                    Get great writing done.
                  </span>
                  <span className="aurora-title cyber-neon-glow block sm:whitespace-nowrap pb-1">
                    Simple, safe, on time.
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-slate-200/95 font-medium max-w-lg">
                  Tested Kenyan writers. Clear KES prices. Pay only when you approve.
                </p>
              </div>

              {/* Sleek Traced Neon Search Dock */}
              <form
                action="/explore"
                method="GET"
                data-hud-theme="cyan"
                className="relative flex flex-col sm:flex-row gap-2 rounded-2xl border border-cyan-300/35 bg-[#050d1a]/86 p-2 backdrop-blur-xl shadow-[0_18px_48px_-12px_rgba(6,182,212,0.45)] max-w-xl"
              >
                <div
                  aria-hidden="true"
                  className="hud-border-beam-mask overflow-hidden opacity-85"
                >
                  <div className="hud-border-beam-rotor hud-beam-square" />
                </div>

                <div className="relative z-10 flex-1 flex items-center gap-3 px-3.5">
                  <Search className="w-4 h-4 text-cyan-300 shrink-0" />
                  <input
                    type="text"
                    name="q"
                    aria-label="Search writing services"
                    placeholder="What do you need written?"
                    className="w-full py-2.5 text-[15px] bg-transparent focus:outline-none text-white placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary relative z-10 px-6 py-3 text-sm shrink-0"
                >
                  Find a Writer
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Orbital Radar Avatar Constellation Linked by Glowing SVG Circuit */}
              <div className="relative inline-flex flex-wrap items-center gap-4 sm:gap-5 rounded-2xl border border-cyan-300/22 bg-[#050d1a]/75 px-4 py-2.5 backdrop-blur-xl shadow-[0_10px_30px_-12px_rgba(34,211,238,0.35)]">
                {/* Glowing horizontal SVG circuit line behind the 4 counter-rotating radar avatars */}
                <div className="relative flex items-center gap-2.5 sm:gap-3.5">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 220 24"
                    fill="none"
                    className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 h-5 w-[calc(100%-24px)] opacity-75"
                  >
                    <path
                      d="M 4,12 Q 38,3 74,12 T 144,12 T 216,12"
                      stroke="rgba(56, 189, 248, 0.42)"
                      strokeWidth="1.4"
                      strokeDasharray="3 4"
                    />
                    <path
                      d="M 4,12 Q 38,3 74,12 T 144,12 T 216,12"
                      pathLength={100}
                      stroke="#7dd3fc"
                      strokeWidth="2"
                      strokeDasharray="16 84"
                      strokeLinecap="round"
                      className="animate-hud-path-flow"
                    />
                  </svg>

                  {HERO_CREATOR_PORTRAITS.map((writer, idx) => (
                    <Link
                      key={writer.src}
                      href={`/explore?q=${encodeURIComponent(writer.query)}`}
                      title={`${writer.alt} · ${writer.query}`}
                      className={`group relative z-10 transition-transform duration-300 hover:scale-110 ${
                        idx % 2 === 1 ? "sm:-translate-y-1" : "sm:translate-y-0.5"
                      }`}
                    >
                      <RadarAvatar
                        name={writer.alt}
                        avatarUrl={writer.src}
                        available
                        theme={writer.theme}
                        size="md"
                      />
                    </Link>
                  ))}
                </div>

                <div className="flex items-center gap-3 border-l border-cyan-300/20 pl-3.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-pulse-ring absolute inset-0 rounded-full bg-emerald-400" />
                        <span className="relative h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                      </span>
                      <span className="font-tech text-sm font-bold text-white">
                        {creatorsCount} writers online
                      </span>
                    </div>
                    <p className="font-mono text-[10px] tracking-[0.12em] text-cyan-200/80 uppercase">
                      {publishedCount} ready services · ★ 4.9 avg
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Stage (5 Cols): Signature Sculpted Holographic Showcase Card (Exact image.png Architecture) */}
            <div className="lg:col-span-5 animate-reveal stagger-2">
              <div className="relative mx-auto max-w-[395px]">
                {/* Ambient Cyan/Sky Halo + Subtle Outer Orbital HUD Ring Behind Card */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-8 -z-10 rounded-full opacity-70 blur-[64px]"
                  style={{
                    background:
                      "radial-gradient(ellipse at 50% 48%, rgba(34, 211, 238, 0.38) 0%, rgba(56, 189, 248, 0.25) 52%, transparent 76%)",
                  }}
                />
                <svg
                  aria-hidden="true"
                  viewBox="0 0 440 440"
                  fill="none"
                  className="pointer-events-none absolute -inset-6 -z-10 hidden sm:block h-[calc(100%+48px)] w-[calc(100%+48px)] opacity-35"
                >
                  <circle
                    cx="220"
                    cy="220"
                    r="210"
                    stroke="#38bdf8"
                    strokeWidth="1"
                    strokeDasharray="18 14 4 14"
                    className=" origin-center animate-hud-radar-cw"
                  />
                </svg>

                <HudCard
                  theme="cyan"
                  brackets
                  hideBottomBracket
                  dotMatrix="left"
                  dotMatrixPosition="pocket"
                  interactive
                  className="group"
                >
                  <Link
                    href="/explore"
                    aria-label="Explore writing services"
                    className="absolute inset-0 z-10 rounded-[20px] focus:outline-none"
                  />

                  {/* Top Swept-Curve Studio Viewport (Exact image.png Curved Frame & Comet) */}
                  <div className="relative z-20 p-2.5 pb-0 pointer-events-none">
                    <HudMediaFrame
                      src="/images/photos/journey-2-work.jpg"
                      alt="Writers collaborating on research paper in studio"
                      categoryLabel="Research Papers"
                      theme="cyan"
                      aspectClass="aspect-[16/9.2] w-full"
                      sizes="(max-width: 1024px) 100vw, 400px"
                      priority
                    />
                  </div>

                  {/* Clean, Breathable Card Body (Badge + Action Orb + Title + 3 Spec Pills) */}
                  <div className="pointer-events-none relative z-20 px-4 pt-3.5 pb-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <HudBadge label="RESEARCH REPORT" sparkle />
                      <HudActionOrb theme="cyan" />
                    </div>

                    <h2 className="font-editorial text-[1.15rem] font-bold leading-snug tracking-tight text-white">
                      Empirical Research Paper &amp; Full Citations
                    </h2>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.16] bg-[#070d18]/78 px-2.5 py-1 font-tech text-[11px] font-medium text-slate-100">
                        <Clock className="h-3 w-3 text-sky-300" />
                        2d delivery
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.16] bg-[#070d18]/78 px-2.5 py-1 font-tech text-[11px] font-medium text-slate-100">
                        <RotateCcw className="h-3 w-3 text-cyan-300" />
                        2 free edits
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-500/[0.1] px-2.5 py-1 font-tech text-[11px] font-medium text-emerald-200">
                        <ShieldCheck className="h-3 w-3 text-emerald-300" />
                        Safe escrow
                      </span>
                    </div>

                    {/* Lower-right corner bracket nestled above raised price shelf */}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 12 12"
                      fill="none"
                      className="pointer-events-none absolute right-2.5 bottom-1 h-2.5 w-2.5"
                    >
                      <path
                        d="M10.5 1.5V9.5C10.5 10.05 10.05 10.5 9.5 10.5H1.5"
                        stroke="#67f5e1"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  {/* Signature Traced S-Curve Dual-Pod Translucent Footer (Exact image.png Design) */}
                  <footer className="relative mt-auto pt-3.5 px-3.5 pb-3">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute right-2 bottom-1 h-16 w-40 rounded-full bg-cyan-400/25 opacity-45 blur-md"
                    />

                    <svg
                      aria-hidden="true"
                      viewBox="0 0 360 80"
                      preserveAspectRatio="none"
                      className="pointer-events-none absolute inset-0 h-full w-full"
                    >
                      <defs>
                        <linearGradient id="hero-pocket-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="rgba(14, 52, 68, 0.94)" />
                          <stop offset="100%" stopColor="rgba(28, 100, 142, 0.74)" />
                        </linearGradient>
                        <linearGradient id="hero-pod-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="rgba(8, 17, 30, 0.94)" />
                          <stop offset="100%" stopColor="rgba(14, 28, 44, 0.8)" />
                        </linearGradient>
                        <linearGradient id="hero-trace-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.16)" />
                          <stop offset="46%" stopColor="#22d3ee" />
                          <stop offset="68%" stopColor="#7dd3fc" />
                          <stop offset="100%" stopColor="#38bdf8" />
                        </linearGradient>
                      </defs>

                      <path
                        d="M 168,74 C 182,52 196,24 212,5 H 338 Q 354,5 354,21 V 60 Q 354,74 338,74 Z"
                        fill="url(#hero-pocket-grad)"
                      />
                      <path
                        d="M 8,28 Q 8,14 22,14 H 204 C 194,34 176,56 166,74 H 22 Q 8,74 8,60 Z"
                        fill="url(#hero-pod-grad)"
                        stroke="rgba(125, 211, 252, 0.25)"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d="M 22,74 H 168 C 182,52 196,24 212,5 H 338 Q 354,5 354,21 V 60 Q 354,74 338,74"
                        fill="none"
                        stroke="url(#hero-trace-grad)"
                        strokeWidth="1.35"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d="M 22,74 H 168 C 182,52 196,24 212,5 H 338 Q 354,5 354,21 V 60 Q 354,74 338,74"
                        pathLength={100}
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth="5"
                        strokeDasharray="18 82"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        style={{ filter: "blur(2.5px)" }}
                        className="animate-hud-scurve opacity-85"
                      />
                      <path
                        d="M 22,74 H 168 C 182,52 196,24 212,5 H 338 Q 354,5 354,21 V 60 Q 354,74 338,74"
                        pathLength={100}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        strokeDasharray="11 89"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        className="animate-hud-scurve opacity-95"
                      />
                    </svg>

                    <div className="relative z-20 flex items-center justify-between gap-2.5 pt-2.5">
                      <div className="flex min-w-0 max-w-[56%] items-center gap-2 py-0.5 pr-1">
                        <RadarAvatar
                          name="Wanjiku M."
                          avatarUrl="/images/photos/avatar-3.jpg"
                          available
                          theme="cyan"
                          size="sm"
                        />
                        <div className="min-w-0">
                          <span className="block truncate text-[12.5px] font-semibold text-white">
                            Wanjiku M.
                          </span>
                          <div className="flex items-center gap-1 text-[11px]">
                            <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                            <span className="font-tech font-bold text-amber-200">
                              5.0
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="ml-auto shrink-0 translate-y-[-1px]">
                        <HudPriceDock
                          label="FROM"
                          price="KES 4,400"
                          theme="cyan"
                          size="sm"
                        />
                      </div>
                    </div>
                  </footer>
                </HudCard>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Writing Services (Exact HUD Card Row) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-8 animate-reveal stagger-1">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <AuroraHeading
              as="h2"
              className="text-3xl sm:text-4xl font-bold"
            >
              Popular writing services
            </AuroraHeading>
            <p className="text-sm sm:text-base text-slate-400">
              Fixed prices upfront, free edits, and safe payment included.
            </p>
          </div>
          <Link
            href="/explore"
            className="text-sm font-semibold text-sky-400 hover:text-sky-300 hover:underline inline-flex items-center gap-1.5 shrink-0"
          >
            See all services
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredTasks.map((task, idx) => (
            <TaskCard
              key={task.id}
              task={task}
              standardFeePct={config?.standardServiceFeePct ?? 10}
              proDiscountPct={config?.proFeeDiscountPct ?? 50}
              userIsPro={userIsPro}
              themeOverride={HUD_THEME_CYCLE[idx % HUD_THEME_CYCLE.length]}
              index={idx}
            />
          ))}
        </div>
      </section>

      {/* 3 Simple Ways to Start */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
              3 Simple Ways to Start
            </p>
            <AuroraHeading as="h2" className="text-2xl sm:text-3xl mt-1">
              Pick what works best for you
            </AuroraHeading>
          </div>
          <Link
            href="/bidding"
            className="inline-flex items-center gap-2 text-sm font-semibold text-sky-400 hover:text-sky-300 hover:underline"
          >
            See Open Jobs →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <HudCard theme="amber" brackets dotMatrix="right" phaseIndex={0} className="p-6 space-y-3">
            <HudBadge label="Most Popular" sparkle />
            <h3 className="font-editorial text-xl font-semibold text-white pt-1">
              Try Page 1 first (KES 490)
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Want to test quality first? Pay KES 490 for an outline and Page 1
              in 12 hours. Only pay the rest if you love it.
            </p>
            <Link
              href="/explore"
              className="inline-block text-xs font-semibold text-amber-300 hover:underline pt-1"
            >
              Pick a service to try →
            </Link>
          </HudCard>

          <HudCard theme="sky" brackets dotMatrix="right" phaseIndex={2} className="p-6 space-y-3">
            <HudBadge label="Free to Post" sparkle />
            <h3 className="font-editorial text-xl font-semibold text-white pt-1">
              Post your project &amp; get offers
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Tell us what you need for free. Tested writers send their prices
              and timelines, and you pick your favorite.
            </p>
            <Link
              href="/bidding"
              className="inline-block text-xs font-semibold text-sky-300 hover:underline pt-1"
            >
              Post a job for free →
            </Link>
          </HudCard>

          <HudCard theme="cyan" brackets dotMatrix="right" phaseIndex={4} className="p-6 space-y-3">
            <HudBadge label="Safe Payment" sparkle />
            <h3 className="font-editorial text-xl font-semibold text-white pt-1">
              Order ready services
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Book a fixed-price service with 25% down or full payment. Your
              money is only sent to the writer after you approve.
            </p>
            <Link
              href="/membership"
              className="inline-block text-xs font-semibold text-teal-300 hover:underline pt-1"
            >
              See Free vs Pro pricing →
            </Link>
          </HudCard>
        </div>

        {openBriefs.length > 0 && (
          <HudCard theme="sky" brackets className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-300">
                  Open Client Jobs
                </p>
                <h3 className="font-editorial text-lg font-semibold text-white">
                  Projects looking for a writer right now
                </h3>
              </div>
              <Link
                href="/bidding"
                className="btn-primary px-4 py-2 text-xs whitespace-nowrap"
              >
                See All Open Jobs
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {openBriefs.map((brief) => (
                <Link
                  key={brief.id}
                  href={`/bidding/${brief.id}`}
                  className="p-4 rounded-xl bg-white/[0.045] border border-white/[0.11] hover:border-cyan-400/50 transition-colors flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-sky-300">
                      {brief.category.name}
                    </span>
                    <span className="font-tech text-slate-400">
                      {brief._count.bids} offers · {brief.requiredConnects} Credits
                    </span>
                  </div>
                  <p className="font-editorial font-semibold text-white line-clamp-1">
                    {brief.title}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                    <span className="font-tech font-semibold text-teal-300">
                      KES {Number(brief.budgetMin).toLocaleString()} –{" "}
                      {Number(brief.budgetMax).toLocaleString()}
                    </span>
                    <span className="text-sky-300 font-medium">
                      See offers →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </HudCard>
        )}
      </section>

      {/* Full-Bleed 5-iPhone Real Journey Showcase */}
      <IphoneJourneyShowcase />

      {/* Curated Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-8 animate-reveal stagger-2">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <AuroraHeading as="h2" className="text-3xl sm:text-4xl">
              What do you need help with?
            </AuroraHeading>
            <p className="text-sm sm:text-base text-slate-400">
              Pick a category to see services and prices.
            </p>
          </div>
          <Link
            href="/explore"
            className="text-sm font-semibold text-sky-400 hover:text-sky-300 hover:underline inline-flex items-center gap-1.5 shrink-0"
          >
            See all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat, idx) => (
            <Link
              key={cat.id}
              href={`/explore?category=${cat.slug}`}
              className={`relative h-52 sm:h-56 rounded-2xl overflow-hidden group block bg-[#060a12] border border-white/[0.12] hover:border-cyan-400/50 hover:shadow-[0_0_28px_-6px_rgba(45,212,191,0.3)] transition-all duration-300 ${
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
              <span
                aria-hidden="true"
                className="aurora-horizon-line pointer-events-none absolute inset-x-0 top-0 z-20 h-[2px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#05080f]/95 via-[#05080f]/60 via-[52%] to-[#05080f]/15"
              />

              <div className="relative z-10 h-full p-5 sm:p-6 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-editorial text-xl sm:text-[1.35rem] font-semibold text-white leading-tight group-hover:text-cyan-300 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs sm:text-[13px] text-slate-200/95 mt-1.5">
                    {shortDisciplineLine(cat.slug, cat.description)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-tech font-medium text-cyan-300 group-hover:text-white shrink-0 pb-0.5">
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
            <AuroraHeading
              as="h2"
              className="text-3xl sm:text-4xl leading-[1.08]"
            >
              Clear prices. No surprise fees.
            </AuroraHeading>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Free accounts can order any public service anytime. Upgrade to
              Pro only if you want 50% off the small service fee and early
              access to new services.
            </p>
            <div className="pt-1">
              <Link
                href="/membership"
                className="inline-flex items-center gap-2 text-sm font-semibold text-sky-400 hover:text-sky-300 hover:underline"
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

      {/* Closing Writer Hub Spotlight */}
      <section className="w-full border-t border-white/[0.08] bg-gradient-to-br from-teal-950/35 via-[#070b14]/80 to-violet-950/30 text-white py-16 sm:py-22 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <AuroraHeading
              as="h2"
              className="text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.08]"
            >
              Good at writing? Earn money here.
            </AuroraHeading>

            <p className="text-base text-slate-300 leading-relaxed max-w-lg">
              No ID cards or degree papers needed. Pass a quick 45-minute
              writing test to offer your services, apply for open jobs, and
              withdraw to M-Pesa.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div className="border-l-2 border-teal-400 pl-4 space-y-1">
                <p className="text-sm font-semibold text-white">
                  Quick writing test
                </p>
                <p className="text-xs text-slate-300">
                  No ID or certificate uploads
                </p>
              </div>
              <div className="border-l-2 border-teal-400 pl-4 space-y-1">
                <p className="text-sm font-semibold text-white">
                  Direct M-Pesa payouts
                </p>
                <p className="text-xs text-slate-300">
                  Withdraw once clients approve
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <Link
                href="/creators-hub/join"
                className="btn-primary px-6 py-3.5 text-sm"
              >
                Start Writing Test
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/bidding"
                className="btn-ghost px-5 py-3.5 text-sm"
              >
                Browse Open Jobs
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <HudCard theme="cyan" brackets className="p-2 sm:p-3">
              <RapidReelMediaFrame
                categoryLabel="Writer Hub"
                theme="cyan"
                aspectClass="aspect-[16/10] w-full"
                sizes="(max-width: 1024px) 100vw, 620px"
              />
            </HudCard>
          </div>
        </div>
      </section>
    </div>
  );
}

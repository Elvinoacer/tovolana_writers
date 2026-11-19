import { useId } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Clock,
  Crown,
  FileCheck2,
  RotateCcw,
  Sparkles,
  Star,
} from "lucide-react";
import { formatKes } from "@/components/ui/Badges";
import { getCategoryPhotoSrc } from "@/components/ui/EditorialVisuals";
import {
  HudActionOrb,
  HudBadge,
  HudCard,
  HudMediaFrame,
  HudPriceDock,
  RadarAvatar,
} from "@/components/ui/AuroraPrimitives";
import {
  HUD_ACCENT_HEX,
  getCardHudTheme,
  type HudThemeKey,
} from "@/lib/design-tokens";
import { calculateBookingPricing, isFutureTimestamp } from "@/lib/pricing";

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
 * Futuristic Aurora HUD Service Card matching ambitious_screen_designs/card1_crop.png..card3_crop.png:
 * - Living two-tone perimeter aurora wash with high-contrast smoked reading core
 * - Cascading 3x5 dot-matrix telemetry and swept curved media frame
 * - Dashed neon HUD tag + circular orbital energy arrow orb
 * - Dual-pod sculpted translucent footer with traceable S-curve contour lines,
 *   counter-rotating radar avatar rings, and alternating beveled price dock
 */
export function TaskCard({
  task,
  standardFeePct = 10,
  proDiscountPct = 50,
  userIsPro = false,
  featured = false,
  themeOverride,
  index,
}: {
  task: TaskCardItem;
  standardFeePct?: number;
  proDiscountPct?: number;
  userIsPro?: boolean;
  featured?: boolean;
  themeOverride?: HudThemeKey;
  index?: number;
}) {
  const rawId = useId();
  const safeId = rawId.replace(/:/g, "");
  const pocketGradId = `hud-pocket-${safeId}`;
  const podGradId = `hud-pod-${safeId}`;
  const traceGradId = `hud-trace-${safeId}`;
  const railGradId = `hud-rail-${safeId}`;

  const pricing = calculateBookingPricing({
    listedPrice: task.basePrice,
    standardServiceFeePct: standardFeePct,
    proFeeDiscountPct: proDiscountPct,
    serviceFeePctOverride: task.serviceFeePctOverride,
    userIsPro,
  });

  const theme =
    themeOverride ?? getCardHudTheme(task.category.slug, index);
  const palette = HUD_ACCENT_HEX[theme];
  const isProEarlyAccess = isFutureTimestamp(task.proEarlyAccessUntil);
  const photoSrc = getCategoryPhotoSrc(task.category.slug);
  const deliverables = Array.isArray(task.deliverablesSummary)
    ? task.deliverablesSummary.filter(Boolean)
    : [];
  const isQuoteBased = task.pricingType === "QUOTE_BASED";
  const taskHref = `/tasks/${task.slug}`;

  // Dual-pod traced-line geometry tuned cleanly for standard cards vs wide featured spotlight cards
  const podTopX = featured ? 244 : 204;
  const podBottomX = featured ? 208 : 166;
  const shelfStartBottomX = featured ? 210 : 168;
  const shelfMidX = featured ? 236 : 194;
  const shelfTopX = featured ? 256 : 212;

  const leftPodPath = `M 8,28 Q 8,14 22,14 H ${podTopX} C ${podTopX - 10},34 ${podBottomX + 10},56 ${podBottomX},74 H 22 Q 8,74 8,60 Z`;
  const rightPocketPath = `M ${shelfStartBottomX},74 C ${shelfMidX - 12},52 ${shelfMidX + 2},24 ${shelfTopX},5 H 338 Q 354,5 354,21 V 60 Q 354,74 338,74 Z`;
  const sCurveTracePath = `M 22,74 H ${shelfStartBottomX} C ${shelfMidX - 12},52 ${shelfMidX + 2},24 ${shelfTopX},5 H 338 Q 354,5 354,21 V 60 Q 354,74 338,74`;

  return (
    <HudCard
      theme={theme}
      brackets
      hideBottomBracket
      dotMatrix={index !== undefined && index % 3 === 2 ? "right" : "left"}
      dotMatrixPosition="pocket"
      phaseIndex={index ?? 0}
      liveAurora
      interactive
      className="group h-full"
    >
      <article
        className={`relative flex h-full w-full flex-col ${
          featured ? "md:flex-row" : ""
        }`}
      >
        {/* Full-Card Primary Link */}
        <Link
          href={taskHref}
          aria-label={`View ${task.title}`}
          className="absolute inset-0 z-10 cursor-pointer rounded-[20px] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060a12]"
        />

        {/* Sculpted Media Viewport */}
        <div
          className={`relative z-20 shrink-0 p-2 pb-0 pointer-events-none ${
            featured ? "md:w-[44%] md:p-3 md:pr-0" : "w-full"
          }`}
        >
          <HudMediaFrame
            src={photoSrc}
            alt={task.category.name}
            categoryLabel={task.category.name}
            theme={theme}
            aspectClass={
              featured
                ? "aspect-[16/10] w-full md:h-full md:aspect-auto"
                : "aspect-[16/9] w-full"
            }
            sizes={
              featured
                ? "(max-width: 768px) 100vw, 520px"
                : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
            }
            topRightSlot={
              <>
                {featured && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-slate-950/80 px-2.5 py-1 text-[10px] font-tech font-semibold uppercase tracking-wider text-white backdrop-blur-md">
                    <Sparkles className="h-3 w-3 text-amber-300" />
                    Spotlight
                  </span>
                )}
                {isProEarlyAccess && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/55 bg-amber-950/80 px-2.5 py-1 text-[11px] font-semibold text-amber-200 backdrop-blur-md">
                    <Crown className="h-3 w-3 text-amber-300" aria-hidden="true" />
                    Pro
                  </span>
                )}
              </>
            }
            bottomLeftSlot={
              isQuoteBased ? (
                <span className="inline-flex items-center rounded-md border border-white/25 bg-slate-950/80 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-100 backdrop-blur-md">
                  Custom quote
                </span>
              ) : undefined
            }
          />
        </div>

        {/* Main Content + Sculpted Traced Footer Deck */}
        <div className="pointer-events-none relative z-20 flex flex-1 flex-col justify-between">
          <div
            className={`relative space-y-3 ${
              featured ? "p-5 sm:p-7 sm:pb-4" : "px-4 pt-3.5 pb-4"
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <HudBadge label={task.serviceType} sparkle />
                <HudActionOrb theme={theme} />
              </div>

              <h3
                className={`font-editorial font-bold tracking-tight text-white transition-all duration-200 group-hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.22)] line-clamp-2 ${
                  featured
                    ? "text-xl leading-snug sm:text-2xl"
                    : "text-[1.06rem] leading-[1.32]"
                }`}
              >
                {task.title}
              </h3>

              <p
                className={`text-[12.5px] leading-relaxed text-slate-200/85 ${
                  featured ? "line-clamp-2 max-w-2xl" : "line-clamp-1"
                }`}
              >
                {task.shortDescription}
              </p>
            </div>

            {/* Smoked Dark Spec Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.16] bg-[#070d18]/78 px-2.5 py-1 font-tech text-[11px] font-medium text-slate-100 backdrop-blur-md transition-colors group-hover:border-white/25">
                <Clock className="h-3 w-3 text-sky-300" aria-hidden="true" />
                {task.deliveryTurnaroundDays}{" "}
                {task.deliveryTurnaroundDays === 1 ? "day" : "days"}
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.16] bg-[#070d18]/78 px-2.5 py-1 font-tech text-[11px] font-medium text-slate-100 backdrop-blur-md transition-colors group-hover:border-white/25">
                <RotateCcw
                  className="h-3 w-3 text-teal-300"
                  aria-hidden="true"
                />
                {task.maxRevisions}{" "}
                {task.maxRevisions === 1 ? "free edit" : "free edits"}
              </span>

              {deliverables.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.16] bg-[#070d18]/78 px-2.5 py-1 font-tech text-[11px] font-medium text-slate-100 backdrop-blur-md transition-colors group-hover:border-white/25">
                  <FileCheck2
                    className="h-3 w-3 text-amber-300"
                    aria-hidden="true"
                  />
                  {deliverables.length}{" "}
                  {deliverables.length === 1 ? "file" : "files"}
                </span>
              )}
            </div>

            {/* Lower-right corner bracket nestled cleanly above raised footer shelf */}
            <svg
              aria-hidden="true"
              viewBox="0 0 12 12"
              fill="none"
              style={{ filter: `drop-shadow(0 0 4px ${palette.glow})` }}
              className="pointer-events-none absolute right-2.5 bottom-1 h-2.5 w-2.5"
            >
              <path
                d="M10.5 1.5V9.5C10.5 10.05 10.05 10.5 9.5 10.5H1.5"
                stroke={palette.bright}
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Sculpted Dual-Pod Traced-Line Translucent Footer Deck */}
          <footer className="relative mt-auto pt-3.5 px-3.5 pb-3">
            {/* Soft radial aurora behind right price dock */}
            <div
              aria-hidden="true"
              style={{
                background: `radial-gradient(ellipse at 82% 58%, ${palette.glow} 0%, transparent 66%)`,
              }}
              className="pointer-events-none absolute right-2 bottom-1 h-16 w-40 opacity-35 blur-md transition-opacity duration-300 group-hover:opacity-65"
            />

            <svg
              aria-hidden="true"
              viewBox="0 0 360 80"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <defs>
                <linearGradient
                  id={pocketGradId}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--hud-footer-pocket-bg)"
                    stopOpacity="0.95"
                  />
                  <stop
                    offset="100%"
                    stopColor={palette.secondaryGlow}
                    stopOpacity="0.72"
                  />
                </linearGradient>

                <linearGradient
                  id={podGradId}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--hud-footer-pod-bg)"
                    stopOpacity="0.92"
                  />
                  <stop
                    offset="100%"
                    stopColor="rgba(16, 30, 38, 0.76)"
                  />
                </linearGradient>

                <linearGradient
                  id={traceGradId}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop
                    offset="0%"
                    stopColor="rgba(255, 255, 255, 0.14)"
                  />
                  <stop
                    offset="46%"
                    stopColor="var(--hud-footer-line)"
                  />
                  <stop
                    offset="64%"
                    stopColor="var(--hud-footer-line-bright)"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--hud-footer-line)"
                  />
                </linearGradient>

                <linearGradient
                  id={railGradId}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
                  <stop offset="45%" stopColor="rgba(255,255,255,0.28)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
                </linearGradient>
              </defs>

              {/* Layer 1: Raised translucent colored frosted pocket behind price */}
              <path
                d={rightPocketPath}
                fill={`url(#${pocketGradId})`}
              />

              {/* Layer 2: Left dark smoked translucent writer pod */}
              <path
                d={leftPodPath}
                fill={`url(#${podGradId})`}
                stroke={`url(#${railGradId})`}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />

              {/* Layer 3: Continuous traceable glowing S-curve contour */}
              <path
                d={sCurveTracePath}
                fill="none"
                stroke={`url(#${traceGradId})`}
                strokeWidth="1.25"
                vectorEffect="non-scaling-stroke"
                className="hud-footer-trace opacity-85 transition-opacity duration-300"
              />

              {/* Bi-directional traveling neon light beam tracing the S-curve & price shelf */}
              <path
                d={sCurveTracePath}
                pathLength={100}
                fill="none"
                stroke={palette.accent}
                strokeWidth="5"
                strokeDasharray="18 82"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ filter: "blur(2.5px)" }}
                className="animate-hud-scurve opacity-85"
              />
              <path
                d={sCurveTracePath}
                pathLength={100}
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeDasharray="11 89"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ filter: `drop-shadow(0 0 4px ${palette.bright})` }}
                className="animate-hud-scurve opacity-95"
              />

              {/* Crisper specular top highlight along the raised shelf rail */}
              <path
                d={`M ${shelfTopX},5 H 336`}
                fill="none"
                stroke={palette.bright}
                strokeOpacity="0.45"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <div className="relative z-20 flex items-center justify-between gap-2.5 pt-2.5">
              {task.creator ? (
                <Link
                  href={`/creators/${task.creator.username}`}
                  className="pointer-events-auto relative z-30 group/creator flex min-w-0 max-w-[56%] cursor-pointer items-center gap-2 rounded-xl py-0.5 pr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <RadarAvatar
                    name={task.creator.displayName}
                    avatarUrl={task.creator.user?.avatarUrl}
                    available={task.creator.isAvailable ?? true}
                    theme={theme}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-white group-hover/creator:underline decoration-white/60 underline-offset-2">
                      {task.creator.displayName}
                    </span>
                    <span className="inline-flex items-center gap-1 font-tech text-[11px] font-semibold text-slate-100">
                      <Star
                        className="h-3 w-3 fill-amber-400 text-amber-400"
                        aria-hidden="true"
                      />
                      {task.creator.ratingAverage.toFixed(1)}
                      <Star
                        className="h-2.5 w-2.5 text-white/25"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100 max-w-[56%]">
                  <BadgeCheck
                    className="h-4 w-4 text-teal-300"
                    aria-hidden="true"
                  />
                  <span className="truncate">Tested Writer</span>
                </div>
              )}

              <HudPriceDock
                label={userIsPro ? "Pro total" : "From"}
                price={formatKes(pricing.totalPayable, task.currency)}
                theme={theme}
                size="sm"
              />
            </div>
          </footer>
        </div>
      </article>
    </HudCard>
  );
}

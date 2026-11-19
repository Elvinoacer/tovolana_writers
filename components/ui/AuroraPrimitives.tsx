import React, { useId } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { HUD_ACCENT_HEX, type HudThemeKey } from "@/lib/design-tokens";
import { isAllowedNextImageSrc } from "@/lib/upload-constants";

function getInitials(name: string): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "TV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Global living Aurora Borealis + subtle starfield layer shared across the entire platform.
 */
export function AuroraBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#05080f]"
    >
      {/* Subtle night-sky starfield */}
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 14% 22%, rgba(255,255,255,0.75) 50%, transparent 50%)," +
            "radial-gradient(1.5px 1.5px at 31% 11%, rgba(94,234,212,0.7) 50%, transparent 50%)," +
            "radial-gradient(1px 1px at 54% 18%, rgba(255,255,255,0.65) 50%, transparent 50%)," +
            "radial-gradient(1.5px 1.5px at 78% 14%, rgba(216,180,254,0.7) 50%, transparent 50%)," +
            "radial-gradient(1px 1px at 88% 36%, rgba(255,255,255,0.6) 50%, transparent 50%)," +
            "radial-gradient(1px 1px at 22% 58%, rgba(125,211,252,0.65) 50%, transparent 50%)," +
            "radial-gradient(1.5px 1.5px at 67% 64%, rgba(255,255,255,0.55) 50%, transparent 50%)," +
            "radial-gradient(1px 1px at 42% 82%, rgba(94,234,212,0.5) 50%, transparent 50%)",
          backgroundSize: "480px 420px",
        }}
      />

      {/* Emerald-cyan left aurora ribbon */}
      <div
        className="animate-aurora-a will-change-transform absolute -top-32 -left-24 h-[520px] w-[720px] rounded-full opacity-45 blur-[110px]"
        style={{
          background:
            "radial-gradient(ellipse at 40% 45%, rgba(45, 212, 191, 0.42) 0%, rgba(16, 185, 129, 0.24) 42%, transparent 74%)",
        }}
      />

      {/* Sky-sapphire upper curtain aurora */}
      <div
        className="animate-aurora-b will-change-transform absolute -top-24 left-[28%] h-[500px] w-[760px] rounded-full opacity-40 blur-[115px]"
        style={{
          background:
            "radial-gradient(ellipse at 52% 45%, rgba(37, 99, 235, 0.36) 0%, rgba(56, 189, 248, 0.28) 45%, transparent 75%)",
        }}
      />

      {/* Amber-teal lower horizon glow */}
      <div
        className="animate-aurora-c will-change-transform absolute bottom-[-160px] right-[-100px] h-[540px] w-[720px] rounded-full opacity-35 blur-[120px]"
        style={{
          background:
            "radial-gradient(ellipse at 55% 55%, rgba(20, 184, 166, 0.34) 0%, rgba(245, 158, 11, 0.18) 46%, transparent 76%)",
        }}
      />

      {/* Deep header scrim keeping sticky navbar readable */}
      <div
        className="absolute inset-x-0 top-0 h-28"
        style={{
          background:
            "linear-gradient(180deg, rgba(4, 7, 13, 0.72) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}

/**
 * Gradient aurora headline matching the signature cyan -> sky -> violet sweep.
 */
export function AuroraHeading({
  as = "h1",
  className = "",
  children,
}: {
  as?: "h1" | "h2" | "h3";
  className?: string;
  children: React.ReactNode;
}) {
  const Tag = as;
  return (
    <Tag
      className={`aurora-title font-editorial font-bold tracking-tight ${className}`}
    >
      {children}
    </Tag>
  );
}

/**
 * HUD dark-glass panel with kinetic dual-beam rotating neon perimeter,
 * live drifting aurora wash, corner brackets, and snake-wave LED dot-matrix.
 */
export function HudCard({
  theme = "cyan",
  brackets = true,
  hideBottomBracket = false,
  dotMatrix = "none",
  dotMatrixPosition = "top",
  microLabel,
  interactive = false,
  liveAurora = true,
  phaseIndex = 0,
  className = "",
  children,
}: {
  theme?: HudThemeKey;
  brackets?: boolean;
  hideBottomBracket?: boolean;
  dotMatrix?: "left" | "right" | "none";
  dotMatrixPosition?: "top" | "pocket";
  microLabel?: string;
  interactive?: boolean;
  liveAurora?: boolean;
  phaseIndex?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const palette = HUD_ACCENT_HEX[theme];
  const phaseSec = -((phaseIndex % 6) * 0.85);
  const phaseStyle = { "--hud-phase": `${phaseSec}s` } as React.CSSProperties;

  return (
    <div
      data-hud-theme={theme}
      style={phaseStyle}
      className={`hud-card relative overflow-hidden rounded-[20px] ${
        interactive ? "hud-card-interactive" : ""
      } ${className}`}
    >
      {/* Live bi-directional perimeter aurora wash + smoked reading core (strictly behind content) */}
      {liveAurora && (
        <div
          aria-hidden="true"
          className="hud-card-aurora-layer pointer-events-none absolute inset-0 -z-10 opacity-75 transition-opacity duration-500"
        >
          <div
            className="animate-hud-aurora-a absolute -top-14 -left-12 h-64 w-72 rounded-full blur-[46px]"
            style={{
              background:
                "radial-gradient(ellipse at 45% 45%, var(--hud-aurora-a) 0%, transparent 72%)",
            }}
          />
          <div
            className="animate-hud-aurora-b absolute top-14 -right-12 h-64 w-72 rounded-full blur-[46px]"
            style={{
              background:
                "radial-gradient(ellipse at 50% 50%, var(--hud-aurora-b) 0%, transparent 72%)",
            }}
          />
          <div className="pointer-events-none absolute inset-[1px] rounded-[19px] bg-gradient-to-b from-transparent via-[#050a14]/52 to-[#050a14]/70" />
        </div>
      )}

      {/* Rotating dual-beam neon perimeter border (crisp line + soft neon bloom) */}
      {liveAurora && (
        <div
          aria-hidden="true"
          className="hud-border-beam-wrap pointer-events-none absolute inset-0 z-20 rounded-[inherit] opacity-80 transition-all duration-300"
        >
          <div className="hud-border-beam-mask">
            <div className="hud-border-beam-rotor" />
          </div>
          <div className="hud-border-beam-mask opacity-60 blur-[3px]">
            <div className="hud-border-beam-rotor" />
          </div>
        </div>
      )}

      {brackets && (
        <>
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            fill="none"
            style={{ filter: `drop-shadow(0 0 4px ${palette.glow})` }}
            className="pointer-events-none absolute top-2 left-2 z-20 h-3 w-3"
          >
            <path
              d="M1.5 10.5V2.5C1.5 1.95 1.95 1.5 2.5 1.5H10.5"
              stroke={palette.bright}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            fill="none"
            style={{ filter: `drop-shadow(0 0 4px ${palette.glow})` }}
            className="pointer-events-none absolute top-2 right-2 z-20 h-3 w-3"
          >
            <path
              d="M10.5 10.5V2.5C10.5 1.95 10.05 1.5 9.5 1.5H1.5"
              stroke={palette.bright}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          {!hideBottomBracket && (
            <svg
              aria-hidden="true"
              viewBox="0 0 12 12"
              fill="none"
              style={{ filter: `drop-shadow(0 0 4px ${palette.glow})` }}
              className="pointer-events-none absolute right-2 bottom-2 z-20 h-2.5 w-2.5"
            >
              <path
                d="M10.5 1.5V9.5C10.5 10.05 10.05 10.5 9.5 10.5H1.5"
                stroke={palette.bright}
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          )}
        </>
      )}

      {/* Animated snake-pattern LED dot-matrix telemetry */}
      {dotMatrix !== "none" && (
        <div
          aria-hidden="true"
          style={{ color: palette.bright }}
          className={`pointer-events-none absolute z-20 grid grid-cols-3 gap-[4px] ${
            dotMatrixPosition === "pocket" ? "top-[44px]" : "top-6"
          } ${dotMatrix === "right" ? "right-2.5" : "left-2.5"}`}
        >
          {Array.from({ length: 15 }).map((_, idx) => {
            const row = Math.floor(idx / 3);
            const col = idx % 3;
            const seq = row % 2 === 0 ? row * 3 + col : row * 3 + (2 - col);
            const dotStyle = {
              "--dot-delay": `${(seq * 0.13).toFixed(2)}s`,
            } as React.CSSProperties;
            return (
              <span
                key={idx}
                style={dotStyle}
                className="hud-dot-cell h-[3px] w-[3px] rounded-full bg-current"
              />
            );
          })}
        </div>
      )}

      {microLabel && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1.5 right-7 z-20 font-mono text-[8px] tracking-[0.14em] text-slate-300/65 uppercase"
        >
          {microLabel}
        </span>
      )}

      {children}
    </div>
  );
}

/**
 * Dashed neon HUD tag with smoked backing and luminous 4-point sparkle accent.
 */
export function HudBadge({
  label,
  sparkle = true,
  className = "",
}: {
  label: string;
  sparkle?: boolean;
  className?: string;
}) {
  return (
    <span
      style={{
        color: "var(--hud-badge-text)",
        backgroundColor: "var(--hud-badge-bg)",
        borderColor: "var(--hud-badge-border)",
        boxShadow: "0 0 14px -6px var(--hud-glow)",
      }}
      className={`relative inline-flex items-center gap-1.5 rounded-[5px] border border-dashed bg-[#050b14]/75 px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.08em] uppercase backdrop-blur-sm ${className}`}
    >
      <span className="truncate max-w-[200px]">{label}</span>
      {sparkle && (
        <span
          aria-hidden="true"
          style={{ textShadow: "0 0 8px var(--hud-accent-bright)" }}
          className="text-[9px] leading-none"
        >
          ✦
        </span>
      )}
    </span>
  );
}

/**
 * Circular kinetic neon beacon positioned opposite the HUD tag on cards.
 * Combines a sonar ripple ring, breathing radial halo, and counter-rotating
 * dual orbital neon energy arcs around a steady white-hot arrow core.
 */
export function HudActionOrb({
  theme = "cyan",
  className = "",
}: {
  theme?: HudThemeKey;
  className?: string;
}) {
  const palette = HUD_ACCENT_HEX[theme];
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center ${className}`}
    >
      {/* Expanding neon sonar wave */}
      <span
        style={{
          borderColor: palette.bright,
          boxShadow: `0 0 8px ${palette.glow}`,
        }}
        className="animate-hud-orb-ripple pointer-events-none absolute inset-0 rounded-full border"
      />

      {/* Breathing outer halo */}
      <span
        style={{
          background: `radial-gradient(circle, ${palette.glow} 0%, transparent 68%)`,
        }}
        className="animate-hud-orb-halo pointer-events-none absolute -inset-1 rounded-full blur-[3px] transition-opacity duration-300 group-hover:opacity-100"
      />

      {/* Dark smoked translucent inner circle */}
      <span
        style={{
          borderColor: palette.accent,
          boxShadow: `inset 0 0 8px rgba(255,255,255,0.1), 0 0 10px -2px ${palette.glow}`,
        }}
        className="relative flex h-7 w-7 items-center justify-center rounded-full border bg-[#07111d]/88 transition-transform duration-300 group-hover:scale-105"
      >
        <ArrowUpRight
          style={{ filter: `drop-shadow(0 0 4px ${palette.bright})` }}
          className="h-3.5 w-3.5 text-white transition-transform duration-300 group-hover:translate-x-[1.5px] group-hover:-translate-y-[1.5px]"
        />
      </span>

      {/* Clockwise bright neon orbital comet */}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className="animate-hud-orb-cw pointer-events-none absolute inset-0 h-full w-full origin-center"
      >
        <circle
          cx="16"
          cy="16"
          r="14.5"
          stroke={palette.accent}
          strokeWidth="3"
          strokeDasharray="16 24 6 38"
          strokeLinecap="round"
          opacity="0.55"
          style={{ filter: "blur(1.5px)" }}
        />
        <circle
          cx="16"
          cy="16"
          r="14.5"
          stroke={palette.bright}
          strokeWidth="1.8"
          strokeDasharray="16 24 6 38"
          strokeLinecap="round"
        />
      </svg>

      {/* Counter-clockwise secondary telemetry arc */}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className="animate-hud-orb-ccw pointer-events-none absolute inset-0 h-full w-full origin-center opacity-80"
      >
        <circle
          cx="16"
          cy="16"
          r="12.5"
          stroke={palette.secondary}
          strokeWidth="1.1"
          strokeDasharray="6 10 3 12"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/**
 * Sculpted swept-corner media viewport matching ambitious_screen_designs/card1_crop.png
 * with a live traveling neon comet gliding smoothly along the inner curved frame contour.
 */
export function HudMediaFrame({
  src,
  alt,
  categoryLabel,
  theme = "cyan",
  aspectClass = "aspect-[16/9]",
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px",
  priority = false,
  topRightSlot,
  bottomLeftSlot,
}: {
  src: string;
  alt: string;
  categoryLabel?: string;
  theme?: HudThemeKey;
  aspectClass?: string;
  sizes?: string;
  priority?: boolean;
  topRightSlot?: React.ReactNode;
  bottomLeftSlot?: React.ReactNode;
}) {
  const rawId = useId();
  const safeId = rawId.replace(/:/g, "");
  const clipId = `hud-clip-${safeId}`;
  const gradId = `hud-stroke-${safeId}`;
  const palette = HUD_ACCENT_HEX[theme];
  const innerCurvePath =
    "M 1,100.8 C 10.6,41.4 61.8,5.4 137.6,1 L 305.6,1 Q 319,1 319,14.4 L 319,79.2 C 309.4,138.6 258.2,174.6 182.4,179 L 14.4,179 Q 1,179 1,165.6 Z";

  return (
    <div className={`relative w-full shrink-0 ${aspectClass}`}>
      {/* Outer hairline neon offset outline */}
      <svg
        aria-hidden="true"
        viewBox="0 0 320 180"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 z-20 h-full w-full opacity-45"
      >
        <path
          d="M 1,100 C 11,40 62,6 138,1 L 306,1 Q 319,1 319,15 L 319,80 C 309,140 258,174 182,179 L 14,179 Q 1,179 1,165 Z"
          fill="none"
          stroke={palette.accent}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Clipped media container + exact matching inner neon frame & traveling comet */}
      <div className="relative h-full w-full p-[5px]">
        <svg aria-hidden="true" className="absolute h-0 w-0">
          <defs>
            <clipPath id={clipId} clipPathUnits="objectBoundingBox">
              <path d="M 0,0.56 C 0.03,0.23 0.19,0.03 0.43,0 L 0.955,0 Q 1,0 1,0.08 L 1,0.44 C 0.97,0.77 0.81,0.97 0.57,1 L 0.045,1 Q 0,1 0,0.92 Z" />
            </clipPath>
          </defs>
        </svg>

        <div
          className="relative h-full w-full overflow-hidden bg-[#071019]"
          style={{ clipPath: `url(#${clipId})` }}
        >
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            sizes={sizes}
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
          />
          <div
            aria-hidden="true"
            className="hud-scanlines pointer-events-none absolute inset-0 opacity-50"
          />
          <div
            aria-hidden="true"
            style={{ background: "var(--hud-flare)" }}
            className="pointer-events-none absolute inset-0"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050a12]/72 via-transparent to-black/25"
          />
        </div>

        {/* Glowing inner neon stroke + traveling comet around frame perimeter */}
        <svg
          aria-hidden="true"
          viewBox="0 0 320 180"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-[5px] z-20 h-[calc(100%-10px)] w-[calc(100%-10px)]"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={palette.bright} stopOpacity="0.95" />
              <stop offset="50%" stopColor={palette.accent} stopOpacity="0.6" />
              <stop
                offset="100%"
                stopColor={palette.bright}
                stopOpacity="0.95"
              />
            </linearGradient>
          </defs>
          <path
            d={innerCurvePath}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="1.45"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={innerCurvePath}
            pathLength={100}
            fill="none"
            stroke={palette.accent}
            strokeWidth="4.5"
            strokeDasharray="16 84"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity="0.72"
            style={{ filter: "blur(2.5px)" }}
            className="animate-hud-path-flow"
          />
          <path
            d={innerCurvePath}
            pathLength={100}
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.6"
            strokeDasharray="10 90"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="animate-hud-path-flow"
          />
        </svg>

        {/* Floating Silver-Frosted Category Pill in top-left cutout pocket */}
        {categoryLabel && (
          <div className="pointer-events-none absolute top-3 left-3 z-30">
            <span className="inline-flex max-w-[180px] items-center truncate rounded-full border border-white/80 bg-slate-100/92 px-3 py-1 text-[11px] font-semibold tracking-tight text-slate-950 shadow-[0_6px_18px_rgba(0,0,0,0.45)] backdrop-blur-md">
              {categoryLabel}
            </span>
          </div>
        )}

        {topRightSlot && (
          <div className="pointer-events-none absolute top-3 right-3 z-30 flex items-center gap-1.5">
            {topRightSlot}
          </div>
        )}

        {bottomLeftSlot && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-30">
            {bottomLeftSlot}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Chamfered Price HUD Capsule with alternating dual-layer neon tube ignition
 * on opposite diagonal chamfer corners (top-left <-> bottom-right).
 */
export function HudPriceDock({
  label,
  price,
  sublabel,
  theme = "cyan",
  size = "md",
  animated = true,
  className = "",
}: {
  label: string;
  price: string;
  sublabel?: string;
  theme?: HudThemeKey;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
}) {
  const palette = HUD_ACCENT_HEX[theme];
  const sizing =
    size === "lg"
      ? "min-w-[164px] px-5 py-3"
      : size === "sm"
        ? "min-w-[114px] px-3 py-1.5"
        : "min-w-[126px] px-3.5 py-2";
  const labelSize = size === "lg" ? "text-[10px]" : "text-[8.5px]";
  const priceSize =
    size === "lg"
      ? "text-2xl sm:text-[1.65rem]"
      : size === "sm"
        ? "text-sm"
        : "text-[15px]";

  const topLeftBevelPath = "M 3.5,24 V 14.5 L 14.5,3.5 H 30";
  const bottomRightBevelPath = "M 118,54.5 H 133.5 L 144.5,43.5 V 34";

  return (
    <div
      data-hud-theme={theme}
      className={`relative inline-flex flex-col items-end justify-center shrink-0 overflow-hidden rounded-lg ${sizing} ${className}`}
    >
      {/* Subtle alternating corner ambient neon splashes behind dark smoked text plane */}
      {animated && (
        <>
          <span
            aria-hidden="true"
            style={{
              background: `radial-gradient(circle at 0% 0%, ${palette.glow} 0%, transparent 65%)`,
            }}
            className="hud-bevel-tl pointer-events-none absolute -top-2 -left-2 z-0 h-8 w-12"
          />
          <span
            aria-hidden="true"
            style={{
              background: `radial-gradient(circle at 100% 100%, ${palette.glow} 0%, transparent 65%)`,
            }}
            className="hud-bevel-br pointer-events-none absolute -right-2 -bottom-2 z-0 h-8 w-12"
          />
        </>
      )}

      <svg
        aria-hidden="true"
        viewBox="0 0 148 58"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <path
          d="M 14,2 H 138 Q 146,2 146,10 V 44 L 134,56 H 10 Q 2,56 2,48 V 14 L 14,2 Z"
          fill="var(--hud-price-bg)"
          stroke="var(--hud-price-stroke)"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
        {/* Subtle inner top glass highlight */}
        <path
          d="M 32,3.5 H 136"
          fill="none"
          stroke="rgba(255, 255, 255, 0.22)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {/* Resting corner guides so un-ignited diagonal stays crisp */}
        <path
          d={topLeftBevelPath}
          fill="none"
          stroke={palette.accent}
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.28"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={bottomRightBevelPath}
          fill="none"
          stroke={palette.accent}
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.28"
          vectorEffect="non-scaling-stroke"
        />

        {/* Alternating top-left diagonal neon tube ignition (bloom + white-hot core) */}
        <path
          d={topLeftBevelPath}
          fill="none"
          stroke={palette.accent}
          strokeWidth="6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: "blur(2.8px)" }}
          className={animated ? "hud-bevel-tl" : undefined}
        />
        <path
          d={topLeftBevelPath}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 4px ${palette.bright})` }}
          className={animated ? "hud-bevel-tl" : undefined}
        />

        {/* Alternating bottom-right diagonal neon tube ignition (180-deg out of phase) */}
        <path
          d={bottomRightBevelPath}
          fill="none"
          stroke={palette.accent}
          strokeWidth="6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: "blur(2.8px)" }}
          className={animated ? "hud-bevel-br" : undefined}
        />
        <path
          d={bottomRightBevelPath}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 4px ${palette.bright})` }}
          className={animated ? "hud-bevel-br" : undefined}
        />
      </svg>

      <span
        className={`relative z-10 font-mono font-semibold tracking-[0.14em] text-slate-200/90 uppercase leading-none ${labelSize}`}
      >
        {label}
      </span>
      <span
        style={{
          color: "var(--hud-price-text)",
          textShadow: "0 0 14px var(--hud-price-glow)",
        }}
        className={`relative z-10 mt-1 font-mono font-extrabold tracking-tight leading-none whitespace-nowrap ${priceSize}`}
      >
        {price}
      </span>
      {sublabel && (
        <span className="relative z-10 mt-1 font-mono text-[10px] text-slate-200/90 whitespace-nowrap leading-none">
          {sublabel}
        </span>
      )}
    </div>
  );
}

/**
 * Orbital counter-rotating broken neon ring avatar with luminous halo bloom.
 */
export function RadarAvatar({
  name,
  avatarUrl,
  available,
  theme = "cyan",
  size = "md",
  animated = true,
}: {
  name: string;
  avatarUrl?: string | null;
  available?: boolean;
  theme?: HudThemeKey;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}) {
  const palette = HUD_ACCENT_HEX[theme];
  const dims =
    size === "lg"
      ? "h-16 w-16"
      : size === "sm"
        ? "h-10 w-10"
        : "h-11 w-11";
  const innerDims =
    size === "lg"
      ? "h-11 w-11 text-sm"
      : size === "sm"
        ? "h-6.5 w-6.5 text-[9.5px]"
        : "h-7.5 w-7.5 text-[11px]";
  const imgSize = size === "lg" ? 44 : size === "sm" ? 26 : 30;
  const trimmedAvatarUrl = avatarUrl?.trim() || "";
  const hasAvatarImage = isAllowedNextImageSrc(trimmedAvatarUrl);

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${dims}`}
    >
      {/* Breathing outer orbital neon halo */}
      {animated && (
        <span
          aria-hidden="true"
          style={{
            background: `radial-gradient(circle, ${palette.glow} 0%, transparent 70%)`,
          }}
          className="animate-hud-avatar-glow pointer-events-none -inset-1 absolute rounded-full blur-[4px]"
        />
      )}

      {/* Inner broken neon ring (colored bloom + white-hot core) rotating clockwise */}
      <svg
        aria-hidden="true"
        viewBox="0 0 40 40"
        fill="none"
        className={`pointer-events-none absolute inset-0 h-full w-full origin-center ${
          animated ? "animate-hud-radar-cw" : ""
        }`}
      >
        <circle
          cx="20"
          cy="20"
          r="15.3"
          stroke={palette.accent}
          strokeWidth="3.8"
          strokeDasharray="24 6 12 6 7 6"
          strokeLinecap="round"
          opacity="0.85"
          style={{ filter: "blur(1.8px)" }}
        />
        <circle
          cx="20"
          cy="20"
          r="15.3"
          stroke="#ffffff"
          strokeWidth="1.45"
          strokeDasharray="24 6 12 6 7 6"
          strokeLinecap="round"
        />
      </svg>

      {/* Outer fine telemetry halo + glowing nodes rotating counter-clockwise */}
      <svg
        aria-hidden="true"
        viewBox="0 0 40 40"
        fill="none"
        className={`pointer-events-none absolute inset-0 h-full w-full origin-center ${
          animated ? "animate-hud-radar-ccw" : ""
        }`}
      >
        <circle
          cx="20"
          cy="20"
          r="18.3"
          stroke={palette.bright}
          strokeWidth="1.1"
          strokeDasharray="3 3.5"
          opacity="0.82"
        />
        <circle cx="31" cy="8.5" r="1.4" fill="#ffffff" />
        <circle cx="8" cy="30.5" r="1.4" fill={palette.bright} />
        <circle cx="35.5" cy="24" r="1.2" fill={palette.secondary} />
      </svg>

      {/* Stationary high-contrast inner badge */}
      <div
        style={{ backgroundColor: palette.avatarBg }}
        className={`relative z-10 flex items-center justify-center overflow-hidden rounded-full ring-1 ring-white/35 ${innerDims}`}
      >
        {hasAvatarImage ? (
          <Image
            src={trimmedAvatarUrl}
            alt={name}
            width={imgSize}
            height={imgSize}
            unoptimized={Boolean(trimmedAvatarUrl.startsWith("/api/"))}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            aria-label={name}
            className="font-tech font-bold leading-none tracking-wider text-white select-none"
          >
            {getInitials(name)}
          </span>
        )}
      </div>

      {available !== undefined && (
        <span
          title={available ? "Available" : "Busy right now"}
          className={`absolute right-0.5 bottom-0.5 z-20 h-2.5 w-2.5 rounded-full border border-[#06090e] ${
            available
              ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
              : "bg-slate-500"
          }`}
        />
      )}
    </div>
  );
}

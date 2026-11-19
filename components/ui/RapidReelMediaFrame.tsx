"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { HUD_ACCENT_HEX, type HudThemeKey } from "@/lib/design-tokens";

const REEL_FRAMES = [
  {
    src: "/images/photos/journey-2-work.jpg",
    alt: "Writers collaborating on editorial drafts in studio",
  },
  {
    src: "/images/photos/hero-botanical-studio.jpg",
    alt: "Creator researching at sunlit wooden studio desk",
  },
  {
    src: "/images/photos/cat-research.jpg",
    alt: "Academic journal citations and structured outlines",
  },
  {
    src: "/images/photos/journey-1-book.jpg",
    alt: "Client selecting clear milestone package on laptop",
  },
  {
    src: "/images/photos/cat-academic.jpg",
    alt: "Graduate dissertation notes and laptop workspace",
  },
  {
    src: "/images/photos/journey-3-submit.jpg",
    alt: "Finished manuscript ready for review and approval",
  },
  {
    src: "/images/photos/cat-editing.jpg",
    alt: "Editor reviewing structure, grammar, and clarity",
  },
  {
    src: "/images/photos/cat-business.jpg",
    alt: "Executive proposal and strategy report preparation",
  },
  {
    src: "/images/photos/hero-nature-desk.jpg",
    alt: "Focused remote writer desk surrounded by greenery",
  },
  {
    src: "/images/photos/journey-5-mpesa.jpg",
    alt: "Instant M-Pesa payout confirmation on release",
  },
] as const;

const FRAME_INTERVAL_MS = 80; // 12.5 fps rapid-cut pulse
const INTRO_BURST_TICKS = 18; // 1.44s intro burst when entering viewport

/**
 * Curved futuristic showcase frame matching HudMediaFrame geometry with a
 * rapid-cut 12.5 fps (80ms) intro burst on scroll-into-view and hover/tap reel.
 */
export function RapidReelMediaFrame({
  categoryLabel = "Writer Hub",
  theme = "cyan",
  aspectClass = "aspect-[16/10] w-full",
  sizes = "(max-width: 1024px) 100vw, 620px",
}: {
  categoryLabel?: string;
  theme?: HudThemeKey;
  aspectClass?: string;
  sizes?: string;
}) {
  const rawId = useId();
  const safeId = rawId.replace(/:/g, "");
  const clipId = `hud-reel-clip-${safeId}`;
  const gradId = `hud-reel-stroke-${safeId}`;
  const palette = HUD_ACCENT_HEX[theme];
  const innerCurvePath =
    "M 1,100.8 C 10.6,41.4 61.8,5.4 137.6,1 L 305.6,1 Q 319,1 319,14.4 L 319,79.2 C 309.4,138.6 258.2,174.6 182.4,179 L 14.4,179 Q 1,179 1,165.6 Z";

  const containerRef = useRef<HTMLDivElement>(null);
  const hasPlayedIntroRef = useRef(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [introTicksLeft, setIntroTicksLeft] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isToggledReel, setIsToggledReel] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mq.matches);
    updatePreference();
    mq.addEventListener("change", updatePreference);
    return () => mq.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || reducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !hasPlayedIntroRef.current) {
          hasPlayedIntroRef.current = true;
          setIntroTicksLeft(INTRO_BURST_TICKS);
          observer.disconnect();
        }
      },
      { threshold: 0.45 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const isRunning = !reducedMotion && (introTicksLeft > 0 || isHovered || isToggledReel);

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % REEL_FRAMES.length);
      setIntroTicksLeft((prev) => (prev > 1 ? prev - 1 : 0));
    }, FRAME_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  function handleToggleReel() {
    if (reducedMotion) {
      setActiveIdx((prev) => (prev + 1) % REEL_FRAMES.length);
      return;
    }
    setIntroTicksLeft(0);
    setIsToggledReel((prev) => !prev);
  }

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => {
        if (!reducedMotion) setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative w-full shrink-0 ${aspectClass}`}
    >
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

      {/* Clipped rapid-cut photo stack + neon comet frame */}
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
          {REEL_FRAMES.map((frame, idx) => (
            <Image
              key={frame.src}
              src={frame.src}
              alt={frame.alt}
              fill
              loading="eager"
              sizes={sizes}
              className={`object-cover ${
                idx === activeIdx ? "opacity-100 z-[1]" : "opacity-0 z-0"
              }`}
            />
          ))}

          <div
            aria-hidden="true"
            className="hud-scanlines pointer-events-none absolute inset-0 z-[2] opacity-55"
          />
          <div
            aria-hidden="true"
            style={{ background: "var(--hud-flare)" }}
            className="pointer-events-none absolute inset-0 z-[2]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-[#050a12]/72 via-transparent to-black/25"
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
        <div className="pointer-events-none absolute top-3 left-3 z-30">
          <span className="inline-flex max-w-[180px] items-center truncate rounded-full border border-white/80 bg-slate-100/92 px-3 py-1 text-[11px] font-semibold tracking-tight text-slate-950 shadow-[0_6px_18px_rgba(0,0,0,0.45)] backdrop-blur-md">
            {categoryLabel}
          </span>
        </div>

        {/* Interactive Rapid-Cut Pulse Toggle Pill */}
        <button
          type="button"
          onClick={handleToggleReel}
          aria-pressed={isToggledReel}
          aria-label={
            reducedMotion
              ? "Step to next studio photo"
              : isRunning
                ? "Pause rapid studio reel"
                : "Play rapid 12.5 fps studio reel"
          }
          className="absolute bottom-3 right-3 z-30 inline-flex items-center gap-1.5 rounded-full border border-cyan-300/45 bg-[#050b14]/82 px-3 py-1 font-mono text-[10px] font-bold tracking-[0.08em] text-cyan-200 uppercase shadow-[0_6px_18px_rgba(0,0,0,0.55)] backdrop-blur-md transition-colors hover:border-cyan-200/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              isRunning ? "bg-emerald-400 animate-pulse" : "bg-cyan-400"
            }`}
          />
          {reducedMotion
            ? `SHOT ${String(activeIdx + 1).padStart(2, "0")}/10`
            : isRunning
              ? `LIVE ${String(activeIdx + 1).padStart(2, "0")}/10`
              : "REEL · 12 FPS"}
        </button>
      </div>
    </div>
  );
}

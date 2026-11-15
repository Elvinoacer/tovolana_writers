"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileCheck2,
  Lock,
  Pause,
  Play,
  ShieldCheck,
  Star,
  Wifi,
} from "lucide-react";

interface JourneyStage {
  id: string;
  stepNum: string;
  shortLabel: string;
  title: string;
  summary: string;
  photo: string;
  photoAlt: string;
  screenType: "booked" | "working" | "submitted" | "accepted" | "mpesa";
}

const JOURNEY_STAGES: JourneyStage[] = [
  {
    id: "book",
    stepNum: "1",
    shortLabel: "Booked",
    title: "Escrow locks before work begins",
    summary:
      "Clear KES total, included revisions, and delivery deadline locked upfront.",
    photo: "/images/photos/journey-1-book.jpg",
    photoAlt: "Client reviewing booking details on laptop",
    screenType: "booked",
  },
  {
    id: "work",
    stepNum: "2",
    shortLabel: "Drafting",
    title: "Vetted writer drafts in studio",
    summary:
      "Track live word milestones and source checks inside your private thread.",
    photo: "/images/photos/journey-2-work.jpg",
    photoAlt: "Vetted writers drafting manuscripts in studio",
    screenType: "working",
  },
  {
    id: "submit",
    stepNum: "3",
    shortLabel: "Delivered",
    title: "Final files land in the private vault",
    summary:
      "Formatted deliverables and originality checks arrive ready for review.",
    photo: "/images/photos/journey-3-submit.jpg",
    photoAlt: "Completed manuscript documents under review",
    screenType: "submitted",
  },
  {
    id: "accept",
    stepNum: "4",
    shortLabel: "Approved",
    title: "Client verifies and releases escrow",
    summary:
      "One-tap sign-off confirms satisfaction and triggers writer settlement.",
    photo: "/images/photos/journey-4-accept.jpg",
    photoAlt: "Satisfied client approving delivered work",
    screenType: "accepted",
  },
  {
    id: "mpesa",
    stepNum: "5",
    shortLabel: "Settled",
    title: "Instant M-Pesa payout to writer",
    summary:
      "Approved earnings settle straight to Safaricom M-Pesa with full receipt.",
    photo: "/images/photos/journey-5-mpesa.jpg",
    photoAlt: "Mobile phone showing instant payment confirmation",
    screenType: "mpesa",
  },
];

function IosStatusBar({ dark = false }: { dark?: boolean }) {
  const ink = dark ? "text-white" : "text-[#111827]";
  const barFill = dark ? "bg-white" : "bg-[#111827]";
  const batteryBorder = dark ? "border-white/55" : "border-[#111827]/45";

  return (
    <div
      className={`px-5 pt-2.5 pb-1.5 flex items-center justify-between shrink-0 select-none ${ink}`}
    >
      <span className="text-[11px] font-semibold tracking-tight w-10">
        9:41
      </span>

      {/* Dynamic Island */}
      <div className="w-[68px] h-[18px] rounded-full bg-black flex items-center justify-end pr-2 shadow-inner">
        <span className="w-2 h-2 rounded-full bg-[#111a2e] ring-1 ring-white/10" />
      </div>

      {/* Signal, Wi-Fi & Battery */}
      <div className="flex items-center justify-end gap-1.5 w-12">
        <span className="inline-flex items-end gap-[1.5px] h-2.5">
          <span className={`w-[2px] h-1 rounded-full ${barFill}`} />
          <span className={`w-[2px] h-1.5 rounded-full ${barFill}`} />
          <span className={`w-[2px] h-2 rounded-full ${barFill}`} />
          <span className={`w-[2px] h-2.5 rounded-full ${barFill}`} />
        </span>
        <Wifi className="w-3 h-3" strokeWidth={2.3} />
        <span className="inline-flex items-center">
          <span
            className={`w-[17px] h-[9px] rounded-[2.5px] border p-[1.5px] flex items-center ${batteryBorder}`}
          >
            <span className={`w-full h-full rounded-[1px] ${barFill}`} />
          </span>
          <span className={`w-[1.5px] h-[4px] rounded-r-xs ml-[1px] ${barFill}`} />
        </span>
      </div>
    </div>
  );
}

function IphoneScreenContent({ stage }: { stage: JourneyStage }) {
  switch (stage.screenType) {
    case "booked":
      return (
        <div className="flex-1 px-3.5 py-2.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[#111827]">Booking</span>
              <span className="font-tech text-stone-500">#TW-8492</span>
            </div>

            <div className="relative h-24 rounded-2xl overflow-hidden bg-stone-200">
              <Image
                src={stage.photo}
                alt={stage.photoAlt}
                fill
                sizes="260px"
                className="object-cover"
              />
            </div>

            <div>
              <p className="font-editorial text-[14px] font-semibold text-[#111827] leading-snug">
                APA 7th Literature Review
              </p>
              <p className="text-[11px] text-stone-500 mt-1">
                4,000 words · 4-day lock
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-[#e6e0d4] p-3 space-y-2 text-[11px]">
              <div className="flex justify-between text-stone-600">
                <span>Service</span>
                <span className="font-tech text-[#111827]">KES 7,500</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Pro Fee (5%)</span>
                <span className="font-tech text-[#0f766e]">KES 375</span>
              </div>
              <div className="pt-2 border-t border-[#efeae0] flex justify-between font-semibold text-[#111827]">
                <span>Escrow Held</span>
                <span className="font-tech text-[#1e3a8a]">KES 7,875</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#111827] text-white py-2.5 px-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Escrow Protected</span>
          </div>
        </div>
      );

    case "working":
      return (
        <div className="flex-1 px-3.5 py-2.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[#111827]">Studio Draft</span>
              <span className="font-tech text-[#0f766e] font-medium">
                Day 3 of 4
              </span>
            </div>

            <div className="relative h-24 rounded-2xl overflow-hidden bg-stone-200">
              <Image
                src={stage.photo}
                alt={stage.photoAlt}
                fill
                sizes="260px"
                className="object-cover"
              />
            </div>

            <div className="rounded-2xl bg-white border border-[#e6e0d4] p-3 flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 ring-1 ring-[#e6e0d4]">
                <Image
                  src="/images/photos/avatar-1.jpg"
                  alt="Dr. Amina W."
                  fill
                  sizes="32px"
                  className="object-cover object-top"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[#111827] truncate">
                  Dr. Amina W.
                </p>
                <p className="text-[10px] font-tech text-[#0f766e]">
                  Vetted · 94/100
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-[#e6e0d4] p-3 space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-stone-600">Progress</span>
                <span className="font-tech font-bold text-[#111827]">86%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-stone-200 overflow-hidden">
                <div className="h-full w-[86%] rounded-full bg-[#0f766e]" />
              </div>
              <p className="text-[10px] font-tech text-stone-500">
                3,450 / 4,000 words
              </p>
            </div>
          </div>

          <p className="text-[11px] text-stone-600 leading-relaxed px-1">
            &ldquo;Methodology matrix verified across 18 sources.&rdquo;
          </p>
        </div>
      );

    case "submitted":
      return (
        <div className="flex-1 px-3.5 py-2.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[#111827]">Private Vault</span>
              <span className="font-tech text-[#0f766e] font-semibold">
                9h early
              </span>
            </div>

            <div className="relative h-24 rounded-2xl overflow-hidden bg-stone-200">
              <Image
                src={stage.photo}
                alt={stage.photoAlt}
                fill
                sizes="260px"
                className="object-cover"
              />
            </div>

            <div className="space-y-2">
              <div className="rounded-2xl bg-white border border-[#e6e0d4] p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCheck2 className="w-4 h-4 text-[#1e3a8a] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#111827] truncate">
                      LitReview_Final.docx
                    </p>
                    <p className="text-[10px] font-tech text-stone-500">
                      1.8 MB · Formatted
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-[#e6e0d4] p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-[#0f766e] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#111827] truncate">
                      Originality_Check.pdf
                    </p>
                    <p className="text-[10px] font-tech text-[#0f766e]">
                      99% original
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#1e3a8a] text-white py-2.5 px-3 text-center text-[11px] font-semibold">
            Review Deliverables
          </div>
        </div>
      );

    case "accepted":
      return (
        <div className="flex-1 px-3.5 py-2.5 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[#111827]">Sign-Off</span>
              <span className="font-tech text-stone-500">5.0 / 5.0</span>
            </div>

            <div className="flex flex-col items-center pt-2 space-y-2.5">
              <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-[#e6e0d4] bg-stone-200">
                <Image
                  src={stage.photo}
                  alt={stage.photoAlt}
                  fill
                  sizes="64px"
                  className="object-cover object-[50%_18%]"
                />
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="w-3.5 h-3.5 text-amber-500 fill-amber-500"
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-[#e6e0d4] p-3.5 text-center space-y-2">
              <p className="font-editorial text-[12px] text-[#111827] leading-relaxed">
                &ldquo;Crisp synthesis and spotless APA 7th citations. Delivered
                ahead of schedule.&rdquo;
              </p>
              <p className="text-[10px] font-tech text-stone-500">
                Verified Client · Nairobi
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#0f766e] text-white py-2.5 px-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Escrow Released</span>
          </div>
        </div>
      );

    case "mpesa":
      return (
        <div className="flex-1 px-3.5 py-2.5 flex flex-col justify-between text-white">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-emerald-300">M-Pesa</span>
              <span className="font-tech text-stone-400">3:18 PM</span>
            </div>

            <div className="relative h-24 rounded-2xl overflow-hidden bg-stone-800">
              <Image
                src={stage.photo}
                alt={stage.photoAlt}
                fill
                sizes="260px"
                className="object-cover"
              />
            </div>

            <div className="rounded-2xl bg-[#0e2d25] border border-emerald-400/25 p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-[#061b17] flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3" strokeWidth={3} />
                </span>
                <span className="text-[11px] font-medium text-emerald-200">
                  Payout Received
                </span>
              </div>

              <p className="font-tech text-xl font-bold text-white leading-none">
                KES 7,500
              </p>

              <div className="pt-2 border-t border-white/10 space-y-1.5 text-[10px] font-tech text-stone-300">
                <div className="flex justify-between">
                  <span className="text-stone-400">Ref</span>
                  <span>SLK9482TQ7</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Source</span>
                  <span>IntaSend Escrow</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Balance</span>
                  <span className="text-emerald-300">KES 42,850</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white/10 border border-white/15 py-2.5 px-3 text-center text-[11px] font-medium text-emerald-200">
            Settled in 4 seconds
          </div>
        </div>
      );
  }
}

/** Interactive 5-stage iPhone 16 Pro showcase with mobile horizontal snap carousel. */
export function IphoneJourneyShowcase() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [inView, setInView] = useState(false);
  const activeIdxRef = useRef(0);
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProgrammaticScrollRef = useRef(false);

  useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const scrollTrackToIndex = useCallback((idx: number) => {
    const track = trackRef.current;
    if (!track || track.scrollWidth <= track.clientWidth + 4) return;
    const child = track.children[idx] as HTMLElement | undefined;
    if (!child) return;
    isProgrammaticScrollRef.current = true;
    if (programmaticTimerRef.current) {
      clearTimeout(programmaticTimerRef.current);
    }
    programmaticTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 550);
    // Scroll horizontally inside the carousel without moving vertical page scroll.
    const targetLeft =
      child.offsetLeft - (track.clientWidth - child.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!autoPlay || !inView) return;
    const timer = setInterval(() => {
      const next = (activeIdxRef.current + 1) % JOURNEY_STAGES.length;
      setActiveIdx(next);
      scrollTrackToIndex(next);
    }, 4500);
    return () => clearInterval(timer);
  }, [autoPlay, inView, scrollTrackToIndex]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      if (programmaticTimerRef.current) {
        clearTimeout(programmaticTimerRef.current);
      }
    };
  }, []);

  function selectStage(idx: number) {
    setActiveIdx(idx);
    setAutoPlay(false);
    scrollTrackToIndex(idx);
  }

  function handleTrackScroll() {
    const track = trackRef.current;
    if (!track || track.scrollWidth <= track.clientWidth + 4) return;
    if (isProgrammaticScrollRef.current) return;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      const center = track.scrollLeft + track.clientWidth / 2;
      let closestIdx = 0;
      let minDist = Infinity;
      Array.from(track.children).forEach((el, i) => {
        const htmlEl = el as HTMLElement;
        const itemCenter = htmlEl.offsetLeft + htmlEl.offsetWidth / 2;
        const dist = Math.abs(itemCenter - center);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      });
      setActiveIdx(closestIdx);
      setAutoPlay(false);
    }, 90);
  }

  const currentStage = JOURNEY_STAGES[activeIdx];

  return (
    <section
      ref={sectionRef}
      className="w-full bg-[#0b111a] text-white py-16 sm:py-22 overflow-hidden"
    >
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header Row */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2.5 max-w-xl">
            <h2 className="font-editorial text-3xl sm:text-4xl lg:text-[2.65rem] font-semibold tracking-tight leading-[1.08] text-[#faf7f2]">
              From brief to M-Pesa payout, every step stays transparent.
            </h2>
            <p className="text-sm sm:text-base text-stone-400">
              Watch how an order moves from escrow checkout to writer settlement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {JOURNEY_STAGES.map((stage, idx) => {
              const active = idx === activeIdx;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => selectStage(idx)}
                  className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all border ${
                    active
                      ? "bg-[#faf7f2] text-[#0b111a] border-[#faf7f2] font-semibold"
                      : "bg-white/5 text-stone-300 border-white/12 hover:bg-white/12 hover:text-white"
                  }`}
                >
                  {stage.stepNum}. {stage.shortLabel}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setAutoPlay((v) => !v)}
              aria-label={autoPlay ? "Pause journey autoplay" : "Play journey"}
              className="w-9 h-9 rounded-full bg-white/8 border border-white/15 flex items-center justify-center text-stone-200 hover:bg-white/16 transition-colors"
            >
              {autoPlay ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* 5 Real-Proportion iPhone 16 Pro Frames: Mobile Horizontal Snap Carousel -> Desktop 5-Column Grid */}
        <div
          ref={trackRef}
          onScroll={handleTrackScroll}
          className="flex lg:grid lg:grid-cols-5 gap-5 lg:gap-4 xl:gap-5 overflow-x-auto lg:overflow-visible snap-x snap-mandatory px-[calc(50%-131px)] lg:px-0 pt-2 pb-4 lg:pb-0 no-scrollbar"
        >
          {JOURNEY_STAGES.map((stage, idx) => {
            const isActive = idx === activeIdx;
            const isDarkScreen = stage.screenType === "mpesa";
            return (
              <div
                key={stage.id}
                role="button"
                tabIndex={0}
                onClick={() => selectStage(idx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectStage(idx);
                  }
                }}
                className={`relative shrink-0 snap-center w-[262px] lg:w-full h-[544px] lg:h-[496px] xl:h-[530px] cursor-pointer transition-all duration-500 focus:outline-none ${
                  isActive
                    ? "lg:-translate-y-2 opacity-100"
                    : "opacity-75 hover:opacity-100"
                }`}
              >
                {/* Metallic Physical Side Hardware Buttons */}
                <span
                  aria-hidden="true"
                  className="absolute -left-[2.5px] top-[92px] w-[3px] h-5 rounded-l-sm bg-zinc-500/80"
                />
                <span
                  aria-hidden="true"
                  className="absolute -left-[2.5px] top-[128px] w-[3px] h-10 rounded-l-sm bg-zinc-500/80"
                />
                <span
                  aria-hidden="true"
                  className="absolute -left-[2.5px] top-[178px] w-[3px] h-10 rounded-l-sm bg-zinc-500/80"
                />
                <span
                  aria-hidden="true"
                  className="absolute -right-[2.5px] top-[140px] w-[3px] h-14 rounded-r-sm bg-zinc-500/80"
                />

                {/* Titanium Chassis */}
                <div
                  className={`h-full rounded-[2.85rem] p-[3px] bg-gradient-to-b from-zinc-400/75 via-zinc-700 to-zinc-800 transition-shadow duration-500 ${
                    isActive
                      ? "ring-2 ring-emerald-400/90 shadow-[0_24px_60px_-14px_rgba(16,185,129,0.35)]"
                      : "shadow-2xl"
                  }`}
                >
                  {/* Deep Black Glass Bezel */}
                  <div className="h-full rounded-[2.68rem] p-[7px] bg-[#060709] flex flex-col">
                    {/* True iOS Viewport */}
                    <div
                      className={`flex-1 rounded-[2.25rem] overflow-hidden flex flex-col ${
                        isDarkScreen
                          ? "bg-[#061b17] text-white"
                          : "bg-[#faf7f2] text-[#111827]"
                      }`}
                    >
                      <IosStatusBar dark={isDarkScreen} />
                      <IphoneScreenContent stage={stage} />
                      <div className="pb-2 pt-1 flex justify-center shrink-0">
                        <div
                          className={`w-[88px] h-[4px] rounded-full ${
                            isDarkScreen ? "bg-white/25" : "bg-stone-900/20"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Stage Caption Strip */}
        <div className="border-t border-white/12 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="font-editorial text-xl font-semibold text-[#faf7f2]">
              {currentStage.stepNum}. {currentStage.title}
            </p>
            <p className="text-sm text-stone-400">{currentStage.summary}</p>
          </div>

          <Link
            href={
              currentStage.screenType === "mpesa"
                ? "/creators-hub/join"
                : "/explore"
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#faf7f2] text-[#0b111a] text-sm font-semibold hover:bg-emerald-100 transition-colors shrink-0 self-start sm:self-auto"
          >
            {currentStage.screenType === "mpesa"
              ? "Join Creators Hub"
              : "Explore services"}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

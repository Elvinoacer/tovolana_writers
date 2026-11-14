"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  FileCheck2,
  Lock,
  Pause,
  Play,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Wifi,
} from "lucide-react";

interface JourneyStage {
  id: string;
  stepNum: string;
  shortLabel: string;
  badgeText: string;
  title: string;
  actor: string;
  summary: string;
  photo: string;
  photoAlt: string;
  accentBg: string;
  accentText: string;
  screenType: "booked" | "working" | "submitted" | "accepted" | "mpesa";
}

const JOURNEY_STAGES: JourneyStage[] = [
  {
    id: "book",
    stepNum: "01",
    shortLabel: "Booked",
    badgeText: "Escrow Locked",
    title: "Customer Books Task & Locks Funds",
    actor: "Customer · M-Pesa STK / Card",
    summary:
      "Clear KES total, deliverables, and locked 4-day delivery deadline shown upfront before checkout.",
    photo: "/images/photos/journey-1-book.jpg",
    photoAlt: "Customer booking a writing service on laptop and smartphone",
    accentBg: "bg-blue-500/20 border-blue-400/30",
    accentText: "text-blue-200",
    screenType: "booked",
  },
  {
    id: "work",
    stepNum: "02",
    shortLabel: "Working",
    badgeText: "In Progress · 86%",
    title: "Vetted Creator Drafts & Communicates",
    actor: "Creator · Studio Workspace",
    summary:
      "Assessment-vetted writer drafts the manuscript with live milestone updates inside the booking thread.",
    photo: "/images/photos/journey-2-work.jpg",
    photoAlt: "Vetted writer researching and drafting manuscript on laptop",
    accentBg: "bg-amber-500/20 border-amber-400/30",
    accentText: "text-amber-200",
    screenType: "working",
  },
  {
    id: "submit",
    stepNum: "03",
    shortLabel: "Submitted",
    badgeText: "Delivered 9h Early",
    title: "Completed Work Uploaded to Vault",
    actor: "Creator · Encrypted Vault",
    summary:
      "Final DOCX, PDF, and originality check land in the IDOR-protected File Vault ahead of deadline.",
    photo: "/images/photos/journey-3-submit.jpg",
    photoAlt: "Completed manuscript documents and workspace sign-off",
    accentBg: "bg-indigo-500/20 border-indigo-400/30",
    accentText: "text-indigo-200",
    screenType: "submitted",
  },
  {
    id: "accept",
    stepNum: "04",
    shortLabel: "Accepted",
    badgeText: "Approved · 5.0 ★",
    title: "Customer Reviews & Approves Release",
    actor: "Customer · 1-Tap Sign-Off",
    summary:
      "Customer verifies quality, leaves a 5-star review, and authorizes IntaSend escrow release.",
    photo: "/images/photos/journey-4-accept.jpg",
    photoAlt: "Happy client reviewing and approving delivered work",
    accentBg: "bg-teal-500/20 border-teal-400/30",
    accentText: "text-teal-200",
    screenType: "accepted",
  },
  {
    id: "mpesa",
    stepNum: "05",
    shortLabel: "M-Pesa Paid",
    badgeText: "Instant B2C Payout",
    title: "Creator Receives Real M-Pesa Settlement",
    actor: "Safaricom M-Pesa · IntaSend",
    summary:
      "KES 7,500 settles straight to the Creator's M-Pesa wallet with verified Safaricom confirmation.",
    photo: "/images/photos/journey-5-mpesa.jpg",
    photoAlt: "Mobile phone M-Pesa digital payment confirmation",
    accentBg: "bg-emerald-500/25 border-emerald-400/40",
    accentText: "text-emerald-200",
    screenType: "mpesa",
  },
];

function IphoneScreenContent({ stage }: { stage: JourneyStage }) {
  switch (stage.screenType) {
    case "booked":
      return (
        <div className="p-3 space-y-2 text-[10px]">
          <div className="flex items-center justify-between">
            <span className="font-tech font-bold text-[#1e3a8a] uppercase tracking-wider">
              Order #TW-8492
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-[#1e3a8a] font-tech font-semibold border border-blue-200">
              PAID
            </span>
          </div>
          <p className="font-editorial font-semibold text-xs text-[#111827] leading-snug">
            APA 7th Literature Review (4,000 Words)
          </p>
          <div className="rounded-xl bg-white border border-[#e6e0d4] p-2 space-y-1">
            <div className="flex justify-between text-stone-500">
              <span>Service</span>
              <span className="font-tech text-[#111827]">KES 7,500</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Pro Fee (5%)</span>
              <span className="font-tech text-[#0f766e]">KES 375</span>
            </div>
            <div className="border-t border-[#e6e0d4] pt-1 flex justify-between font-bold text-[#111827]">
              <span>Escrow Total</span>
              <span className="font-tech text-[#1e3a8a]">KES 7,875</span>
            </div>
          </div>
          <div className="rounded-lg bg-[#111827] text-white px-2.5 py-1.5 flex items-center justify-between font-tech">
            <span className="inline-flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-400" />
              IntaSend Escrow
            </span>
            <span className="text-emerald-300">4d Lock</span>
          </div>
        </div>
      );

    case "working":
      return (
        <div className="p-3 space-y-2 text-[10px]">
          <div className="flex items-center gap-2">
            <div className="relative w-7 h-7 rounded-full overflow-hidden ring-2 ring-[#0f766e] shrink-0">
              <Image
                src="/images/photos/avatar-1.jpg"
                alt="Dr. Amina W."
                fill
                sizes="28px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[#111827] truncate leading-none">
                Dr. Amina W.
              </p>
              <p className="text-[9px] font-tech text-[#0f766e] mt-0.5">
                Vetted Score 94/100
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-white border border-[#e6e0d4] p-2 space-y-1.5">
            <div className="flex justify-between font-tech">
              <span className="text-stone-500">Manuscript Progress</span>
              <span className="font-bold text-[#111827]">86%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-stone-200 overflow-hidden">
              <div className="h-full w-[86%] rounded-full bg-gradient-to-r from-[#0f766e] to-emerald-500" />
            </div>
            <p className="text-[9px] font-tech text-stone-500">
              3,450 / 4,000 words · 18 sources verified
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200/80 px-2.5 py-1.5 text-amber-950 leading-snug">
            <span className="font-semibold">Live Note:</span> Methodology table
            &amp; synthesis finalized.
          </div>
        </div>
      );

    case "submitted":
      return (
        <div className="p-3 space-y-2 text-[10px]">
          <div className="flex items-center justify-between">
            <span className="font-tech font-bold text-indigo-900">
              Deliverable Vault
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 font-tech font-semibold">
              <Clock className="w-2.5 h-2.5" />
              -9h Early
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="rounded-xl bg-white border border-[#e6e0d4] p-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileCheck2 className="w-3.5 h-3.5 text-[#1e3a8a] shrink-0" />
                <span className="font-tech font-medium text-[#111827] truncate">
                  LitReview_Final.docx
                </span>
              </div>
              <span className="font-tech text-[9px] text-stone-400 shrink-0">
                1.8 MB
              </span>
            </div>
            <div className="rounded-xl bg-white border border-[#e6e0d4] p-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0f766e] shrink-0" />
                <span className="font-tech font-medium text-[#111827] truncate">
                  Originality_99pct.pdf
                </span>
              </div>
              <span className="font-tech text-[9px] text-[#0f766e] font-bold shrink-0">
                PASS
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-indigo-950 text-white px-2.5 py-1.5 text-center font-semibold">
            Ready for Client Review
          </div>
        </div>
      );

    case "accepted":
      return (
        <div className="p-3 space-y-2 text-[10px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-amber-500">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="font-tech font-bold text-[#0f766e]">5.0 / 5.0</span>
          </div>

          <div className="rounded-xl bg-white border border-[#e6e0d4] p-2 space-y-1">
            <p className="text-[10px] italic text-stone-700 leading-snug">
              &ldquo;Superb APA 7th citations and crisp synthesis. Delivered ahead of
              schedule.&rdquo;
            </p>
            <p className="text-[9px] font-tech text-stone-400">
              Verified Client · Nairobi
            </p>
          </div>

          <div className="rounded-lg bg-[#0f766e] text-white px-2.5 py-2 flex items-center justify-center gap-1.5 font-semibold shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Accepted &amp; Escrow Released
          </div>
        </div>
      );

    case "mpesa":
      return (
        <div className="p-2.5 space-y-2 text-[10px]">
          {/* Authentic Safaricom M-Pesa SMS Receipt */}
          <div className="rounded-xl bg-[#00a651] text-white p-2.5 shadow-sm space-y-1">
            <div className="flex items-center justify-between border-b border-white/20 pb-1">
              <span className="font-tech font-bold tracking-wide text-[10px]">
                MPESA · CONFIRMED
              </span>
              <span className="font-tech text-[9px] bg-black/20 px-1.5 py-0.5 rounded">
                SLK9482TQ7
              </span>
            </div>
            <p className="text-[9.5px] leading-snug font-medium text-white/95">
              Confirmed. You have received{" "}
              <strong className="font-tech underline">KES 7,500.00</strong>{" "}
              from INTASEND ESCROW (TOVOLANA) on 14/11/26 at 3:18 PM.
            </p>
            <div className="flex items-center justify-between pt-0.5 text-[9px] font-tech text-emerald-100">
              <span>Bal: KES 42,850.00</span>
              <span className="inline-flex items-center gap-0.5 font-semibold text-white">
                <Check className="w-2.5 h-2.5" /> Instant
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 flex items-center justify-between font-tech text-emerald-900">
            <span>Creator Payout</span>
            <span className="font-bold">100% Settled</span>
          </div>
        </div>
      );
  }
}

export function IphoneJourneyShowcase() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % JOURNEY_STAGES.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [autoPlay]);

  const currentStage = JOURNEY_STAGES[activeIdx];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-reveal stagger-1">
      <div className="rounded-3xl bg-gradient-to-br from-[#0b1120] via-[#111827] to-[#0b2520] text-white p-6 sm:p-8 lg:p-10 shadow-2xl border border-white/10 relative overflow-hidden space-y-7">
        {/* Soft Atmospheric Backlights */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 -right-24 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-24 w-80 h-80 rounded-full bg-blue-500/15 blur-3xl"
        />

        {/* Header Row */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-tech uppercase tracking-wider text-emerald-300">
              <Smartphone className="w-3.5 h-3.5" />
              Live Mobile Journey · Real Photos &amp; M-Pesa Proof
            </span>
            <h2 className="font-editorial text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight leading-tight">
              Booked, written, accepted — and settled straight to M-Pesa.
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {JOURNEY_STAGES.map((stage, idx) => {
              const active = idx === activeIdx;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => {
                    setActiveIdx(idx);
                    setAutoPlay(false);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-tech font-medium transition-all border ${
                    active
                      ? "bg-emerald-400 text-[#0b1120] border-emerald-300 font-bold shadow-md"
                      : "bg-white/8 text-stone-300 border-white/12 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  {stage.stepNum} · {stage.shortLabel}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setAutoPlay((v) => !v)}
              aria-label={autoPlay ? "Pause journey autoplay" : "Play journey"}
              className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors"
            >
              {autoPlay ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* 5 Real-Photo iPhone 16 Pro Titanium Frames */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 xl:gap-5 pt-2">
          {JOURNEY_STAGES.map((stage, idx) => {
            const isActive = idx === activeIdx;
            return (
              <div
                key={stage.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveIdx(idx);
                  setAutoPlay(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveIdx(idx);
                    setAutoPlay(false);
                  }
                }}
                className={`group cursor-pointer rounded-[2.45rem] p-[6px] bg-gradient-to-b from-stone-400/70 via-stone-700 to-stone-900 transition-all duration-500 focus:outline-none ${
                  isActive
                    ? "ring-2 ring-emerald-400 -translate-y-2 shadow-[0_24px_48px_-12px_rgba(16,185,129,0.35)]"
                    : "opacity-90 hover:opacity-100 hover:-translate-y-1 shadow-xl"
                }`}
              >
                {/* Inner Screen */}
                <div className="rounded-[2.05rem] bg-[#faf7f2] text-[#111827] overflow-hidden flex flex-col h-full">
                  {/* iOS Top Bezel & Dynamic Island */}
                  <div className="bg-[#0b1120] text-white px-4 pt-2 pb-1.5 flex items-center justify-between text-[9px] font-tech">
                    <span>9:41</span>
                    <div className="w-16 h-3.5 rounded-full bg-black border border-white/10 flex items-center justify-end pr-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-900 ring-1 ring-indigo-400/40" />
                    </div>
                    <span className="inline-flex items-center gap-1">
                      <Wifi className="w-2.5 h-2.5" />
                      <span>5G</span>
                    </span>
                  </div>

                  {/* Real Photograph Scene */}
                  <div className="relative h-36 w-full overflow-hidden bg-stone-900 shrink-0">
                    <Image
                      src={stage.photo}
                      alt={stage.photoAlt}
                      fill
                      sizes="(max-width: 768px) 90vw, 240px"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b1120]/90 via-[#0b1120]/20 to-transparent" />
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1">
                      <span className="px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-md text-white font-tech text-[10px] font-bold border border-white/15">
                        {stage.stepNum} · {stage.shortLabel}
                      </span>
                      {isActive && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                      )}
                    </div>
                    <p className="absolute bottom-2 left-2.5 right-2.5 text-[10px] font-medium text-white/95 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-300 shrink-0" />
                      <span className="truncate">{stage.badgeText}</span>
                    </p>
                  </div>

                  {/* Mobile App UI */}
                  <div className="flex-1 flex flex-col justify-between bg-[#faf7f2]">
                    <IphoneScreenContent stage={stage} />
                    <div className="py-2 flex justify-center">
                      <div className="w-14 h-1 rounded-full bg-stone-900/20" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Stage Summary Strip */}
        <div className="relative z-10 rounded-2xl bg-white/6 border border-white/12 backdrop-blur-md p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <span
              className={`px-3 py-1.5 rounded-xl border text-xs font-tech font-bold shrink-0 ${currentStage.accentBg} ${currentStage.accentText}`}
            >
              Stage {currentStage.stepNum}
            </span>
            <div>
              <p className="font-editorial text-base sm:text-lg font-semibold text-white">
                {currentStage.title}{" "}
                <span className="text-xs font-tech font-normal text-stone-400 ml-1">
                  · {currentStage.actor}
                </span>
              </p>
              <p className="text-xs sm:text-sm text-stone-300 mt-0.5">
                {currentStage.summary}
              </p>
            </div>
          </div>

          <Link
            href={
              currentStage.screenType === "mpesa"
                ? "/creators-hub/join"
                : "/explore"
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-[#0b1120] text-xs font-semibold hover:bg-emerald-50 transition-colors shrink-0"
          >
            {currentStage.screenType === "mpesa"
              ? "Join Creators Hub"
              : "Explore Live Tasks"}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

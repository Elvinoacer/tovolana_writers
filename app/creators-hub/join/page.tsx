import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Sparkles,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ScoreRing } from "@/components/ui/EditorialVisuals";

export const dynamic = "force-dynamic";

const RUBRIC_RINGS = [
  { label: "Grammar & Mechanics", pct: 25, tone: "emerald" as const },
  { label: "Coherence & Flow", pct: 20, tone: "blue" as const },
  { label: "Brief Adherence", pct: 20, tone: "emerald" as const },
  { label: "Originality", pct: 15, tone: "gold" as const },
  { label: "Tone & Format", pct: 10, tone: "blue" as const },
  { label: "Research Accuracy", pct: 10, tone: "gold" as const },
];

export default async function CreatorsHubJoinPage() {
  const [user, assessmentConfig] = await Promise.all([
    getCurrentUser(),
    db.assessmentConfig.findFirst({ where: { isActive: true } }),
  ]);

  const ctaHref = user
    ? user.roles.includes("CREATOR")
      ? "/creators-hub"
      : "/creators-hub/onboarding"
    : `/auth?callbackUrl=${encodeURIComponent("/creators-hub/onboarding")}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12 animate-reveal">
      {/* Studio Hero */}
      <div className="editorial-card p-6 sm:p-10 bg-white ink-grid-bg grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-5">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-[#0f766e] border border-teal-200 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Zero ID Cards · Zero Certificate Uploads
          </span>

          <h1 className="font-editorial text-3xl sm:text-5xl font-semibold text-[#111827] leading-[1.08]">
            Qualify by writing craft. Publish on one account.
          </h1>

          <p className="text-sm sm:text-base text-stone-600 leading-relaxed max-w-xl">
            Complete your writer profile and pass a{" "}
            <strong className="text-[#111827]">
              {assessmentConfig?.durationMinutes ?? 45}-minute
            </strong>{" "}
            6-criteria writing check (score &ge;{" "}
            {assessmentConfig?.passScoreThreshold ?? 75}%) to unlock Creators
            Hub immediately.
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <Link href={ctaHref} className="btn-creator px-6 py-3 text-sm">
              <span>
                {user?.roles.includes("CREATOR")
                  ? "Open Creators Studio"
                  : "Start Writer Assessment"}
              </span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/policies#integrity" className="btn-ghost px-5 py-3 text-sm">
              Integrity Charter
            </Link>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="rounded-2xl overflow-hidden border border-[#e6e0d4] bg-[#faf7f2] p-2">
            <Image
              src="/images/creator-studio.svg"
              alt="Creators Hub merit assessment rubric and M-Pesa payouts overview"
              width={560}
              height={400}
              priority
              className="w-full h-auto rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Visual 6-Criteria Radial Rubric */}
      <section className="editorial-card p-6 sm:p-8 bg-white space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-editorial text-2xl font-semibold">
            Automated 6-Criteria Scoring Matrix
          </h2>
          <span className="text-xs font-tech text-[#0f766e] bg-teal-50 px-3 py-1 rounded-full border border-teal-200 font-semibold">
            {assessmentConfig?.passScoreThreshold ?? 75}% Auto-Unlock · 60–74% Editorial Review
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
          {RUBRIC_RINGS.map((item) => (
            <div
              key={item.label}
              className="p-4 rounded-2xl bg-[#faf7f2] border border-[#e6e0d4] flex flex-col items-center gap-2"
            >
              <ScoreRing
                score={item.pct * 4}
                label={`${item.pct}%`}
                size={74}
                tone={item.tone}
              />
              <span className="text-xs font-semibold text-[#111827] leading-tight">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 3-Step Visual Journey */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="editorial-card p-6 space-y-3">
          <span className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-[#0f766e] flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5" />
          </span>
          <h3 className="font-editorial text-lg font-semibold">
            Unified Account Role
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Book as a customer and earn as a Creator using the exact same
            session and alerts.
          </p>
        </div>

        <div className="editorial-card p-6 space-y-3">
          <span className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-[#1e3a8a] flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </span>
          <h3 className="font-editorial text-lg font-semibold">
            Scoped Publishing
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Draft services with clear prerequisites, deliverables, and 14d or
            30d public validity windows.
          </p>
        </div>

        <div className="editorial-card p-6 space-y-3">
          <span className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </span>
          <h3 className="font-editorial text-lg font-semibold">
            Escrow to M-Pesa B2C
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Approved deliveries credit your available balance instantly for
            direct M-Pesa payout.
          </p>
        </div>
      </div>

      <div className="editorial-card p-5 bg-teal-50/50 border-teal-200 flex items-center gap-3 text-xs text-teal-950">
        <CheckCircle2 className="w-5 h-5 text-[#0f766e] shrink-0" />
        <span>
          Creators focus purely on craft — Tovolana handles IntaSend checkout
          verification, escrow protection, and dispute auditing.
        </span>
      </div>
    </div>
  );
}

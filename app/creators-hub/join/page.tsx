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
import { FlowSteps } from "@/components/ui/FlowGuide";
import {
  AuroraHeading,
  HudCard,
} from "@/components/ui/AuroraPrimitives";

export const dynamic = "force-dynamic";

const RUBRIC_RINGS = [
  { label: "Clear Grammar & Spelling", pct: 25, tone: "emerald" as const },
  { label: "Easy to Follow", pct: 20, tone: "blue" as const },
  { label: "Answers the Question", pct: 20, tone: "emerald" as const },
  { label: "Original Words", pct: 15, tone: "gold" as const },
  { label: "Right Tone & Style", pct: 10, tone: "blue" as const },
  { label: "True Facts & Sources", pct: 10, tone: "gold" as const },
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 animate-reveal">
      {/* Studio Hero */}
      <HudCard
        theme="cyan"
        brackets
        dotMatrix="left"
        microLabel="CREATOR STUDIO · ONBOARDING"
        className="p-6 sm:p-10 ink-grid-bg"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-5">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/15 text-teal-200 border border-teal-400/35 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
              No ID Card · No Certificates Needed
            </span>

            <AuroraHeading
              as="h1"
              className="text-3xl sm:text-5xl font-semibold leading-[1.08]"
            >
              Show your writing skill. Start earning.
            </AuroraHeading>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
              Set up a short writer profile and pass a{" "}
              <strong className="text-white">
                {assessmentConfig?.durationMinutes ?? 45}-minute
              </strong>{" "}
              writing test (score{" "}
              {assessmentConfig?.passScoreThreshold ?? 75}% or higher) to start
              posting services and applying for jobs right away.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <Link href={ctaHref} className="btn-creator px-6 py-3 text-sm">
                <span>
                  {user?.roles.includes("CREATOR")
                    ? "Open Writer Hub"
                    : "Apply as a Writer"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/policies#integrity"
                className="btn-ghost px-5 py-3 text-sm"
              >
                Original Work Rules
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl overflow-hidden border border-cyan-400/25 bg-[#0a111f]/90 p-2.5 shadow-[0_0_28px_rgba(34,211,238,0.12)]">
              <Image
                src="/images/creator-studio.svg"
                alt="How the writing test and M-Pesa payouts work"
                width={560}
                height={400}
                priority
                className="w-full h-auto rounded-xl"
              />
            </div>
          </div>
        </div>
      </HudCard>

      <FlowSteps
        accent="teal"
        currentStep={1}
        goalLabel="Goal: Get approved and receive M-Pesa payouts for your writing"
        steps={[
          { label: "1. Writer profile", hint: "Pick your topics & bio" },
          { label: "2. 45-min writing test", hint: "Show what you can write" },
          { label: "3. Approved & earn", hint: "Offer services & get paid" },
        ]}
      />

      {/* 6-Point Writing Check */}
      <HudCard theme="emerald" className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-editorial text-2xl font-semibold text-white">
            How Your Writing Test Is Graded (6-Point Check)
          </h2>
          <span className="text-xs font-tech text-teal-200 bg-teal-500/15 px-3 py-1 rounded-full border border-teal-400/35 font-semibold">
            {assessmentConfig?.passScoreThreshold ?? 75}% Instant Pass · 60–74%
            Team Check
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
          {RUBRIC_RINGS.map((item) => (
            <div
              key={item.label}
              className="p-4 rounded-2xl bg-white/[0.045] border border-white/[0.11] flex flex-col items-center gap-2"
            >
              <ScoreRing
                score={item.pct * 4}
                label={`${item.pct}%`}
                size={74}
                tone={item.tone}
              />
              <span className="text-xs font-semibold text-white leading-tight">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </HudCard>

      {/* 3 Simple Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HudCard theme="cyan" className="p-6 space-y-3">
          <span className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-400/35 text-teal-300 flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5" />
          </span>
          <h3 className="font-editorial text-lg font-semibold text-white">
            One Account Does Everything
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Use the same sign-in to order writing help as a client or earn as a
            writer.
          </p>
        </HudCard>

        <HudCard theme="sky" className="p-6 space-y-3">
          <span className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/35 text-sky-300 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </span>
          <h3 className="font-editorial text-lg font-semibold text-white">
            Clear Prices &amp; Deadlines
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            List your own services with your price, delivery days, and what
            instructions you need.
          </p>
        </HudCard>

        <HudCard theme="amber" className="p-6 space-y-3">
          <span className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/35 text-amber-300 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </span>
          <h3 className="font-editorial text-lg font-semibold text-white">
            Fast M-Pesa Payouts
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            As soon as a client approves your finished work, your earnings are
            ready to withdraw to M-Pesa.
          </p>
        </HudCard>
      </div>

      <div className="editorial-card p-5 border-teal-400/35 bg-teal-500/[0.09] flex items-center gap-3 text-xs text-teal-100">
        <CheckCircle2 className="w-5 h-5 text-teal-300 shrink-0" />
        <span>
          You just focus on great writing — we handle safe client payments,
          M-Pesa payouts, and Support help.
        </span>
      </div>
    </div>
  );
}

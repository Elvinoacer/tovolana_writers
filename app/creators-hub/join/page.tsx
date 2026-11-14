import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Sparkles,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="editorial-card p-8 sm:p-10 bg-white grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Creators Hub Entry (Screen 1.6) · Zero Paperwork Barrier
          </div>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#111827] leading-tight">
            Prove your writing craft once. Publish scoped services on your existing account.
          </h1>
          <p className="text-sm sm:text-base text-stone-600 leading-relaxed max-w-2xl">
            No separate login required. Joining the Creators Hub upgrades your
            active Tovolana account after passing an automated{" "}
            {assessmentConfig?.durationMinutes ?? 45}-minute, 6-criteria writing
            evaluation.{" "}
            <strong>
              No government ID or academic certificates are required.
            </strong>
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 transition-colors"
            >
              {user?.roles.includes("CREATOR")
                ? "Open Creators Hub"
                : "Start Creator Assessment Onboarding"}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/policies#integrity"
              className="px-5 py-3 rounded-xl border border-[#e6e0d4] text-sm font-semibold hover:bg-stone-50"
            >
              Read Academic Integrity Charter
            </Link>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-3 bg-[#faf7f2] p-5 rounded-xl border border-[#e6e0d4]">
          <p className="text-xs font-tech uppercase tracking-wider text-stone-500">
            Active Assessment Rubric
          </p>
          <div className="space-y-2 text-xs">
            {[
              ["Grammar & Mechanics", "25%"],
              ["Coherence & Structure", "20%"],
              ["Instruction & Word Count Adherence", "20%"],
              ["Originality & Expression", "15%"],
              ["Tone & Formatting", "10%"],
              ["Research & Citation Accuracy", "10%"],
            ].map(([label, weight]) => (
              <div
                key={label}
                className="flex items-center justify-between py-1.5 border-b border-[#e6e0d4] last:border-0"
              >
                <span className="font-medium text-stone-800">{label}</span>
                <span className="font-tech font-semibold text-teal-800">
                  {weight}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-stone-500 pt-1">
            Score &ge; {assessmentConfig?.passScoreThreshold ?? 75}% unlocks
            Creators Hub immediately. Scores 60–74% route to editorial admin
            review.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="editorial-card p-6 space-y-2.5">
          <ClipboardCheck className="w-6 h-6 text-teal-700" />
          <h3 className="font-editorial text-lg font-semibold">
            1. Single Account Roles
          </h3>
          <p className="text-sm text-stone-600">
            Keep booking as a customer while selling services as a Creator under
            one unified credential &amp; notification center.
          </p>
        </div>
        <div className="editorial-card p-6 space-y-2.5">
          <FileText className="w-6 h-6 text-[#1e3a8a]" />
          <h3 className="font-editorial text-lg font-semibold">
            2. Structured Moderation
          </h3>
          <p className="text-sm text-stone-600">
            Save drafts or submit listings for administrator approval with clear
            14-day or 30-day public validity dates.
          </p>
        </div>
        <div className="editorial-card p-6 space-y-2.5">
          <Wallet className="w-6 h-6 text-amber-700" />
          <h3 className="font-editorial text-lg font-semibold">
            3. Escrow-Backed Earnings
          </h3>
          <p className="text-sm text-stone-600">
            Every paid order enters protected escrow and unlocks straight into
            your available balance upon customer completion, withdrawable via
            M-Pesa.
          </p>
        </div>
      </div>

      <div className="editorial-card p-6 bg-white flex items-start gap-3">
        <Award className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
        <div className="text-sm text-stone-700 space-y-1">
          <p className="font-semibold text-[#111827]">
            Important Creator Safeguards
          </p>
          <p className="flex items-center gap-1.5 text-xs text-stone-600">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            Creators retain full focus on craft: platform administrators manage
            payment verification, refunds, and financial records cleanly.
          </p>
        </div>
      </div>
    </div>
  );
}

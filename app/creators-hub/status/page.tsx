"use client";

import { CreatorShell } from "@/components/CreatorShell";
import { ScoreRing } from "@/components/ui/EditorialVisuals";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Feather,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { StatusPill, formatShortDate } from "@/components/ui/Badges";

interface AttemptRecord {
  id: string;
  wordCount: number;
  grammarScore: number | null;
  coherenceScore: number | null;
  instructionScore: number | null;
  originalityScore: number | null;
  toneScore: number | null;
  researchScore: number | null;
  totalScore: number | null;
  autoDecision: string;
  reviewNote: string | null;
  submittedAt: string | null;
  createdAt: string;
  config: { title: string; minWords: number; maxWords: number };
}

interface CreatorProfileInfo {
  username: string;
  displayName: string;
  applicationStatus: string;
  assessmentScore: number | null;
  assessmentAttemptCount: number;
  cooldownUntil: string | null;
}

export default function CreatorStatusPage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<CreatorProfileInfo | null>(null);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    fetch("/api/creators-hub/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (active && j?.data) {
          setProfile(j.data.creatorProfile);
          setAttempts(j.data.attempts ?? []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setFetched(true);
      });
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const loading = authLoading || (Boolean(user) && !fetched);

  if (authLoading || loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading Creator vetting breakdown...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <h1 className="text-2xl font-editorial font-semibold">
            Sign in to check Creator Application Status
          </h1>
          <Link
            href="/auth?next=/creators-hub/status"
            className="inline-flex px-5 py-2.5 rounded-lg bg-[#0f766e] text-white text-sm font-semibold"
          >
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <Feather className="w-10 h-10 text-[#0f766e] mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold">
            You haven&apos;t applied to the Creators Hub yet
          </h1>
          <p className="text-sm text-stone-600">
            Create your writer profile and take our instant 6-criteria
            assessment — no ID or academic certificate uploads required.
          </p>
          <Link
            href="/creators-hub/onboarding"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0f766e] text-white text-sm font-semibold"
          >
            Start Creator Onboarding
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    );
  }

  const latest = attempts[0];
  const criteria = latest
    ? [
        { label: "Grammar & Mechanics", score: latest.grammarScore },
        { label: "Coherence & Flow", score: latest.coherenceScore },
        { label: "Instruction Adherence", score: latest.instructionScore },
        { label: "Originality & Vocabulary", score: latest.originalityScore },
        { label: "Professional Tone", score: latest.toneScore },
        { label: "Research & Depth", score: latest.researchScore },
      ]
    : [];

  const statusTone =
    profile.applicationStatus === "APPROVED"
      ? "emerald"
      : profile.applicationStatus === "UNDER_REVIEW"
        ? "gold"
        : "rose";

  return (
    <CreatorShell
      requireApproved={false}
      title="Creator Assessment Status"
      subtitle={`@${profile.username} · Automated 6-criteria writing evaluation`}
    >
      <div className="max-w-4xl space-y-6">
        <div className="editorial-card p-6 sm:p-8 bg-white space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-tech text-stone-500">
                  @{profile.username}
                </span>
                <StatusPill status={profile.applicationStatus} />
              </div>
              <h2 className="text-2xl font-editorial font-semibold">
                {profile.applicationStatus === "APPROVED"
                  ? "Vetted & Ready to Publish"
                  : profile.applicationStatus === "UNDER_REVIEW"
                    ? "Queued for Calibration Review"
                    : "Retake Available"}
              </h2>
            </div>

            {latest && (
              <ScoreRing
                score={latest.totalScore ?? profile.assessmentScore ?? 0}
                size={96}
                strokeWidth={8}
                sublabel="Composite Score"
                tone={statusTone}
              />
            )}
          </div>

          {profile.applicationStatus === "APPROVED" && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-2.5 text-sm text-emerald-950">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    Creators Hub Unlocked
                  </p>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Create task drafts, accept funded bookings, and withdraw via M-Pesa B2C.
                  </p>
                </div>
              </div>
              <Link
                href="/creators-hub"
                className="btn-creator px-4 py-2 text-xs"
              >
                Open Studio
              </Link>
            </div>
          )}

          {profile.applicationStatus === "UNDER_REVIEW" && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
              <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">
                  Borderline Score — Admin Calibration Queue
                </p>
                <p className="mt-0.5">
                  A senior moderator reviews borderline drafts within 24h.
                </p>
              </div>
            </div>
          )}

          {profile.applicationStatus === "REJECTED" && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-4 flex-wrap text-xs text-rose-900">
              <div>
                <p className="font-semibold text-sm">
                  Below Threshold ({profile.assessmentScore ?? 0}/100)
                </p>
                <p className="mt-0.5">
                  {profile.cooldownUntil
                    ? `Retake opens ${formatShortDate(profile.cooldownUntil)}.`
                    : "Retake window is open now."}
                </p>
              </div>
              {(!profile.cooldownUntil ||
                new Date(profile.cooldownUntil) <= new Date()) && (
                <Link
                  href="/creators-hub/assessment/live"
                  className="btn-creator px-4 py-2 text-xs gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retake Exam
                </Link>
              )}
            </div>
          )}
        </div>

        {latest && (
          <div className="editorial-card p-6 sm:p-8 bg-white space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
                <Award className="w-5 h-5 text-[#0f766e]" />
                6-Criteria Breakdown
              </h2>
              <span className="font-tech text-xl font-bold text-[#0f766e]">
                {latest.totalScore ?? "Pending"}/100
              </span>
            </div>

            {latest.reviewNote && (
              <p className="text-sm text-stone-700 bg-[#faf7f2] p-3.5 rounded-xl border border-[#e6e0d4]">
                {latest.reviewNote}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {criteria.map((c) => {
                const val = Math.round(c.score ?? 0);
                return (
                  <div
                    key={c.label}
                    className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] space-y-2"
                  >
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{c.label}</span>
                      <span className="font-tech text-[#0f766e]">{val}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
                      <div
                        className="h-full bg-[#0f766e] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </CreatorShell>
  );
}

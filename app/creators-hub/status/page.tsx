"use client";

import { CreatorShell } from "@/components/CreatorShell";
import { ScoreRing } from "@/components/ui/EditorialVisuals";
import { FlowSteps, NextStepBanner } from "@/components/ui/FlowGuide";
import { HudCard } from "@/components/ui/AuroraPrimitives";

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
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading your writing test results...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <HudCard theme="cyan" brackets className="p-8 text-center space-y-4">
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Sign in to check your Writer Test Status
          </h1>
          <Link
            href="/auth?next=/creators-hub/status"
            className="btn-creator inline-flex px-5 py-2.5 text-sm font-semibold"
          >
            Sign In
          </Link>
        </HudCard>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <HudCard theme="cyan" brackets className="p-8 text-center space-y-4">
          <Feather className="w-10 h-10 text-teal-300 mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold text-white">
            You haven&apos;t applied to write yet
          </h1>
          <p className="text-sm text-slate-300">
            Create your writer profile and take our short writing test — no ID
            card or certificates needed.
          </p>
          <Link
            href="/creators-hub/onboarding"
            className="btn-creator inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
          >
            Apply as a Writer
            <ArrowRight className="w-4 h-4" />
          </Link>
        </HudCard>
      </main>
    );
  }

  const latest = attempts[0];
  const criteria = latest
    ? [
        { label: "Clear Grammar & Spelling", score: latest.grammarScore },
        { label: "Easy to Follow", score: latest.coherenceScore },
        { label: "Answers the Question", score: latest.instructionScore },
        { label: "Original Words", score: latest.originalityScore },
        { label: "Right Tone & Style", score: latest.toneScore },
        { label: "True Facts & Sources", score: latest.researchScore },
      ]
    : [];

  const statusTone =
    profile.applicationStatus === "APPROVED"
      ? "emerald"
      : profile.applicationStatus === "UNDER_REVIEW"
        ? "gold"
        : "rose";

  const bannerTone =
    profile.applicationStatus === "APPROVED"
      ? "emerald"
      : profile.applicationStatus === "UNDER_REVIEW"
        ? "amber"
        : "rose";

  const cardTheme =
    profile.applicationStatus === "APPROVED"
      ? "emerald"
      : profile.applicationStatus === "UNDER_REVIEW"
        ? "amber"
        : "rose";

  return (
    <CreatorShell
      requireApproved={false}
      title="Test Status"
      subtitle={`@${profile.username} · 6-point writing test result`}
    >
      <div className="max-w-4xl space-y-6">
        <FlowSteps
          accent="teal"
          currentStep={profile.applicationStatus === "APPROVED" ? 3 : 2}
          goalLabel="Goal: Start posting services and receiving M-Pesa payouts"
          steps={[
            { label: "1. Writer profile", hint: "Saved" },
            {
              label: "2. 45-min writing test",
              hint: latest ? "Submitted" : "Take test",
            },
            {
              label: "3. Approved & earn",
              hint:
                profile.applicationStatus === "APPROVED"
                  ? "Ready now!"
                  : "Unlocks on pass",
            },
          ]}
        />

        <NextStepBanner
          tone={bannerTone}
          eyebrow="Application status"
          now={
            profile.applicationStatus === "APPROVED"
              ? "Congratulations! You passed the test and your Writer Hub is unlocked."
              : profile.applicationStatus === "UNDER_REVIEW"
                ? "Your sample is close to the pass mark, so our team is checking it by hand."
                : `Your score was ${profile.assessmentScore ?? 0}/100, which is below the pass mark.`
          }
          next={
            profile.applicationStatus === "APPROVED"
              ? "Add your first writing service or browse Open Jobs to start earning."
              : profile.applicationStatus === "UNDER_REVIEW"
                ? "Wait up to 24 hours — we'll notify you as soon as a reviewer decides."
                : profile.cooldownUntil &&
                    new Date(profile.cooldownUntil) > new Date()
                  ? `You can try the test again after ${formatShortDate(profile.cooldownUntil)}.`
                  : "You can take the writing test again right now."
          }
          goal="Join tested writers and earn directly via M-Pesa."
          actionLabel={
            profile.applicationStatus === "APPROVED"
              ? "Add a Service"
              : profile.applicationStatus === "REJECTED" &&
                  (!profile.cooldownUntil ||
                    new Date(profile.cooldownUntil) <= new Date())
                ? "Try Test Again"
                : undefined
          }
          actionHref={
            profile.applicationStatus === "APPROVED"
              ? "/creators-hub/listings/new"
              : "/creators-hub/assessment/live"
          }
        />

        <HudCard
          theme={cardTheme}
          brackets
          microLabel="ASSESSMENT RESULT"
          className="p-6 sm:p-8 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-tech text-slate-400">
                  @{profile.username}
                </span>
                <StatusPill status={profile.applicationStatus} />
              </div>
              <h2 className="text-2xl font-editorial font-semibold text-white">
                {profile.applicationStatus === "APPROVED"
                  ? "Approved & Ready to Earn"
                  : profile.applicationStatus === "UNDER_REVIEW"
                    ? "Team Checking Your Sample"
                    : "Try Again When Ready"}
              </h2>
            </div>

            {latest && (
              <ScoreRing
                score={latest.totalScore ?? profile.assessmentScore ?? 0}
                size={96}
                strokeWidth={8}
                sublabel="Total Score"
                tone={statusTone}
              />
            )}
          </div>

          {profile.applicationStatus === "APPROVED" && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-400/35 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-2.5 text-sm text-emerald-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Writer Hub Unlocked</p>
                  <p className="text-xs text-emerald-200/90 mt-0.5">
                    Add your writing services, accept client orders, and
                    withdraw earnings via M-Pesa.
                  </p>
                </div>
              </div>
              <Link
                href="/creators-hub"
                className="btn-creator px-4 py-2 text-xs"
              >
                Open Writer Hub
              </Link>
            </div>
          )}

          {profile.applicationStatus === "UNDER_REVIEW" && (
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-400/35 flex items-start gap-2.5 text-xs text-amber-100">
              <Clock className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-white">
                  Close Score — Team Check in Progress
                </p>
                <p className="mt-0.5 text-amber-200/90">
                  A reviewer on our team checks samples in this range within 24
                  hours.
                </p>
              </div>
            </div>
          )}

          {profile.applicationStatus === "REJECTED" && (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-400/35 flex items-center justify-between gap-4 flex-wrap text-xs text-rose-100">
              <div>
                <p className="font-semibold text-sm text-white">
                  Score Too Low ({profile.assessmentScore ?? 0}/100)
                </p>
                <p className="mt-0.5 text-rose-200/90">
                  {profile.cooldownUntil
                    ? `You can try again on ${formatShortDate(profile.cooldownUntil)}.`
                    : "You can try the writing test again now."}
                </p>
              </div>
              {(!profile.cooldownUntil ||
                new Date(profile.cooldownUntil) <= new Date()) && (
                <Link
                  href="/creators-hub/assessment/live"
                  className="btn-creator px-4 py-2 text-xs gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Try Test Again
                </Link>
              )}
            </div>
          )}
        </HudCard>

        {latest && (
          <HudCard theme="cyan" className="p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-editorial text-xl font-semibold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-teal-300" />
                6-Point Score Breakdown
              </h2>
              <span className="font-tech text-xl font-bold text-teal-300">
                {latest.totalScore ?? "Pending"}/100
              </span>
            </div>

            {latest.reviewNote && (
              <p className="text-sm text-slate-200 bg-white/[0.045] p-3.5 rounded-xl border border-white/[0.11]">
                {latest.reviewNote}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {criteria.map((c) => {
                const val = Math.round(c.score ?? 0);
                return (
                  <div
                    key={c.label}
                    className="p-3.5 rounded-xl bg-white/[0.045] border border-white/[0.11] space-y-2"
                  >
                    <div className="flex justify-between text-xs font-semibold text-slate-200">
                      <span>{c.label}</span>
                      <span className="font-tech text-teal-300">{val}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-teal-400 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(0, val))}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </HudCard>
        )}
      </div>
    </CreatorShell>
  );
}

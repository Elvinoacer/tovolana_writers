"use client";

import { ScoreRing } from "@/components/ui/EditorialVisuals";
import { FlowSteps } from "@/components/ui/FlowGuide";
import { AuroraHeading, HudCard } from "@/components/ui/AuroraPrimitives";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Feather,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";

interface AssessmentConfigData {
  id: string;
  title: string;
  promptText: string;
  durationMinutes: number;
  minWords: number;
  maxWords: number;
  passScoreThreshold: number;
  reviewScoreThreshold: number;
}

interface AssessmentAttemptData {
  id: string;
  startedAt: string;
}

const RUBRIC_CRITERIA = [
  "Clear Grammar & Spelling",
  "Easy to Follow",
  "Answers the Question",
  "Original Words",
  "Right Tone & Style",
  "True Facts & Sources",
];

export default function LiveAssessmentStudioPage() {
  const { user, refresh, loading: authLoading } = useAuth();
  const router = useRouter();

  const [config, setConfig] = useState<AssessmentConfigData | null>(null);
  const [attempt, setAttempt] = useState<AssessmentAttemptData | null>(null);
  const [responseText, setResponseText] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [fetched, setFetched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    fetch("/api/creators-hub/assessment/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) {
          throw new Error(j.error?.message || "Could not start assessment.");
        }
        return j.data;
      })
      .then((d) => {
        if (!active) return;
        setConfig(d.config);
        setAttempt(d.attempt);
        const endAt =
          new Date(d.attempt.startedAt).getTime() +
          d.config.durationMinutes * 60 * 1000;
        setSecondsLeft(Math.max(0, Math.floor((endAt - Date.now()) / 1000)));
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setFetched(true);
      });

    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const loading = authLoading || (Boolean(user) && !fetched);

  useEffect(() => {
    if (!config || !attempt) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [config, attempt]);

  const wordCount = responseText
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!attempt) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/creators-hub/assessment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: attempt.id,
          responseText,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error?.message || "Evaluation failed.");
      }
      await refresh();
      router.push("/creators-hub/status");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || authLoading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Setting up your writing test...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <HudCard theme="cyan" brackets className="p-8 text-center space-y-4">
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Sign in to take the Writing Test
          </h1>
          <Link
            href="/auth?next=/creators-hub/assessment/live"
            className="btn-creator inline-flex px-5 py-2.5 text-sm font-semibold"
          >
            Sign In
          </Link>
        </HudCard>
      </main>
    );
  }

  if (!attempt || !config) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <HudCard theme="amber" brackets className="p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-300 mx-auto" />
          <h1 className="text-xl font-editorial font-semibold text-white">
            {error || "Please fill in your writer profile first."}
          </h1>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link
              href="/creators-hub/onboarding"
              className="btn-creator px-4 py-2 text-sm font-semibold"
            >
              Set Up Writer Profile
            </Link>
            <Link
              href="/creators-hub/status"
              className="btn-ghost px-4 py-2 text-sm"
            >
              Check Test Status
            </Link>
          </div>
        </HudCard>
      </main>
    );
  }

  const totalSecsRemaining = mins * 60 + secs;
  const maxSeconds = Math.max(60, (config.durationMinutes || 45) * 60);
  const wordPct = Math.min(
    100,
    Math.round((wordCount / Math.max(1, config.maxWords)) * 100)
  );
  const inWordBand =
    wordCount >= config.minWords && wordCount <= config.maxWords;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-reveal">
      <FlowSteps
        accent="teal"
        currentStep={2}
        goalLabel="Goal: Score 75%+ to unlock your Writer Hub right away"
        steps={[
          { label: "1. Writer profile", hint: "Profile saved" },
          { label: "2. 45-min writing test", hint: "Write your sample now" },
          { label: "3. Approved & earn", hint: "Post services & get paid" },
        ]}
      />

      <HudCard
        theme="cyan"
        brackets
        microLabel="LIVE WRITING ASSESSMENT"
        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <span className="text-[11px] font-tech font-semibold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
            <Feather className="w-3.5 h-3.5" />
            Step 2 of 3 · Timed Writing Test
          </span>
          <AuroraHeading as="h1" className="text-2xl font-semibold mt-0.5">
            {config.title}
          </AuroraHeading>
        </div>

        <div className="flex items-center gap-5">
          <div className="space-y-1 min-w-[150px]">
            <div className="flex justify-between text-[11px] font-tech">
              <span className="text-slate-400">Words</span>
              <span
                className={`font-bold ${
                  inWordBand ? "text-emerald-300" : "text-amber-300"
                }`}
              >
                {wordCount} / {config.minWords}–{config.maxWords}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  inWordBand ? "bg-teal-400" : "bg-amber-400"
                }`}
                style={{ width: `${wordPct}%` }}
              />
            </div>
          </div>

          <ScoreRing
            score={totalSecsRemaining}
            max={maxSeconds}
            size={64}
            strokeWidth={5}
            label={`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`}
            tone={mins < 5 ? "rose" : "emerald"}
          />
        </div>
      </HudCard>

      {error && (
        <div className="p-3.5 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 editorial-card p-6 sm:p-7 space-y-5"
        >
          <div className="p-4 rounded-2xl bg-white/[0.045] border border-white/[0.12] space-y-1.5">
            <p className="text-[11px] font-tech font-semibold uppercase tracking-wider text-teal-300">
              Your Writing Prompt
            </p>
            <p className="text-sm text-white leading-relaxed">
              {config.promptText}
            </p>
          </div>

          <textarea
            rows={17}
            required
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Write a clear, well-organized answer that covers every part of the topic above..."
            className="hud-input p-5 leading-relaxed rounded-2xl"
          />

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs font-tech text-slate-400">
              <Clock className="w-3.5 h-3.5 text-teal-300" />
              <span>
                Pass now: {config.passScoreThreshold}%+ · Team check:{" "}
                {config.reviewScoreThreshold}–{config.passScoreThreshold - 1}%
              </span>
            </div>
            <button
              type="submit"
              disabled={submitting || wordCount < 30}
              className="btn-creator px-6 py-2.5 text-sm gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Checking Writing..." : "Finish & Grade My Test"}
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <HudCard theme="emerald" className="p-5 space-y-4 sticky top-24">
            <h2 className="font-editorial text-lg font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-300" />
              How We Grade Your Sample
            </h2>
            <div className="space-y-2">
              {RUBRIC_CRITERIA.map((c) => (
                <div
                  key={c}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.045] border border-white/[0.11] text-xs font-medium text-slate-200"
                >
                  <CheckCircle2 className="w-4 h-4 text-teal-300 shrink-0" />
                  <span>{c}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 pt-2 border-t border-white/[0.08]">
              Score {config.passScoreThreshold}% or more to unlock your Writer
              Hub right away and start posting services.
            </p>
          </HudCard>
        </aside>
      </div>
    </main>
  );
}

"use client";

import { ScoreRing } from "@/components/ui/EditorialVisuals";

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
  "Grammar & Mechanics",
  "Coherence & Argument Flow",
  "Instruction Adherence",
  "Originality & Lexical Richness",
  "Professional Tone",
  "Research & Evidence Depth",
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
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Preparing timed writing assessment studio...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <h1 className="text-2xl font-editorial font-semibold">
            Sign in to take the Creator Assessment
          </h1>
          <Link
            href="/auth?next=/creators-hub/assessment/live"
            className="inline-flex px-5 py-2.5 rounded-lg bg-[#0f766e] text-white text-sm font-semibold"
          >
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  if (!attempt || !config) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="text-xl font-editorial font-semibold">
            {error || "Complete Creator onboarding before starting the exam."}
          </h1>
          <div className="flex justify-center gap-3">
            <Link
              href="/creators-hub/onboarding"
              className="px-4 py-2 rounded-lg bg-[#0f766e] text-white text-sm font-semibold"
            >
              Complete Onboarding
            </Link>
            <Link
              href="/creators-hub/status"
              className="px-4 py-2 rounded-lg border border-[#e6e0d4] bg-white text-sm"
            >
              View Status
            </Link>
          </div>
        </div>
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
      <div className="editorial-card p-5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-tech font-semibold text-[#0f766e] uppercase tracking-wider flex items-center gap-1.5">
            <Feather className="w-3.5 h-3.5" />
            Zen Vetting Studio · 6-Criteria Exam
          </span>
          <h1 className="text-2xl font-editorial font-semibold mt-0.5 text-[#111827]">
            {config.title}
          </h1>
        </div>

        <div className="flex items-center gap-5">
          <div className="space-y-1 min-w-[140px]">
            <div className="flex justify-between text-[11px] font-tech">
              <span className="text-stone-500">Words</span>
              <span
                className={`font-bold ${
                  inWordBand ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {wordCount} / {config.minWords}–{config.maxWords}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#f2ede3] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  inWordBand ? "bg-[#0f766e]" : "bg-amber-600"
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
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 editorial-card p-6 sm:p-7 bg-white space-y-5"
        >
          <div className="p-4 rounded-2xl bg-[#faf7f2] border border-[#e6e0d4] space-y-1.5">
            <p className="text-[11px] font-tech font-semibold uppercase tracking-wider text-[#0f766e]">
              Live Evaluation Prompt
            </p>
            <p className="text-sm text-[#111827] leading-relaxed">
              {config.promptText}
            </p>
          </div>

          <textarea
            rows={17}
            required
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Compose a crisp, structured response addressing every dimension of the prompt..."
            className="w-full rounded-2xl border border-[#e6e0d4] bg-[#faf7f2]/40 p-5 text-sm leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e]/25 transition-colors"
          />

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs font-tech text-stone-500">
              <Clock className="w-3.5 h-3.5 text-[#0f766e]" />
              <span>
                Instant Unlock ≥{config.passScoreThreshold}/100 · Review Band{" "}
                {config.reviewScoreThreshold}–{config.passScoreThreshold - 1}
              </span>
            </div>
            <button
              type="submit"
              disabled={submitting || wordCount < 30}
              className="btn-creator px-6 py-2.5 text-sm gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Evaluating Craft..." : "Submit Assessment"}
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="editorial-card p-5 bg-white space-y-4 sticky top-24">
            <h2 className="font-editorial text-lg font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0f766e]" />
              6-Criteria Rubric
            </h2>
            <div className="space-y-2">
              {RUBRIC_CRITERIA.map((c) => (
                <div
                  key={c}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] text-xs font-medium text-[#111827]"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#0f766e] shrink-0" />
                  <span>{c}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-stone-500 pt-2 border-t border-[#e6e0d4]">
              Scoring {config.passScoreThreshold}+ adds Creator Hub permissions to your existing account immediately.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

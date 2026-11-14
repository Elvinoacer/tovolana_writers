"use client";

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

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="editorial-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-[#0f766e] uppercase tracking-wide flex items-center gap-1.5">
            <Feather className="w-3.5 h-3.5" />
            Automated 6-Criteria Writing Evaluation
          </span>
          <h1 className="text-2xl font-editorial font-semibold mt-0.5">
            {config.title}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="block text-[11px] text-stone-500">
              Word Target
            </span>
            <span
              className={`font-tech text-sm font-bold ${
                wordCount >= config.minWords && wordCount <= config.maxWords
                  ? "text-emerald-700"
                  : "text-amber-700"
              }`}
            >
              {wordCount} / {config.minWords}–{config.maxWords}
            </span>
          </div>

          <div className="px-3.5 py-2 rounded-lg bg-[#111827] text-white font-tech text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 editorial-card p-6 space-y-4"
        >
          <div className="p-4 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0f766e]">
              Assessment Prompt
            </p>
            <p className="text-sm text-[#111827] leading-relaxed">
              {config.promptText}
            </p>
          </div>

          <textarea
            rows={16}
            required
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Write a clear, well-structured executive response addressing every requirement of the prompt..."
            className="w-full rounded-xl border border-[#e6e0d4] bg-white p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0f766e]/25"
          />

          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-stone-500">
              Instant pass score: {config.passScoreThreshold}/100 · Manual
              review band: {config.reviewScoreThreshold}–
              {config.passScoreThreshold - 1}
            </p>
            <button
              type="submit"
              disabled={submitting || wordCount < 30}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#0f766e] text-white text-sm font-semibold hover:bg-teal-900 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Evaluating Response..." : "Submit for Evaluation"}
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="editorial-card p-5 space-y-3">
            <h2 className="font-editorial text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0f766e]" />
              6-Criteria Rubric
            </h2>
            <ul className="space-y-2 text-xs text-stone-700">
              {RUBRIC_CRITERIA.map((c) => (
                <li key={c} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0f766e] shrink-0" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-stone-500 pt-2 border-t border-[#e6e0d4]">
              Scoring {config.passScoreThreshold}+ automatically adds Creator
              Hub capabilities to your current account — no ID verification
              delay.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

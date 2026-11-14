"use client";

import {
  CreatorAvatar,
  ScoreRing,
} from "@/components/ui/EditorialVisuals";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { StatusPill } from "@/components/ui/Badges";

interface PendingAttemptRow {
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
  responseText: string | null;
  creatorProfile: {
    id: string;
    username: string;
    displayName: string;
    user: { name: string; email: string };
  };
  config: { title: string };
}

export default function AdminCreatorVettingPage() {
  const [attempts, setAttempts] = useState<PendingAttemptRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setAttempts(j.data?.pendingAssessments ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/overview", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (active && j?.data) setAttempts(j.data.pendingAssessments ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function overrideDecision(
    attemptId: string,
    decision: "APPROVED" | "REJECTED"
  ) {
    const res = await fetch(`/api/admin/assessments/${attemptId}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        reviewNote:
          notes[attemptId] ||
          `Moderator calibration decision: ${decision}`,
      }),
    });
    if (res.ok) {
      setNotice(`Assessment ${attemptId} marked as ${decision}.`);
      await loadQueue();
    }
  }

  return (
    <AdminShell
      title="Creator Assessment Vetting"
      subtitle="Review borderline writing exam submissions across all 6 rubric dimensions and approve or reject Creators Hub access."
      requiredScope="MODERATION_ADMIN"
    >
      {notice && (
        <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading borderline assessments...
        </div>
      ) : attempts.length === 0 ? (
        <div className="editorial-card p-8 text-center text-sm text-stone-600 flex flex-col items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-[#0f766e]" />
          No borderline Creator assessments awaiting calibration right now.
        </div>
      ) : (
        <div className="space-y-4">
          {attempts.map((a) => (
            <div key={a.id} className="editorial-card p-6 bg-white space-y-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3.5">
                  <CreatorAvatar
                    name={a.creatorProfile.displayName}
                    username={a.creatorProfile.username}
                    size="md"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusPill status={a.autoDecision} />
                      <span className="font-tech text-xs text-stone-500">
                        @{a.creatorProfile.username} ({a.creatorProfile.user.email})
                      </span>
                    </div>
                    <h2 className="font-editorial text-xl font-semibold mt-1">
                      {a.creatorProfile.displayName} — {a.config.title}
                    </h2>
                  </div>
                </div>
                <ScoreRing
                  score={a.totalScore ?? 0}
                  size={74}
                  strokeWidth={6}
                  tone={(a.totalScore ?? 0) >= 75 ? "emerald" : "gold"}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs">
                {[
                  ["Grammar", a.grammarScore],
                  ["Coherence", a.coherenceScore],
                  ["Instruction", a.instructionScore],
                  ["Originality", a.originalityScore],
                  ["Tone", a.toneScore],
                  ["Research", a.researchScore],
                ].map(([label, val]) => {
                  const pct = Math.min(100, Math.max(0, Math.round(Number(val ?? 0))));
                  return (
                    <div
                      key={String(label)}
                      className="p-3 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-stone-600">{label}</span>
                        <span className="font-tech font-bold text-[#0f766e]">
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
                        <div
                          className="h-full bg-[#0f766e] rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {a.responseText && (
                <p className="text-xs text-stone-700 bg-[#faf7f2] p-4 rounded-xl border border-[#e6e0d4] whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {a.responseText}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={notes[a.id] ?? ""}
                  onChange={(e) =>
                    setNotes((p) => ({ ...p, [a.id]: e.target.value }))
                  }
                  placeholder="Moderator calibration note..."
                  className="flex-1 rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2 text-xs"
                />
                <button
                  onClick={() => overrideDecision(a.id, "APPROVED")}
                  className="btn-creator px-4 py-2 text-xs gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve Creator
                </button>
                <button
                  onClick={() => overrideDecision(a.id, "REJECTED")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-300 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

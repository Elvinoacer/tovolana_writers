"use client";

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
            <div key={a.id} className="editorial-card p-6 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={a.autoDecision} />
                    <span className="font-tech text-xs text-stone-500">
                      @{a.creatorProfile.username} ({a.creatorProfile.user.email})
                    </span>
                  </div>
                  <h2 className="font-editorial text-xl font-semibold mt-1">
                    {a.creatorProfile.displayName} — {a.config.title}
                  </h2>
                </div>
                <span className="font-tech text-2xl font-bold text-[#1e3a8a]">
                  {a.totalScore}/100
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                {[
                  ["Grammar", a.grammarScore],
                  ["Coherence", a.coherenceScore],
                  ["Instruction", a.instructionScore],
                  ["Originality", a.originalityScore],
                  ["Tone", a.toneScore],
                  ["Research", a.researchScore],
                ].map(([label, val]) => (
                  <div
                    key={String(label)}
                    className="p-2 rounded bg-[#faf7f2] border border-[#e6e0d4] text-center"
                  >
                    <span className="block text-stone-500">{label}</span>
                    <span className="font-tech font-bold">
                      {Math.round(Number(val ?? 0))}%
                    </span>
                  </div>
                ))}
              </div>

              {a.responseText && (
                <p className="text-xs text-stone-700 bg-stone-50 p-3 rounded border border-[#e6e0d4] whitespace-pre-wrap max-h-40 overflow-y-auto">
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
                  placeholder="Moderator evaluation note..."
                  className="flex-1 rounded-lg border border-[#e6e0d4] bg-white px-3 py-2 text-xs"
                />
                <button
                  onClick={() => overrideDecision(a.id, "APPROVED")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f766e] text-white text-xs font-semibold"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve Creator
                </button>
                <button
                  onClick={() => overrideDecision(a.id, "REJECTED")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-rose-300 bg-white text-rose-700 text-xs font-semibold"
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

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Feather,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

export default function CreatorOnboardingPage() {
  const { user, refresh, loading: authLoading } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [usernameOverride, setUsernameOverride] = useState<string | null>(null);
  const [displayNameOverride, setDisplayNameOverride] = useState<string | null>(
    null
  );
  const defaultUsername = user
    ? user.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 20) || "writer_user"
    : "";
  const username = usernameOverride ?? defaultUsername;
  const setUsername = (v: string) => setUsernameOverride(v);
  const displayName = displayNameOverride ?? user?.name ?? "";
  const setDisplayName = (v: string) => setDisplayNameOverride(v);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "Academic Writing",
  ]);
  const [pledgeAccepted, setPledgeAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categories", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCategories(j.data?.categories ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.creatorProfile?.applicationStatus === "APPROVED") {
      router.replace("/creators-hub");
    }
  }, [user, router]);

  function toggleCategory(name: string) {
    setSelectedCategories((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pledgeAccepted) {
      setError("Please accept the Academic & Originality Integrity Pledge.");
      return;
    }
    if (selectedCategories.length === 0) {
      setError("Select at least one writing category.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/creators-hub/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim(),
          headline: headline.trim(),
          bio: bio.trim(),
          writingCategories: selectedCategories,
          academicIntegrityAccepted: true,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error?.message || "Could not save creator profile.");
      }
      await refresh();
      router.push("/creators-hub/assessment/live");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading Creator onboarding...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <Feather className="w-10 h-10 text-[#0f766e] mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold">
            Sign in to Join the Creators Hub
          </h1>
          <p className="text-sm text-stone-600">
            Joining adds Creator permissions to your existing Tovolana account —
            no separate login required.
          </p>
          <Link
            href="/auth?next=/creators-hub/onboarding"
            className="inline-flex px-5 py-2.5 rounded-lg bg-[#0f766e] text-white text-sm font-semibold"
          >
            Sign In / Create Account
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="editorial-card p-5 bg-teal-50/60 border-teal-200 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#0f766e] shrink-0 mt-0.5" />
        <div className="text-xs text-teal-950 space-y-1">
          <p className="font-semibold text-sm">
            Capability-First Vetting (No Certificate or National ID Gatekeeping)
          </p>
          <p>
            You do <strong>not</strong> need to upload academic certificates or
            identity scans to join. Complete your public writer profile below,
            accept the originality pledge, and immediately prove your craft in
            our automated 6-criteria writing assessment.
          </p>
        </div>
      </div>

      <div className="editorial-card p-6 sm:p-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0f766e]">
            <Sparkles className="w-4 h-4" />
            <span>STEP 1 OF 2 · CREATOR PROFILE SETUP</span>
          </div>
          <h1 className="text-3xl font-editorial font-semibold mt-1">
            Set Up Your Writer Profile
          </h1>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Creator Handle (URL username)
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. wanjiku_writes"
                className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm font-tech"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Public Display Name
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Specialist Headline
            </label>
            <input
              type="text"
              required
              minLength={6}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Policy Research Analyst & Business Proposal Specialist"
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Professional Bio & Writing Approach
            </label>
            <textarea
              required
              minLength={20}
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Describe your research methodology, domain strengths, referencing standards, and commitment to clear communication..."
              className="w-full rounded-lg border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Writing Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {(categories.length > 0
                ? categories.map((c) => c.name)
                : [
                    "Academic Writing",
                    "Essays and Assignments",
                    "Research Papers",
                    "Articles and Blog Writing",
                    "Business Writing and Proposals",
                    "Editing and Proofreading",
                  ]
              ).map((name) => {
                const active = selectedCategories.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleCategory(name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? "bg-[#0f766e] text-white border-[#0f766e]"
                        : "bg-white text-stone-700 border-[#e6e0d4] hover:bg-stone-50"
                    }`}
                  >
                    {active && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-start gap-3 p-4 rounded-xl border border-[#e6e0d4] bg-[#faf7f2] cursor-pointer text-xs text-stone-700">
            <input
              type="checkbox"
              checked={pledgeAccepted}
              onChange={(e) => setPledgeAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <strong>Originality & Integrity Pledge:</strong> I pledge to submit
              original human-authored work written specifically for the prompt
              without undisclosed plagiarism, fabricated citations, or hidden
              subcontracting.
            </span>
          </label>

          <div className="flex items-center justify-between pt-2">
            <Link
              href="/creators-hub/status"
              className="text-xs text-stone-600 hover:underline"
            >
              Check existing application status →
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#0f766e] text-white text-sm font-semibold hover:bg-teal-900 disabled:opacity-50"
            >
              {submitting
                ? "Saving Profile..."
                : "Save Profile & Launch Live Assessment"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

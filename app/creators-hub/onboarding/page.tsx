"use client";

import { FlowSteps } from "@/components/ui/FlowGuide";
import {
  AuroraHeading,
  HudCard,
  RadarAvatar,
} from "@/components/ui/AuroraPrimitives";

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
      setError("Please check the Original Work Promise box first.");
      return;
    }
    if (selectedCategories.length === 0) {
      setError("Pick at least one topic you write about.");
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
        throw new Error(
          j.error?.message || "Could not save your writer profile."
        );
      }
      await refresh();
      router.push("/creators-hub/assessment/live");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save your profile."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading writer sign-up...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <HudCard theme="cyan" brackets className="p-8 text-center space-y-4">
          <Feather className="w-10 h-10 text-teal-300 mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Sign in to Apply as a Writer
          </h1>
          <p className="text-sm text-slate-300">
            Use your normal Tovolana account to apply — no extra account needed.
          </p>
          <Link
            href="/auth?next=/creators-hub/onboarding"
            className="btn-creator inline-flex px-5 py-2.5 text-sm font-semibold"
          >
            Sign In / Create Account
          </Link>
        </HudCard>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-reveal">
      <FlowSteps
        accent="teal"
        currentStep={1}
        goalLabel="Goal: Pass the short writing test and start earning"
        steps={[
          { label: "1. Writer profile", hint: "Tell clients what you write" },
          {
            label: "2. 45-min writing test",
            hint: "No IDs or certificates needed",
          },
          {
            label: "3. Approved & earn",
            hint: "Post services & get M-Pesa pay",
          },
        ]}
      />

      <div className="editorial-card p-5 bg-teal-500/[0.09] border-teal-400/35 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/40 text-teal-300 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-xs text-teal-100">
            <p className="font-semibold text-sm text-white">
              Simple Application — No ID Cards or Certificates Needed
            </p>
            <p className="text-teal-200/90 mt-0.5">
              Fill in your writer profile, check the promise below, and take the
              short writing test to unlock your Writer Hub.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <HudCard
          theme="cyan"
          brackets
          dotMatrix="left"
          microLabel="STEP 1 OF 3 · WRITER PROFILE"
          className="lg:col-span-3 p-6 sm:p-8 space-y-6"
        >
          <div>
            <div className="flex items-center gap-2 text-xs font-tech uppercase tracking-wider font-semibold text-teal-300">
              <Sparkles className="w-4 h-4" />
              <span>Step 1 of 3 · Your Writer Profile</span>
            </div>
            <AuroraHeading
              as="h1"
              className="text-3xl font-semibold mt-1"
            >
              Set Up Your Writer Profile
            </AuroraHeading>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="wanjiku_writes"
                  className="hud-input font-tech"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                  Public Name
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="hud-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                Short Headline
              </label>
              <input
                type="text"
                required
                minLength={6}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Research Writer & Business Plan Specialist"
                className="hud-input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                About Your Writing
              </label>
              <textarea
                required
                minLength={20}
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell clients what you are great at writing, your style, and topics you know best..."
                className="hud-input"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Categories You Write
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
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        active
                          ? "bg-teal-400/20 text-teal-100 border-teal-400/60 shadow-[0_0_16px_rgba(45,212,191,0.22)]"
                          : "bg-white/[0.05] text-slate-300 border-white/[0.12] hover:bg-white/[0.09] hover:text-white"
                      }`}
                    >
                      {active && (
                        <CheckCircle2 className="w-3 h-3 inline mr-1 text-teal-300" />
                      )}
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.12] bg-white/[0.04] cursor-pointer text-xs text-slate-300 hover:bg-white/[0.06] transition-colors">
              <input
                type="checkbox"
                checked={pledgeAccepted}
                onChange={(e) => setPledgeAccepted(e.target.checked)}
                className="mt-0.5 accent-teal-400"
              />
              <span>
                <strong className="text-white">Original Work Promise:</strong>{" "}
                Everything I write is original, written by me, and never copied
                or made up.
              </span>
            </label>

            <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
              <Link
                href="/creators-hub/status"
                className="text-xs font-semibold text-teal-300 hover:text-teal-200 hover:underline"
              >
                Already took the test? Check status →
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="btn-creator px-6 py-2.5 text-sm gap-2 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Next: Start Writing Test"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </HudCard>

        {/* Live Writer Profile Card Preview */}
        <aside className="lg:col-span-2 sticky top-24">
          <HudCard theme="violet" brackets className="p-6 space-y-5">
            <div className="flex items-center justify-between text-[11px] font-tech uppercase text-slate-400">
              <span>Profile Preview</span>
              <span className="text-teal-300 font-semibold">
                How Clients See You
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.045] border border-white/[0.11] space-y-4">
              <div className="flex items-center gap-3.5">
                <RadarAvatar
                  name={displayName || "Your Name"}
                  available
                  theme="cyan"
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="font-editorial text-xl font-semibold text-white truncate">
                    {displayName || "Your Name"}
                  </p>
                  <p className="font-tech text-xs text-slate-400 truncate">
                    @{username || "your_username"}
                  </p>
                </div>
              </div>

              <p className="text-sm font-medium text-white">
                {headline || "Your short headline shows here"}
              </p>

              <p className="text-xs text-slate-300 line-clamp-4">
                {bio ||
                  "Write a few sentences about your skills so clients feel confident choosing you."}
              </p>

              {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedCategories.map((cat) => (
                    <span
                      key={cat}
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/15 border border-teal-400/35 text-teal-200"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </HudCard>
        </aside>
      </div>
    </main>
  );
}

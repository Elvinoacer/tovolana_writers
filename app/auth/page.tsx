"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Crown, KeyRound, Mail, Shield, Sparkles, UserCheck } from "lucide-react";
import { useAuth } from "@/components/AuthContext";

function AuthFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl =
    searchParams.get("callbackUrl") || searchParams.get("next") || "/dashboard";
  const urlError = searchParams.get("error");

  const { refresh } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(urlError || "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { email, password }
          : { email, password, name, phone: phone || undefined };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message || "Authentication failed.");
        return;
      }
      await refresh();
      router.push(callbackUrl);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function loginAsDemo(demoEmail: string, target: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: demoEmail, password: "Password123!" }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error?.message || "Demo sign-in failed.");
        return;
      }
      await refresh();
      router.push(callbackUrl !== "/dashboard" ? callbackUrl : target);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-7 editorial-card p-6 sm:p-8 bg-white space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-tech uppercase tracking-wider text-[#1e3a8a]">
            Authentication &amp; Identity (Screen 2.1)
          </p>
          <h1 className="font-editorial text-2xl sm:text-3xl font-semibold">
            {mode === "login"
              ? "Sign in to Tovolana Writers"
              : "Create your Tovolana account"}
          </h1>
          <p className="text-sm text-stone-600">
            One account unlocks Customer bookings, Pro membership, and Creators
            Hub publishing.
          </p>
        </div>

        {callbackUrl !== "/dashboard" && (
          <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#1e3a8a] shrink-0" />
            <span>
              After authentication, you will return directly to:{" "}
              <strong className="font-tech">{callbackUrl}</strong>
            </span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* Google OAuth Button */}
        <a
          href={`/api/auth/google?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="w-full py-3 px-4 rounded-xl border border-[#e6e0d4] bg-[#faf7f2] hover:bg-stone-100 transition-colors flex items-center justify-center gap-2.5 text-sm font-semibold text-[#111827]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="w-4 h-4 shrink-0"
          >
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.3 0 6.08-1.09 8.11-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.23 1.18-3.26 0-6.02-2.2-7-5.16H1.01v3.14C3.03 21.17 7.19 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5 14.01c-.25-.74-.39-1.54-.39-2.36 0-.82.14-1.62.39-2.36V6.15H1.01A11.98 11.98 0 0 0 0 11.65c0 1.93.46 3.76 1.01 5.5L5 14.01Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.79 0 3.4.62 4.67 1.83l3.5-3.5C18.07 1.19 15.3 0 12 0 7.19 0 3.03 2.83 1.01 6.85L5 9.99c.98-2.96 3.74-5.24 7-5.24Z"
            />
          </svg>
          Continue with Google
        </a>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-[#e6e0d4]" />
          <span className="flex-shrink mx-4 text-xs text-stone-400 uppercase font-tech">
            or use email &amp; password
          </span>
          <div className="flex-grow border-t border-[#e6e0d4]" />
        </div>

        <div className="grid grid-cols-2 gap-2 bg-[#f2ede3] p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`py-2 rounded-md text-xs font-semibold transition-colors ${
              mode === "login"
                ? "bg-white text-[#111827] shadow-sm"
                : "text-stone-600"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`py-2 rounded-md text-xs font-semibold transition-colors ${
              mode === "register"
                ? "bg-white text-[#111827] shadow-sm"
                : "text-stone-600"
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Amina Wanjiku"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#e6e0d4] bg-[#faf7f2] focus:outline-none focus:border-[#1e3a8a]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Kenyan Phone (Optional, for M-Pesa &amp; OTP)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712345678 or 254712345678"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#e6e0d4] bg-[#faf7f2] font-tech"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-[#e6e0d4] bg-[#faf7f2] focus:outline-none focus:border-[#1e3a8a]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-[#e6e0d4] bg-[#faf7f2] focus:outline-none focus:border-[#1e3a8a]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#1e3a8a] text-white text-sm font-semibold hover:bg-[#172554] transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {loading
              ? "Authenticating..."
              : mode === "login"
                ? "Sign In with Email"
                : "Create Account & Continue"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-xs text-stone-500 text-center">
          Need to confirm your email or verify phone OTP?{" "}
          <Link href="/auth/verify" className="text-[#1e3a8a] hover:underline">
            Open Verification Center
          </Link>
        </p>
      </div>

      {/* Quick Seeded Demo Personas for Instant Verification */}
      <aside className="lg:col-span-5 editorial-card p-6 bg-[#faf7f2] space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <h2 className="font-editorial text-lg font-semibold">
            Seeded Persona Quick Sign-In
          </h2>
        </div>
        <p className="text-xs text-stone-600 leading-relaxed">
          Test any operational role against live PostgreSQL data (password{" "}
          <code className="font-tech bg-white px-1 py-0.5 rounded border">
            Password123!
          </code>
          ):
        </p>

        <div className="space-y-2">
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              loginAsDemo("free.customer@tovolana.com", "/dashboard")
            }
            className="w-full p-3 rounded-xl bg-white border border-[#e6e0d4] hover:border-[#1e3a8a] text-left transition-colors flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-semibold">Brian Kiprop — Free Customer</p>
              <p className="text-[11px] text-stone-500 font-tech">
                free.customer@tovolana.com
              </p>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-stone-100">
              FREE
            </span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              loginAsDemo("pro.customer@tovolana.com", "/dashboard")
            }
            className="w-full p-3 rounded-xl bg-white border border-[#e6e0d4] hover:border-amber-500 text-left transition-colors flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-semibold">Grace Wambui — Pro Customer</p>
              <p className="text-[11px] text-stone-500 font-tech">
                pro.customer@tovolana.com
              </p>
            </div>
            <Crown className="w-4 h-4 text-amber-600" />
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => loginAsDemo("creator@tovolana.com", "/creators-hub")}
            className="w-full p-3 rounded-xl bg-white border border-[#e6e0d4] hover:border-teal-600 text-left transition-colors flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-semibold">Amara Njoroge — Vetted Creator</p>
              <p className="text-[11px] text-stone-500 font-tech">
                creator@tovolana.com
              </p>
            </div>
            <UserCheck className="w-4 h-4 text-teal-700" />
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              loginAsDemo("applicant@tovolana.com", "/creators-hub/onboarding")
            }
            className="w-full p-3 rounded-xl bg-white border border-[#e6e0d4] hover:border-[#1e3a8a] text-left transition-colors flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-semibold">
                Faith Chebet — Assessment Candidate
              </p>
              <p className="text-[11px] text-stone-500 font-tech">
                applicant@tovolana.com
              </p>
            </div>
            <span className="text-[11px] text-amber-700 font-medium">
              UNDER REVIEW
            </span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => loginAsDemo("admin@tovolana.com", "/admin")}
            className="w-full p-3 rounded-xl bg-amber-50 border border-amber-300 hover:bg-amber-100 text-left transition-colors flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-semibold text-amber-950">
                Wanjiku Omondi — Platform Administrator
              </p>
              <p className="text-[11px] text-amber-800 font-tech">
                admin@tovolana.com
              </p>
            </div>
            <Shield className="w-4 h-4 text-amber-800" />
          </button>
        </div>
      </aside>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto p-12 text-center text-sm text-stone-500">
          Loading authentication workspace...
        </div>
      }
    >
      <AuthFormInner />
    </Suspense>
  );
}

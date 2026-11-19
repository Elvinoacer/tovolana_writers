"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  KeyRound,
  Mail,
  Shield,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { AuroraHeading, HudCard, RadarAvatar } from "@/components/ui/AuroraPrimitives";

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-reveal">
      {/* Left Auth HUD Card */}
      <HudCard theme="cyan" brackets className="lg:col-span-7 p-6 sm:p-8 space-y-6">
        <div className="space-y-1.5">
          <AuroraHeading as="h1" className="text-3xl sm:text-4xl">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </AuroraHeading>
          <p className="text-sm text-slate-300">
            Order writing help, save with Pro, or sign up as a writer with one
            account.
          </p>
        </div>

        {callbackUrl !== "/dashboard" && (
          <div className="p-3.5 rounded-xl bg-sky-500/[0.12] border border-sky-400/35 text-xs text-sky-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-300 shrink-0" />
            <span>
              Sign in and we&apos;ll take you right back where you left off.
            </span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/[0.12] border border-rose-400/35 text-xs text-rose-200">
            {error}
          </div>
        )}

        <a
          href={`/api/auth/google?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="btn-ghost w-full py-3 px-4 text-sm"
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
          <div className="flex-grow border-t border-white/[0.12]" />
          <span className="flex-shrink mx-4 text-[11px] text-slate-400 uppercase font-tech">
            or email &amp; password
          </span>
          <div className="flex-grow border-t border-white/[0.12]" />
        </div>

        <div className="grid grid-cols-2 gap-1.5 bg-[#060b14]/80 border border-white/[0.1] p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === "login"
                ? "bg-white/[0.14] text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === "register"
                ? "bg-white/[0.14] text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Amina Wanjiku"
                  className="hud-input w-full px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Phone number (for M-Pesa)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712345678"
                  className="hud-input w-full px-3.5 py-2.5 text-sm font-tech"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="hud-input w-full pl-10 pr-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="hud-input w-full pl-10 pr-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-sm disabled:opacity-60"
          >
            <span>
              {loading
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-1 text-center">
          <Link
            href="/auth/verify"
            className="text-xs font-medium text-sky-300 hover:underline"
          >
            Confirm your email or phone number
          </Link>
        </div>
      </HudCard>

      {/* Try a Demo Account */}
      <aside className="lg:col-span-5 space-y-5">
        <div className="editorial-card overflow-hidden p-2">
          <Image
            src="/images/auth-editorial.svg"
            alt="Tovolana account roles overview"
            width={560}
            height={440}
            priority
            className="w-full h-auto rounded-xl opacity-90"
          />
        </div>

        <HudCard theme="violet" brackets className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Try a Demo Account
            </span>
            <code className="font-tech text-[11px] bg-white/[0.08] text-cyan-200 px-2 py-0.5 rounded border border-white/[0.14]">
              Password123!
            </code>
          </div>
          <p className="text-[11px] text-slate-300">
            Click any role below to sign in right away and explore the site.
          </p>

          <div className="space-y-2">
            {[
              {
                email: "free.customer@tovolana.com",
                target: "/dashboard",
                name: "Brian Kiprop",
                role: "Client · Free Plan",
                theme: "sky" as const,
                badge: (
                  <span className="text-[10px] font-tech px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-300 border border-white/[0.14]">
                    FREE
                  </span>
                ),
              },
              {
                email: "pro.customer@tovolana.com",
                target: "/dashboard",
                name: "Grace Wambui",
                role: "Client · Pro Plan",
                theme: "amber" as const,
                badge: <Crown className="w-4 h-4 text-amber-300" />,
              },
              {
                email: "creator@tovolana.com",
                target: "/creators-hub",
                name: "Amara Njoroge",
                role: "Approved Writer",
                theme: "cyan" as const,
                badge: <UserCheck className="w-4 h-4 text-teal-300" />,
              },
              {
                email: "applicant@tovolana.com",
                target: "/creators-hub/onboarding",
                name: "Faith Chebet",
                role: "New Writer Applicant",
                theme: "emerald" as const,
                badge: (
                  <span className="text-[10px] font-tech text-amber-300 font-semibold">
                    APPLICANT
                  </span>
                ),
              },
              {
                email: "admin@tovolana.com",
                target: "/admin",
                name: "Wanjiku Omondi",
                role: "Admin",
                theme: "violet" as const,
                badge: <Shield className="w-4 h-4 text-violet-300" />,
              },
            ].map((p) => (
              <button
                key={p.email}
                type="button"
                disabled={loading}
                onClick={() => loginAsDemo(p.email, p.target)}
                className="w-full p-2.5 rounded-xl bg-white/[0.045] border border-white/[0.12] hover:border-cyan-400/50 hover:bg-white/[0.08] text-left transition-all flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <RadarAvatar name={p.name} theme={p.theme} size="sm" />
                  <span className="min-w-0">
                    <span className="text-xs font-semibold text-white block truncate">
                      {p.name}
                    </span>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {p.role}
                    </span>
                  </span>
                </span>
                {p.badge}
              </button>
            ))}
          </div>
        </HudCard>
      </aside>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto p-12 text-center text-sm text-slate-400">
          Loading studio...
        </div>
      }
    >
      <AuthFormInner />
    </Suspense>
  );
}

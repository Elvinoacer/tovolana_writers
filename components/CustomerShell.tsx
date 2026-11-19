"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Crown,
  Gavel,
  LayoutDashboard,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { ProBadge } from "@/components/ui/Badges";
import { RadarAvatar } from "@/components/ui/AuroraPrimitives";

const CUSTOMER_TABS = [
  { href: "/dashboard", label: "My Orders", icon: LayoutDashboard },
  { href: "/bidding", label: "Post a Job", icon: Gavel },
  { href: "/dashboard/membership", label: "Pro Plan", icon: Crown },
  { href: "/dashboard/settings", label: "Account & Alerts", icon: Settings },
  { href: "/explore", label: "Find Writers", icon: Compass },
];

export function CustomerShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading your orders...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <ShieldCheck className="w-10 h-10 text-sky-400 mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Sign in to see your orders
          </h1>
          <div className="flex justify-center gap-3">
            <Link
              href={`/auth?callbackUrl=${encodeURIComponent(pathname || "/dashboard")}`}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              Sign In
            </Link>
            <Link href="/explore" className="btn-ghost px-5 py-2.5 text-sm">
              Find Writers
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isPro =
    user.membershipTier === "PRO" &&
    (!user.proExpiresAt || new Date(user.proExpiresAt) > new Date());

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-reveal">
      <div className="editorial-card p-5 sm:p-6 ink-grid-bg flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-sky-400/20">
        <div className="flex items-center gap-4">
          <RadarAvatar
            name={user.name}
            avatarUrl={user.avatarUrl}
            theme="sky"
            size="lg"
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-tech uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/35 font-semibold">
                Client Account
              </span>
              {isPro ? (
                <ProBadge label="PRO ACTIVE" />
              ) : (
                <span className="text-[11px] font-tech px-2.5 py-0.5 rounded-full bg-white/[0.06] text-slate-300 border border-white/[0.14]">
                  FREE PLAN
                </span>
              )}
            </div>
            <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-white mt-1">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <nav className="flex flex-wrap gap-1.5">
          {CUSTOMER_TABS.map((tab) => {
            const Icon = tab.icon;
            const active =
              pathname === tab.href ||
              (tab.href === "/dashboard" &&
                pathname?.startsWith("/dashboard/bookings"));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  active
                    ? "bg-sky-500/25 text-sky-100 border-sky-400/55 shadow-[0_0_14px_rgba(56,189,248,0.22)]"
                    : "bg-white/[0.045] border-white/[0.11] text-slate-300 hover:bg-white/[0.1] hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </main>
  );
}

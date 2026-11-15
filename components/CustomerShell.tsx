"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Crown,
  LayoutDashboard,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { ProBadge } from "@/components/ui/Badges";
import { CreatorAvatar } from "@/components/ui/EditorialVisuals";

const CUSTOMER_TABS = [
  { href: "/dashboard", label: "My Bookings", icon: LayoutDashboard },
  { href: "/dashboard/membership", label: "Membership", icon: Crown },
  { href: "/dashboard/settings", label: "Security & Alerts", icon: Settings },
  { href: "/explore", label: "Browse Services", icon: Compass },
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
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading Customer Studio...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <ShieldCheck className="w-10 h-10 text-[#1e3a8a] mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold">
            Sign in to access your Customer Workspace
          </h1>
          <div className="flex justify-center gap-3">
            <Link
              href={`/auth?callbackUrl=${encodeURIComponent(pathname || "/dashboard")}`}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              Sign In
            </Link>
            <Link href="/explore" className="btn-ghost px-5 py-2.5 text-sm">
              Explore Services
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
      <div className="editorial-card p-5 sm:p-6 bg-white ink-grid-bg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <CreatorAvatar
            name={user.name}
            avatarUrl={user.avatarUrl}
            size="lg"
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-tech uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-[#1e3a8a] border border-blue-200 font-semibold">
                Customer Studio
              </span>
              {isPro ? (
                <ProBadge label="PRO ACTIVE" />
              ) : (
                <span className="text-[11px] font-tech px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                  FREE PLAN
                </span>
              )}
            </div>
            <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#111827] mt-1">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
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
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  active
                    ? "bg-[#1e3a8a] text-white shadow-xs"
                    : "bg-white border border-[#e6e0d4] text-stone-700 hover:bg-stone-50"
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

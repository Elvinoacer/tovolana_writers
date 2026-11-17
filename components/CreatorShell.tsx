"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  Briefcase,
  Feather,
  FilePlus2,
  Gavel,
  ListChecks,
  UserCheck,
  Wallet,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { StatusPill } from "@/components/ui/Badges";
import { CreatorAvatar } from "@/components/ui/EditorialVisuals";

const CREATOR_TABS = [
  { href: "/creators-hub", label: "Studio Overview", icon: Briefcase },
  { href: "/bidding", label: "Live Bidding", icon: Gavel },
  { href: "/creators-hub/connects", label: "Connects & Boosts", icon: Zap },
  { href: "/creators-hub/listings/new", label: "New Listing", icon: FilePlus2 },
  { href: "/creators-hub/listings", label: "My Listings", icon: ListChecks },
  { href: "/creators-hub/earnings", label: "Earnings & M-Pesa", icon: Wallet },
  { href: "/creators-hub/profile", label: "Public Profile", icon: UserCheck },
  { href: "/creators-hub/status", label: "Vetting Status", icon: Award },
];

export function CreatorShell({
  title,
  subtitle,
  requireApproved = true,
  children,
}: {
  title: string;
  subtitle?: string;
  requireApproved?: boolean;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading Creators Studio...
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
            Sign in to open Creators Hub
          </h1>
          <Link
            href={`/auth?callbackUrl=${encodeURIComponent(pathname || "/creators-hub")}`}
            className="btn-creator px-5 py-2.5 text-sm"
          >
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  if (requireApproved && !user.roles.includes("CREATOR") && !user.roles.includes("ADMIN")) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <Feather className="w-10 h-10 text-[#0f766e] mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold">
            {user.creatorProfile
              ? "Pass the 6-Criteria Assessment to Unlock"
              : "Join the Creators Hub"}
          </h1>
          <p className="text-sm text-stone-600">
            Zero ID cards or academic certificate barriers — qualify purely on
            writing craft.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href={
                user.creatorProfile
                  ? "/creators-hub/status"
                  : "/creators-hub/onboarding"
              }
              className="btn-creator px-5 py-2.5 text-sm"
            >
              {user.creatorProfile ? "Check Assessment Status" : "Start Onboarding"}
            </Link>
            <Link href="/creators-hub/join" className="btn-ghost px-5 py-2.5 text-sm">
              How It Works
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-reveal">
      <div className="editorial-card p-5 sm:p-6 bg-white ink-grid-bg flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <CreatorAvatar
              name={user.creatorProfile?.displayName || user.name}
              username={user.creatorProfile?.username}
              avatarUrl={user.avatarUrl}
              available={user.creatorProfile?.applicationStatus === "APPROVED"}
              size="lg"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-tech uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 text-[#0f766e] border border-teal-200 font-semibold">
                  Creators Hub Studio
                </span>
                {user.creatorProfile && (
                  <>
                    <StatusPill status={user.creatorProfile.applicationStatus} />
                    <Link
                      href="/creators-hub/connects"
                      className="inline-flex items-center gap-1 text-[11px] font-tech font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors"
                    >
                      <Zap className="w-3 h-3 text-amber-600" />
                      {user.creatorProfile.connectsBalance ?? 0} Connects
                    </Link>
                  </>
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
            {CREATOR_TABS.map((tab) => {
              const Icon = tab.icon;
              const active =
                pathname === tab.href ||
                (tab.href === "/creators-hub" &&
                  pathname?.startsWith("/creators-hub/bookings"));
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    active
                      ? "bg-[#0f766e] text-white shadow-xs"
                      : "bg-white border border-[#e6e0d4] text-stone-700 hover:bg-teal-50/60"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {children}
    </main>
  );
}

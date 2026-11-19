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
import { RadarAvatar } from "@/components/ui/AuroraPrimitives";

const CREATOR_TABS = [
  { href: "/creators-hub", label: "Overview", icon: Briefcase },
  { href: "/bidding", label: "Open Jobs", icon: Gavel },
  { href: "/creators-hub/connects", label: "Credits & Boosts", icon: Zap },
  { href: "/creators-hub/listings/new", label: "Add Service", icon: FilePlus2 },
  { href: "/creators-hub/listings", label: "My Services", icon: ListChecks },
  { href: "/creators-hub/earnings", label: "Earnings", icon: Wallet },
  { href: "/creators-hub/profile", label: "My Profile", icon: UserCheck },
  { href: "/creators-hub/status", label: "Test Status", icon: Award },
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
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading Writer Hub...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <Feather className="w-10 h-10 text-teal-400 mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Sign in to open Writer Hub
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
          <Feather className="w-10 h-10 text-teal-400 mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold text-white">
            {user.creatorProfile
              ? "Pass a short writing test to start earning"
              : "Join as a Writer"}
          </h1>
          <p className="text-sm text-slate-300">
            No ID cards or degree papers needed — just show your writing skill.
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
              {user.creatorProfile ? "Check Test Status" : "Start Application"}
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
      <div className="editorial-card p-5 sm:p-6 ink-grid-bg border-teal-400/25 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <RadarAvatar
              name={user.creatorProfile?.displayName || user.name}
              avatarUrl={user.avatarUrl}
              available={user.creatorProfile?.applicationStatus === "APPROVED"}
              theme="cyan"
              size="lg"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-tech uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-400/35 font-semibold">
                  Writer Hub
                </span>
                {user.creatorProfile && (
                  <>
                    <StatusPill status={user.creatorProfile.applicationStatus} />
                    <Link
                      href="/creators-hub/connects"
                      className="inline-flex items-center gap-1 text-[11px] font-tech font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/40 hover:bg-amber-500/25 transition-colors"
                    >
                      <Zap className="w-3 h-3 text-amber-300" />
                      {user.creatorProfile.connectsBalance ?? 0} Credits
                    </Link>
                  </>
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    active
                      ? "bg-teal-500/25 text-teal-100 border-teal-400/60 shadow-[0_0_14px_rgba(45,212,191,0.22)]"
                      : "bg-white/[0.045] border-white/[0.11] text-slate-300 hover:bg-teal-500/15 hover:text-white"
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

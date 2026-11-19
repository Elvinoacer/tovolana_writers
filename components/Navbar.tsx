"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpenCheck,
  ChevronDown,
  Crown,
  Feather,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { ProBadge } from "@/components/ui/Badges";
import { CreatorAvatar } from "@/components/ui/EditorialVisuals";

export function Navbar() {
  const { user, unreadNotifications, refresh, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<
    Array<{
      id: string;
      title: string;
      body: string;
      linkUrl: string | null;
      readAt: string | null;
      createdAt: string;
    }>
  >([]);
  const [switching, setSwitching] = useState(false);

  const isCreator = Boolean(
    user?.roles.includes("CREATOR") || user?.creatorProfile
  );
  const isAdmin = Boolean(user?.roles.includes("ADMIN"));

  async function toggleNotifications() {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next && user) {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setNotifs(json.data?.notifications ?? []);
      }
    }
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    setNotifs((prev) =>
      prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
    );
    await refresh();
  }

  async function quickSwitchDemo(email: string, redirectTo: string) {
    setSwitching(true);
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "Password123!" }),
      });
      await refresh();
      setMobileOpen(false);
      router.push(redirectTo);
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  const navLinkClass = (prefix: string) => {
    const active =
      pathname === prefix ||
      (prefix !== "/" && pathname?.startsWith(prefix));
    return `px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-medium transition-all whitespace-nowrap ${
      active
        ? "bg-white/[0.14] text-white shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
        : "text-slate-300 hover:text-white hover:bg-white/[0.06]"
    }`;
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] glass-surface">
      <span
        aria-hidden="true"
        className="aurora-horizon-line pointer-events-none absolute inset-x-0 bottom-0 h-[1px] opacity-75"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[#1e295d] to-[#2e3fa3] border border-sky-400/35 text-white flex items-center justify-center shadow-[0_0_18px_rgba(56,189,248,0.28)] group-hover:scale-105 transition-transform">
              <span
                aria-hidden="true"
                className="animate-pulse pointer-events-none absolute -inset-1 -z-10 rounded-xl bg-cyan-400/20 blur-md"
              />
              <Feather className="w-4.5 h-4.5" />
            </span>
            <div>
              <span className="font-editorial text-lg font-semibold tracking-tight text-white block leading-none">
                Tovolana
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-tech block mt-0.5">
                Simple Writing Help
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 bg-white/[0.04] border border-white/[0.09] rounded-full p-1 backdrop-blur-md">
            <Link href="/explore" className={navLinkClass("/explore")}>
              Find Writers
            </Link>
            <Link href="/bidding" className={navLinkClass("/bidding")}>
              Post a Job
            </Link>
            <Link href="/membership" className={navLinkClass("/membership")}>
              Pricing
            </Link>
            <Link
              href="/creators-hub/join"
              className={navLinkClass("/creators-hub/join")}
            >
              Write &amp; Earn
            </Link>
            <Link href="/policies" className={navLinkClass("/policies")}>
              How It Works
            </Link>
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-2.5">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  pathname?.startsWith("/dashboard")
                    ? "bg-sky-500/20 text-sky-200 border-sky-400/55 shadow-[0_0_14px_rgba(56,189,248,0.22)]"
                    : "bg-white/[0.05] text-slate-200 border-white/[0.12] hover:bg-white/[0.1]"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>My Orders</span>
              </Link>

              <Link
                href={isCreator ? "/creators-hub" : "/creators-hub/onboarding"}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  pathname?.startsWith("/creators-hub") &&
                  pathname !== "/creators-hub/join"
                    ? "bg-teal-500/25 text-teal-100 border-teal-400/65 shadow-[0_0_16px_rgba(45,212,191,0.3)]"
                    : "bg-teal-400/[0.08] text-teal-300 border-teal-400/45 shadow-[0_0_14px_rgba(45,212,191,0.14)] hover:bg-teal-400/[0.16]"
                }`}
              >
                <BookOpenCheck className="w-3.5 h-3.5" />
                <span>Writer Hub</span>
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    pathname?.startsWith("/admin")
                      ? "bg-amber-500/25 text-amber-200 border-amber-400/60"
                      : "bg-amber-400/[0.1] text-amber-300 border-amber-400/40 hover:bg-amber-400/[0.18]"
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </Link>
              )}

              <div className="relative">
                <button
                  onClick={toggleNotifications}
                  className="relative p-2 rounded-full border border-white/[0.11] bg-white/[0.04] hover:bg-white/[0.1] transition-colors text-slate-200"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotifications > 0 && (
                    <>
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 animate-pulse-ring" />
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(244,63,94,0.8)]">
                        {unreadNotifications}
                      </span>
                    </>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#09101e]/95 border border-white/[0.14] backdrop-blur-xl p-3 shadow-2xl z-50 animate-reveal">
                    <div className="flex items-center justify-between pb-2 border-b border-white/[0.09]">
                      <span className="text-xs font-semibold uppercase tracking-wider font-tech text-slate-300">
                        Updates
                      </span>
                      <button
                        onClick={markAllRead}
                        className="text-xs font-medium text-cyan-300 hover:underline"
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.06] mt-1">
                      {notifs.length === 0 ? (
                        <p className="text-xs text-slate-400 py-6 text-center">
                          No new updates.
                        </p>
                      ) : (
                        notifs.map((n) => (
                          <Link
                            key={n.id}
                            href={n.linkUrl || "/dashboard"}
                            onClick={() => setNotifOpen(false)}
                            className={`block py-2.5 px-2.5 rounded-lg hover:bg-white/[0.06] transition-colors ${
                              !n.readAt ? "bg-sky-500/[0.09]" : ""
                            }`}
                          >
                            <p className="text-xs font-semibold text-white">
                              {n.title}
                            </p>
                            <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                              {n.body}
                            </p>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 pl-2.5 border-l border-white/[0.11]">
                <Link
                  href="/dashboard/settings"
                  className="flex items-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <CreatorAvatar
                    name={user.name}
                    avatarUrl={user.avatarUrl}
                    size="sm"
                  />
                  <div className="leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white">
                        {user.name.split(" ")[0]}
                      </span>
                      {user.membershipTier === "PRO" ? (
                        <ProBadge />
                      ) : (
                        <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-white/[0.09] border border-white/[0.14] text-slate-300 font-tech font-semibold">
                          FREE
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block max-w-[110px] truncate">
                      {user.email}
                    </span>
                  </div>
                </Link>
                <button
                  onClick={async () => {
                    await logout();
                    router.push("/");
                    router.refresh();
                  }}
                  title="Sign out"
                  aria-label="Sign out"
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative group">
                <button
                  disabled={switching}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.14] bg-white/[0.05] text-xs font-medium text-slate-200 hover:bg-white/[0.1] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Try Demo</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <div className="hidden group-hover:block absolute right-0 top-full pt-1.5 w-64 z-50">
                  <div className="rounded-2xl bg-[#09101e]/95 border border-white/[0.15] backdrop-blur-xl p-2 shadow-2xl space-y-1 text-xs">
                    <button
                      onClick={() =>
                        quickSwitchDemo("free.customer@tovolana.com", "/dashboard")
                      }
                      className="w-full text-left px-2.5 py-2 rounded-xl text-slate-200 hover:bg-white/[0.08] flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <CreatorAvatar name="Brian Mwangi" size="sm" />
                        <span>Brian · Client (Free)</span>
                      </span>
                      <span className="text-[10px] font-tech text-slate-400">FREE</span>
                    </button>
                    <button
                      onClick={() =>
                        quickSwitchDemo("pro.customer@tovolana.com", "/dashboard")
                      }
                      className="w-full text-left px-2.5 py-2 rounded-xl text-slate-200 hover:bg-amber-500/15 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <CreatorAvatar name="Grace Njeri" size="sm" />
                        <span>Grace · Client (Pro)</span>
                      </span>
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                    <button
                      onClick={() =>
                        quickSwitchDemo("creator@tovolana.com", "/creators-hub")
                      }
                      className="w-full text-left px-2.5 py-2 rounded-xl text-slate-200 hover:bg-teal-500/15 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <CreatorAvatar name="Amara Ochieng" size="sm" available />
                        <span>Amara · Writer</span>
                      </span>
                      <UserCheck className="w-3.5 h-3.5 text-teal-400" />
                    </button>
                    <button
                      onClick={() =>
                        quickSwitchDemo(
                          "applicant@tovolana.com",
                          "/creators-hub/onboarding"
                        )
                      }
                      className="w-full text-left px-2.5 py-2 rounded-xl text-slate-200 hover:bg-white/[0.08] flex items-center gap-2"
                    >
                      <CreatorAvatar name="Faith Wambui" size="sm" />
                      <span>Faith · Writer Applicant</span>
                    </button>
                    <button
                      onClick={() =>
                        quickSwitchDemo("admin@tovolana.com", "/admin")
                      }
                      className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-sky-500/15 text-sky-300 font-semibold flex items-center justify-between"
                    >
                      <span>Admin Panel</span>
                      <Shield className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <Link
                href="/auth"
                className="btn-primary px-4 py-2 text-xs sm:text-sm"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-xl border border-white/[0.14] bg-white/[0.05] text-white"
          aria-label="Toggle Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.1] bg-[#060b14]/95 backdrop-blur-xl px-4 py-4 space-y-2 animate-reveal">
          <Link
            href="/explore"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/[0.08]"
          >
            Find Writers
          </Link>
          <Link
            href="/bidding"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/[0.08]"
          >
            Post a Job
          </Link>
          <Link
            href="/membership"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/[0.08]"
          >
            Pricing
          </Link>
          <Link
            href="/creators-hub/join"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/[0.08]"
          >
            Write &amp; Earn
          </Link>
          <Link
            href="/policies"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/[0.08]"
          >
            How It Works
          </Link>
          <hr className="border-white/[0.1]" />
          {user ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-sky-300"
              >
                My Orders
              </Link>
              <Link
                href={isCreator ? "/creators-hub" : "/creators-hub/onboarding"}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-teal-300"
              >
                Writer Hub
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-amber-300"
                >
                  Admin Panel
                </Link>
              )}
              <button
                onClick={async () => {
                  await logout();
                  setMobileOpen(false);
                  router.push("/");
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-rose-300"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              onClick={() => setMobileOpen(false)}
              className="btn-primary w-full py-2.5 text-sm"
            >
              Sign In / Create Account
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

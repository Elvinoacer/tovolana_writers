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
    return `px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
      active
        ? "bg-[#111827] text-white shadow-xs"
        : "text-stone-700 hover:text-[#111827] hover:bg-stone-200/70"
    }`;
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#e6e0d4]/80 glass-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1e3a8a] to-[#172554] text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Feather className="w-4.5 h-4.5" />
            </span>
            <div>
              <span className="font-editorial text-lg font-semibold tracking-tight text-[#111827] block leading-none">
                Tovolana
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-stone-500 font-tech">
                Writers Studio
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 bg-white/75 border border-[#e6e0d4] rounded-full p-1">
            <Link href="/explore" className={navLinkClass("/explore")}>
              Explore
            </Link>
            <Link href="/membership" className={navLinkClass("/membership")}>
              Free &amp; Pro
            </Link>
            <Link
              href="/creators-hub/join"
              className={navLinkClass("/creators-hub/join")}
            >
              Creators
            </Link>
            <Link href="/policies" className={navLinkClass("/policies")}>
              Policies
            </Link>
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-2.5">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  pathname?.startsWith("/dashboard")
                    ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                    : "bg-white text-stone-800 border-[#e6e0d4] hover:bg-stone-100"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Customer</span>
              </Link>

              <Link
                href={isCreator ? "/creators-hub" : "/creators-hub/onboarding"}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  pathname?.startsWith("/creators-hub") &&
                  pathname !== "/creators-hub/join"
                    ? "bg-[#0f766e] text-white border-[#0f766e]"
                    : "bg-teal-50/90 text-teal-900 border-teal-200 hover:bg-teal-100"
                }`}
              >
                <BookOpenCheck className="w-3.5 h-3.5" />
                <span>Creators Hub</span>
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    pathname?.startsWith("/admin")
                      ? "bg-[#111827] text-white border-[#111827]"
                      : "bg-amber-50 text-amber-950 border-amber-200 hover:bg-amber-100"
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </Link>
              )}

              <div className="relative">
                <button
                  onClick={toggleNotifications}
                  className="relative p-2 rounded-xl border border-[#e6e0d4] bg-white hover:bg-stone-50 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4 text-stone-700" />
                  {unreadNotifications > 0 && (
                    <>
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 animate-pulse-ring" />
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {unreadNotifications}
                      </span>
                    </>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 editorial-card p-3 shadow-xl z-50 animate-reveal">
                    <div className="flex items-center justify-between pb-2 border-b border-[#e6e0d4]">
                      <span className="text-xs font-semibold uppercase tracking-wider font-tech text-stone-700">
                        Alerts &amp; Activity
                      </span>
                      <button
                        onClick={markAllRead}
                        className="text-xs font-medium text-[#1e3a8a] hover:underline"
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-stone-100 mt-1">
                      {notifs.length === 0 ? (
                        <p className="text-xs text-stone-500 py-6 text-center">
                          All caught up.
                        </p>
                      ) : (
                        notifs.map((n) => (
                          <Link
                            key={n.id}
                            href={n.linkUrl || "/dashboard"}
                            onClick={() => setNotifOpen(false)}
                            className={`block py-2.5 px-2.5 rounded-lg hover:bg-stone-50 transition-colors ${
                              !n.readAt ? "bg-blue-50/50" : ""
                            }`}
                          >
                            <p className="text-xs font-semibold text-stone-900">
                              {n.title}
                            </p>
                            <p className="text-[11px] text-stone-600 line-clamp-2 mt-0.5">
                              {n.body}
                            </p>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 pl-2.5 border-l border-[#e6e0d4]">
                <Link
                  href="/dashboard/settings"
                  className="flex items-center gap-2 hover:opacity-85 transition-opacity"
                >
                  <CreatorAvatar
                    name={user.name}
                    avatarUrl={user.avatarUrl}
                    size="sm"
                  />
                  <div className="leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-[#111827]">
                        {user.name.split(" ")[0]}
                      </span>
                      {user.membershipTier === "PRO" ? (
                        <ProBadge />
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200/80 text-stone-700 font-tech font-medium">
                          FREE
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-stone-500 block max-w-[110px] truncate">
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
                  className="p-2 rounded-xl text-stone-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e6e0d4] bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Quick Persona</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <div className="hidden group-hover:block absolute right-0 top-full pt-1.5 w-64 z-50">
                  <div className="editorial-card p-2 shadow-xl space-y-1 text-xs">
                    <button
                      onClick={() =>
                        quickSwitchDemo("free.customer@tovolana.com", "/dashboard")
                      }
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-stone-100 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <CreatorAvatar name="Brian Mwangi" size="sm" />
                        <span>Brian · Free Client</span>
                      </span>
                      <span className="text-[10px] font-tech text-stone-500">FREE</span>
                    </button>
                    <button
                      onClick={() =>
                        quickSwitchDemo("pro.customer@tovolana.com", "/dashboard")
                      }
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-amber-50 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <CreatorAvatar name="Grace Njeri" size="sm" />
                        <span>Grace · Pro Client</span>
                      </span>
                      <Crown className="w-3.5 h-3.5 text-amber-600" />
                    </button>
                    <button
                      onClick={() =>
                        quickSwitchDemo("creator@tovolana.com", "/creators-hub")
                      }
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-teal-50 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <CreatorAvatar name="Amara Ochieng" size="sm" available />
                        <span>Amara · Vetted Creator</span>
                      </span>
                      <UserCheck className="w-3.5 h-3.5 text-teal-700" />
                    </button>
                    <button
                      onClick={() =>
                        quickSwitchDemo(
                          "applicant@tovolana.com",
                          "/creators-hub/onboarding"
                        )
                      }
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-stone-100 flex items-center gap-2"
                    >
                      <CreatorAvatar name="Faith Wambui" size="sm" />
                      <span>Faith · Exam Applicant</span>
                    </button>
                    <button
                      onClick={() =>
                        quickSwitchDemo("admin@tovolana.com", "/admin")
                      }
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-blue-50 text-[#1e3a8a] font-semibold flex items-center justify-between"
                    >
                      <span>Admin Command Console</span>
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
          className="md:hidden p-2 rounded-xl border border-[#e6e0d4] bg-white"
          aria-label="Toggle Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[#e6e0d4] bg-[#faf7f2] px-4 py-4 space-y-2 animate-reveal">
          <Link
            href="/explore"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-200/60"
          >
            Explore Services
          </Link>
          <Link
            href="/membership"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-200/60"
          >
            Free &amp; Pro Plans
          </Link>
          <Link
            href="/creators-hub/join"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-200/60"
          >
            Become a Creator
          </Link>
          <Link
            href="/policies"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-200/60"
          >
            Policies
          </Link>
          <hr className="border-[#e6e0d4]" />
          {user ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-[#1e3a8a]"
              >
                Customer Workspace
              </Link>
              <Link
                href={isCreator ? "/creators-hub" : "/creators-hub/onboarding"}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-teal-800"
              >
                Creators Hub
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-amber-900"
                >
                  Admin Console
                </Link>
              )}
              <button
                onClick={async () => {
                  await logout();
                  setMobileOpen(false);
                  router.push("/");
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-rose-700"
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

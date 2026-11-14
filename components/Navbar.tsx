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
      router.push(redirectTo);
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  const navLinkClass = (prefix: string) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      pathname === prefix ||
      (prefix !== "/" && pathname?.startsWith(prefix))
        ? "bg-[#1e3a8a]/10 text-[#1e3a8a]"
        : "text-stone-700 hover:text-[#111827] hover:bg-stone-200/60"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-[#e6e0d4] bg-[#faf7f2]/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="w-9 h-9 rounded-lg bg-[#1e3a8a] text-white flex items-center justify-center shadow-sm group-hover:bg-[#172554] transition-colors">
              <Feather className="w-5 h-5" />
            </span>
            <div>
              <span className="font-editorial text-lg font-semibold tracking-tight text-[#111827] block leading-none">
                Tovolana Writers
              </span>
              <span className="text-[11px] uppercase tracking-widest text-stone-500 font-tech">
                Editorial Marketplace
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            <Link href="/explore" className={navLinkClass("/explore")}>
              Explore Tasks
            </Link>
            <Link href="/membership" className={navLinkClass("/membership")}>
              Free &amp; Pro
            </Link>
            <Link
              href="/creators-hub/join"
              className={navLinkClass("/creators-hub/join")}
            >
              Become a Creator
            </Link>
            <Link href="/policies" className={navLinkClass("/policies")}>
              Policies
            </Link>
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-stone-800 hover:bg-stone-200/60"
              >
                <LayoutDashboard className="w-4 h-4 text-[#1e3a8a]" />
                <span>Customer</span>
              </Link>

              <Link
                href={isCreator ? "/creators-hub" : "/creators-hub/onboarding"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-teal-900 bg-teal-50 border border-teal-200 hover:bg-teal-100"
              >
                <BookOpenCheck className="w-4 h-4 text-teal-700" />
                <span>Creators Hub</span>
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-amber-950 bg-amber-50 border border-amber-200 hover:bg-amber-100"
                >
                  <Shield className="w-4 h-4 text-amber-800" />
                  <span>Admin Console</span>
                </Link>
              )}

              <div className="relative">
                <button
                  onClick={toggleNotifications}
                  className="relative p-2 rounded-lg border border-[#e6e0d4] bg-white hover:bg-stone-50"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4 text-stone-700" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadNotifications}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 editorial-card p-3 shadow-xl z-50">
                    <div className="flex items-center justify-between pb-2 border-b border-[#e6e0d4]">
                      <span className="text-sm font-semibold">
                        Notifications
                      </span>
                      <button
                        onClick={markAllRead}
                        className="text-xs text-[#1e3a8a] hover:underline"
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-stone-100 mt-1">
                      {notifs.length === 0 ? (
                        <p className="text-xs text-stone-500 py-4 text-center">
                          No notifications yet.
                        </p>
                      ) : (
                        notifs.map((n) => (
                          <Link
                            key={n.id}
                            href={n.linkUrl || "/dashboard"}
                            onClick={() => setNotifOpen(false)}
                            className={`block py-2.5 px-2 rounded hover:bg-stone-50 ${
                              !n.readAt ? "bg-blue-50/40" : ""
                            }`}
                          >
                            <p className="text-xs font-semibold text-stone-900">
                              {n.title}
                            </p>
                            <p className="text-xs text-stone-600 line-clamp-2 mt-0.5">
                              {n.body}
                            </p>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pl-2 border-l border-[#e6e0d4]">
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-xs font-semibold text-[#111827]">
                      {user.name.split(" ")[0]}
                    </span>
                    {user.membershipTier === "PRO" ? (
                      <ProBadge />
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 font-medium">
                        FREE
                      </span>
                    )}
                  </div>
                  <Link
                    href="/dashboard/settings"
                    className="text-[11px] text-stone-500 hover:underline block"
                  >
                    {user.email}
                  </Link>
                </div>
                <button
                  onClick={async () => {
                    await logout();
                    router.push("/");
                    router.refresh();
                  }}
                  title="Sign out"
                  className="p-2 rounded-lg text-stone-600 hover:text-rose-700 hover:bg-rose-50"
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e6e0d4] bg-white text-xs font-medium text-stone-700 hover:bg-stone-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Demo Switch
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <div className="hidden group-hover:block absolute right-0 top-full pt-1 w-56 z-50">
                  <div className="editorial-card p-1.5 shadow-lg space-y-0.5 text-xs">
                    <button
                      onClick={() =>
                        quickSwitchDemo("free.customer@tovolana.com", "/dashboard")
                      }
                      className="w-full text-left px-2.5 py-2 rounded hover:bg-stone-100 flex items-center justify-between"
                    >
                      <span>Free Customer (Brian)</span>
                      <span className="text-stone-400">FREE</span>
                    </button>
                    <button
                      onClick={() =>
                        quickSwitchDemo("pro.customer@tovolana.com", "/dashboard")
                      }
                      className="w-full text-left px-2.5 py-2 rounded hover:bg-stone-100 flex items-center justify-between"
                    >
                      <span>Pro Customer (Grace)</span>
                      <Crown className="w-3.5 h-3.5 text-amber-600" />
                    </button>
                    <button
                      onClick={() =>
                        quickSwitchDemo("creator@tovolana.com", "/creators-hub")
                      }
                      className="w-full text-left px-2.5 py-2 rounded hover:bg-stone-100 flex items-center justify-between"
                    >
                      <span>Vetted Creator (Amara)</span>
                      <UserCheck className="w-3.5 h-3.5 text-teal-700" />
                    </button>
                    <button
                      onClick={() =>
                        quickSwitchDemo(
                          "applicant@tovolana.com",
                          "/creators-hub/onboarding"
                        )
                      }
                      className="w-full text-left px-2.5 py-2 rounded hover:bg-stone-100"
                    >
                      Applicant (Faith — Assessment)
                    </button>
                    <button
                      onClick={() =>
                        quickSwitchDemo("admin@tovolana.com", "/admin")
                      }
                      className="w-full text-left px-2.5 py-2 rounded hover:bg-amber-50 text-amber-900 font-medium flex items-center justify-between"
                    >
                      <span>Administrator Console</span>
                      <Shield className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <Link
                href="/auth"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#1e3a8a] text-white hover:bg-[#172554] transition-colors"
              >
                Sign In / Join
              </Link>
            </div>
          )}
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg border border-[#e6e0d4] bg-white"
          aria-label="Toggle Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[#e6e0d4] bg-[#faf7f2] px-4 py-4 space-y-2">
          <Link
            href="/explore"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-stone-200/60"
          >
            Explore Services
          </Link>
          <Link
            href="/membership"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-stone-200/60"
          >
            Free &amp; Pro Membership
          </Link>
          <Link
            href="/creators-hub/join"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-stone-200/60"
          >
            Become a Creator
          </Link>
          <Link
            href="/policies"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-stone-200/60"
          >
            Platform Policies
          </Link>
          <hr className="border-[#e6e0d4]" />
          {user ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-[#1e3a8a]"
              >
                Customer Dashboard
              </Link>
              <Link
                href={isCreator ? "/creators-hub" : "/creators-hub/onboarding"}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-teal-800"
              >
                Creators Hub
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-amber-900"
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
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-rose-700"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              onClick={() => setMobileOpen(false)}
              className="block text-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#1e3a8a] text-white"
            >
              Sign In / Create Account
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

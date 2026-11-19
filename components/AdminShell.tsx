"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  BarChart3,
  CheckSquare,
  FolderTree,
  LayoutDashboard,
  Scale,
  Settings,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { formatAdminScope } from "@/components/ui/Badges";

const ADMIN_TABS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  {
    href: "/admin/listings/moderation",
    label: "Approvals",
    icon: CheckSquare,
  },
  { href: "/admin/listings/vault", label: "Closed Services", icon: Archive },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/creators/vetting", label: "Writer Tests", icon: Shield },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/bookings", label: "Orders & Help", icon: Scale },
  { href: "/admin/finance", label: "Payments", icon: Wallet },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
];

export function AdminShell({
  title,
  subtitle,
  requiredScope,
  children,
}: {
  title: string;
  subtitle: string;
  requiredScope?: "MODERATION_ADMIN" | "FINANCE_ADMIN" | "SUPPORT_ADMIN" | "SUPER_ADMIN";
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="editorial-card p-8 animate-pulse text-sm text-slate-400">
          Loading Admin Panel...
        </div>
      </main>
    );
  }

  if (!user || !user.roles.includes("ADMIN")) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <Shield className="w-10 h-10 text-rose-400 mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold text-white">
            Admin Sign-In Required
          </h1>
          <p className="text-sm text-slate-300">
            Please sign in with an Admin account to open this page.
          </p>
          <Link
            href="/auth?callbackUrl=/admin"
            className="btn-primary px-5 py-2.5 text-sm"
          >
            Sign In as Admin
          </Link>
        </div>
      </main>
    );
  }

  const scopes = user.adminScopes || [];
  const hasScope =
    !requiredScope ||
    scopes.includes("SUPER_ADMIN") ||
    scopes.includes(requiredScope);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-reveal">
      <div className="editorial-card p-5 sm:p-6 ink-grid-bg border-violet-400/25 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-tech uppercase px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-200 border border-violet-400/40 font-semibold">
                Admin Panel
              </span>
              {scopes.map((s) => (
                <span
                  key={s}
                  className="text-[10px] font-tech px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/35 font-semibold"
                >
                  {formatAdminScope(s)}
                </span>
              ))}
            </div>
            <h1 className="text-2xl sm:text-3xl font-editorial font-semibold mt-1.5 text-white">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">{subtitle}</p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-1.5 pt-3 border-t border-white/[0.1]">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
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

      {!hasScope ? (
        <div className="editorial-card p-6 border-rose-400/35 bg-rose-500/[0.12] text-rose-200 text-sm">
          You need <strong>{formatAdminScope(requiredScope)}</strong> access to view this page.
        </div>
      ) : (
        children
      )}
    </main>
  );
}

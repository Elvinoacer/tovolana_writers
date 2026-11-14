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

const ADMIN_TABS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  {
    href: "/admin/listings/moderation",
    label: "Listing Moderation",
    icon: CheckSquare,
  },
  { href: "/admin/listings/vault", label: "Archive & Expiry Vault", icon: Archive },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/creators/vetting", label: "Creator Vetting", icon: Shield },
  { href: "/admin/users", label: "Users & RBAC", icon: Users },
  { href: "/admin/bookings", label: "Bookings & Disputes", icon: Scale },
  { href: "/admin/finance", label: "Finance & Escrow", icon: Wallet },
  { href: "/admin/settings", label: "Platform Config", icon: Settings },
  { href: "/admin/reports", label: "Reports & Export", icon: BarChart3 },
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
        <div className="editorial-card p-8 animate-pulse text-sm text-stone-500">
          Loading Administrator Console...
        </div>
      </main>
    );
  }

  if (!user || !user.roles.includes("ADMIN")) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="editorial-card p-8 text-center space-y-4">
          <Shield className="w-10 h-10 text-rose-700 mx-auto" />
          <h1 className="text-2xl font-editorial font-semibold">
            Administrator Access Required
          </h1>
          <p className="text-sm text-stone-600">
            This console requires an active Administrator account with valid
            role scopes. Use the Demo Switcher or sign in as an Admin.
          </p>
          <Link
            href="/auth?next=/admin"
            className="inline-flex px-5 py-2.5 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold"
          >
            Sign In as Administrator
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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-tech uppercase px-2 py-0.5 rounded bg-[#111827] text-white">
              Admin Command Center
            </span>
            {scopes.map((s) => (
              <span
                key={s}
                className="text-[11px] font-tech px-2 py-0.5 rounded bg-blue-50 text-[#1e3a8a] border border-blue-200"
              >
                {s}
              </span>
            ))}
          </div>
          <h1 className="text-3xl font-editorial font-semibold mt-1.5">
            {title}
          </h1>
          <p className="text-sm text-stone-600 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1.5 border-b border-[#e6e0d4] pb-3">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? "bg-[#1e3a8a] text-white"
                  : "bg-white border border-[#e6e0d4] text-stone-700 hover:bg-stone-50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {!hasScope ? (
        <div className="editorial-card p-6 border-rose-200 bg-rose-50 text-rose-900 text-sm">
          Missing required scope: <strong>{requiredScope}</strong>. Your admin
          role does not include permission for this section.
        </div>
      ) : (
        children
      )}
    </main>
  );
}

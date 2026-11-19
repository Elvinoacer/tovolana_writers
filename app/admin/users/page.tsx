"use client";

import { RadarAvatar } from "@/components/ui/AuroraPrimitives";

import React, { useCallback, useEffect, useState } from "react";
import { Crown, Search, ShieldAlert, UserCheck } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import {
  StatusPill,
  formatAdminScope,
  formatRole,
  formatStatusLabel,
} from "@/components/ui/Badges";

interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  roles: string[];
  adminScopes: string[];
  status: string;
  membershipTier: string;
  creatorProfile: {
    username: string;
    applicationStatus: string;
    assessmentScore: number | null;
  } | null;
  _count: { customerBookings: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async (q = "") => {
    try {
      const res = await fetch(
        `/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const j = await res.json();
        setUsers(j.data?.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/users", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (active && j?.data) setUsers(j.data.users ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function patchUser(payload: Record<string, unknown>, label: string) {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error?.message || "Only a Super Admin can change this.");
      return;
    }
    setNotice(label);
    await loadUsers(query);
  }

  return (
    <AdminShell
      title="Users & Roles"
      subtitle="Search clients, writers, and admins, pause or reopen accounts, or grant Pro access."
      requiredScope="SUPPORT_ADMIN"
    >
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email or name..."
            className="hud-input pl-9 pr-3 py-2"
          />
        </div>
        <button
          onClick={() => loadUsers(query)}
          className="btn-primary px-4 py-2 text-xs font-semibold"
        >
          Search
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border border-rose-400/35 bg-rose-500/15 text-rose-200 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-lg border border-emerald-400/35 bg-emerald-500/15 text-emerald-200 text-sm">
          {notice}
        </div>
      )}

      <div className="editorial-card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-400">Loading users...</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.04] border-b border-white/[0.08] text-slate-400">
              <tr>
                <th className="p-3.5">Account</th>
                <th className="p-3.5">Roles &amp; Scopes</th>
                <th className="p-3.5">Plan</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.08]">
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-white/[0.03] transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <RadarAvatar name={u.name} size="sm" theme="sky" />
                      <div>
                        <p className="font-semibold text-white">{u.name}</p>
                        <p className="text-slate-400">{u.email}</p>
                        <p className="font-tech text-[11px] text-slate-400">
                          {u._count.customerBookings} orders
                          {u.creatorProfile
                            ? ` · @${u.creatorProfile.username} (${formatStatusLabel(u.creatorProfile.applicationStatus)})`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span
                          key={r}
                          className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.12] text-slate-200 font-tech"
                        >
                          {formatRole(r)}
                        </span>
                      ))}
                      {u.adminScopes.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-200 border border-sky-400/35 font-tech"
                        >
                          {formatAdminScope(s)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-semibold border ${
                        u.membershipTier === "PRO"
                          ? "bg-amber-500/20 text-amber-200 border-amber-400/35"
                          : "bg-white/[0.07] text-slate-300 border-white/[0.14]"
                      }`}
                    >
                      {u.membershipTier === "PRO" ? "Pro" : "Free"}
                    </span>
                  </td>
                  <td className="p-4">
                    <StatusPill status={u.status} />
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() =>
                          patchUser(
                            {
                              userId: u.id,
                              status:
                                u.status === "SUSPENDED"
                                  ? "ACTIVE"
                                  : "SUSPENDED",
                              reason: "Admin account update",
                            },
                            `Updated account for ${u.email}`
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                          u.status === "SUSPENDED"
                            ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                            : "border-rose-400/35 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                        }`}
                      >
                        {u.status === "SUSPENDED" ? (
                          <>
                            <UserCheck className="w-3 h-3" />
                            Reopen Account
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3 h-3" />
                            Pause Account
                          </>
                        )}
                      </button>

                      <button
                        onClick={() =>
                          patchUser(
                            {
                              userId: u.id,
                              membershipTier:
                                u.membershipTier === "PRO" ? "FREE" : "PRO",
                              proDays:
                                u.membershipTier === "PRO" ? undefined : 30,
                              reason: "Admin plan update",
                            },
                            `Updated Pro plan for ${u.email}`
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-400/35 bg-amber-500/15 text-amber-200 font-semibold hover:bg-amber-500/25 transition-colors"
                      >
                        <Crown className="w-3 h-3" />
                        {u.membershipTier === "PRO"
                          ? "Switch to Free"
                          : "Give Pro (30d)"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}

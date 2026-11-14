"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Crown, Search, ShieldAlert, UserCheck } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { StatusPill } from "@/components/ui/Badges";

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
      setError(j.error?.message || "Update failed (requires SUPER_ADMIN).");
      return;
    }
    setNotice(label);
    await loadUsers(query);
  }

  return (
    <AdminShell
      title="User Accounts, Roles & Pro Membership"
      subtitle="Search customers, vetted creators, and scoped administrators; suspend/reactivate accounts or grant Pro access."
      requiredScope="SUPPORT_ADMIN"
    >
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email or name..."
            className="w-full rounded-lg border border-[#e6e0d4] bg-white pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => loadUsers(query)}
          className="px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-xs font-semibold"
        >
          Search
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
          {notice}
        </div>
      )}

      <div className="editorial-card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-stone-500">Loading users...</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#faf7f2] border-b border-[#e6e0d4] text-stone-600">
              <tr>
                <th className="p-3.5">Account</th>
                <th className="p-3.5">Roles & Scopes</th>
                <th className="p-3.5">Plan</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e0d4]">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="p-3.5">
                    <p className="font-semibold text-[#111827]">{u.name}</p>
                    <p className="text-stone-500">{u.email}</p>
                    <p className="font-tech text-[11px] text-stone-400">
                      {u._count.customerBookings} bookings
                      {u.creatorProfile
                        ? ` · @${u.creatorProfile.username} (${u.creatorProfile.applicationStatus})`
                        : ""}
                    </p>
                  </td>
                  <td className="p-3.5">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span
                          key={r}
                          className="px-2 py-0.5 rounded bg-stone-100 border border-stone-200 font-tech"
                        >
                          {r}
                        </span>
                      ))}
                      {u.adminScopes.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded bg-blue-50 text-[#1e3a8a] font-tech"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold ${
                        u.membershipTier === "PRO"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-stone-100 text-stone-700"
                      }`}
                    >
                      {u.membershipTier}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <StatusPill status={u.status} />
                  </td>
                  <td className="p-3.5">
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
                              reason: "Admin status adjustment",
                            },
                            `Updated status for ${u.email}`
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border font-medium ${
                          u.status === "SUSPENDED"
                            ? "border-emerald-300 text-emerald-800"
                            : "border-rose-300 text-rose-700"
                        }`}
                      >
                        {u.status === "SUSPENDED" ? (
                          <>
                            <UserCheck className="w-3 h-3" />
                            Reactivate
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3 h-3" />
                            Suspend
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
                              proDays: u.membershipTier === "PRO" ? undefined : 30,
                              reason: "Admin membership tier toggle",
                            },
                            `Toggled Pro membership for ${u.email}`
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-amber-300 text-amber-900 font-medium"
                      >
                        <Crown className="w-3 h-3" />
                        {u.membershipTier === "PRO" ? "Set Free" : "Grant Pro 30d"}
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

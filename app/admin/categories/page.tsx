"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FolderPlus, Power, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { HudCard } from "@/components/ui/AuroraPrimitives";

interface AdminCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  _count: { listings: number };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<AdminCategoryRow[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("10");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories?includeInactive=true", {
        cache: "no-store",
      });
      if (res.ok) {
        const j = await res.json();
        setCategories(j.data?.categories ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/categories?includeInactive=true", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (active && j?.data) setCategories(j.data.categories ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        sortOrder: Number(sortOrder),
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error?.message || "Could not create category.");
      return;
    }
    setName("");
    setDescription("");
    setNotice(`Category "${j.data.category.name}" created.`);
    await loadCategories();
  }

  async function toggleActive(cat: AdminCategoryRow) {
    setError(null);
    const res = await fetch(`/api/admin/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cat.isActive }),
    });
    if (res.ok) {
      setNotice(`${cat.name} ${!cat.isActive ? "turned on" : "hidden"}.`);
      await loadCategories();
    }
  }

  async function handleDelete(cat: AdminCategoryRow) {
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/admin/categories/${cat.id}`, {
      method: "DELETE",
    });
    const j = await res.json();
    if (!res.ok) {
      setError(
        j.error?.message ||
          "This category already has services in it — hide it instead of deleting."
      );
      return;
    }
    setNotice(`Category "${cat.name}" removed.`);
    await loadCategories();
  }

  return (
    <AdminShell
      title="Categories"
      subtitle="Add or hide writing categories. Categories with existing services can be hidden instead of deleted."
      requiredScope="MODERATION_ADMIN"
    >
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

      <HudCard theme="cyan" className="p-5">
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Category Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grant Proposals"
              className="hud-input py-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Short Description
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One short line describing what is covered..."
              className="hud-input py-2"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="hud-input w-20 px-2.5 py-2 font-tech"
            />
            <button
              type="submit"
              className="btn-primary flex-1 px-4 py-2 text-xs gap-1.5"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </form>
      </HudCard>

      <div className="editorial-card overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-slate-400">Loading categories...</p>
        ) : (
          <div className="divide-y divide-white/[0.08]">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-tech text-xs px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.12] text-slate-200">
                      #{cat.sortOrder}
                    </span>
                    <h3 className="font-editorial font-semibold text-base text-white">
                      {cat.name}
                    </h3>
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
                        cat.isActive
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/35"
                          : "bg-white/[0.08] text-slate-300 border-white/[0.14]"
                      }`}
                    >
                      {cat.isActive ? "Active" : "Hidden"}
                    </span>
                    <span className="font-tech text-xs text-slate-400">
                      {cat._count?.listings ?? 0} services
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    {cat.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(cat)}
                    className="btn-ghost px-3 py-1.5 text-xs gap-1"
                  >
                    <Power className="w-3.5 h-3.5" />
                    {cat.isActive ? "Hide" : "Show"}
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-200 text-xs font-semibold hover:bg-rose-500/25 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}

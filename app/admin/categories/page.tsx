"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FolderPlus, Power, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";

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
      setNotice(
        `${cat.name} ${!cat.isActive ? "reactivated" : "deactivated"}.`
      );
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
          "Category cannot be deleted when listings depend on it — deactivate instead."
      );
      return;
    }
    setNotice(`Category "${cat.name}" deleted cleanly.`);
    await loadCategories();
  }

  return (
    <AdminShell
      title="Task Category Architecture"
      subtitle="Manage task categories dynamically. Categories with active or historical listings are protected against hard deletion and can be deactivated instead."
      requiredScope="MODERATION_ADMIN"
    >
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

      <form
        onSubmit={handleCreate}
        className="editorial-card p-5 bg-white grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
      >
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">
            Category Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grant Proposals"
            className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">
            Description
          </label>
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Concise scope summary..."
            className="w-full rounded-xl border border-[#e6e0d4] bg-white px-3.5 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-20 rounded-xl border border-[#e6e0d4] bg-white px-2.5 py-2 text-sm font-tech"
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

      <div className="editorial-card overflow-hidden bg-white">
        {loading ? (
          <p className="p-6 text-sm text-stone-500">Loading categories...</p>
        ) : (
          <div className="divide-y divide-[#e6e0d4]">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#faf7f2]/60 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-tech text-xs px-2 py-0.5 rounded-md bg-[#faf7f2] border border-[#e6e0d4]">
                      #{cat.sortOrder}
                    </span>
                    <h3 className="font-editorial font-semibold text-base text-[#111827]">
                      {cat.name}
                    </h3>
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                        cat.isActive
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-stone-200 text-stone-700"
                      }`}
                    >
                      {cat.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className="font-tech text-xs text-stone-500">
                      {cat._count?.listings ?? 0} listings
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 mt-1">
                    {cat.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(cat)}
                    className="btn-ghost px-3 py-1.5 text-xs gap-1"
                  >
                    <Power className="w-3.5 h-3.5" />
                    {cat.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
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

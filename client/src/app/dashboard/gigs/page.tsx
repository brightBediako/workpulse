"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Category, Gig } from "@/lib/types";

export default function MyGigsPage() {
  const { user, loading: authLoading } = useAuth();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    desc: "",
    cat: "plumbing",
    price: "",
    cover: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800",
    shortTitle: "",
    shortDesc: "",
    deliveryTime: "3",
    revisionNumber: "1",
    city: "Accra",
  });

  async function loadGigs() {
    if (!user?._id) return;
    try {
      const data = await api<Gig[]>(`/api/gigs?userId=${user._id}`);
      setGigs(Array.isArray(data) ? data : []);
    } catch {
      setGigs([]);
    }
  }

  useEffect(() => {
    api<{ categories?: Category[] } | Category[]>("/api/categories", {
      auth: false,
    }).then((res) => {
      const list = Array.isArray(res) ? res : res.categories || [];
      setCategories(list as Category[]);
      if (list.length && !form.cat) {
        setForm((f) => ({ ...f, cat: (list[0] as Category).slug }));
      }
    });
  }, [form.cat]);

  useEffect(() => {
    if (user?.isSeller) loadGigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, user?.isSeller]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/gigs", {
        method: "POST",
        body: {
          title: form.title,
          desc: form.desc,
          cat: form.cat,
          price: Number(form.price),
          cover: form.cover,
          shortTitle: form.shortTitle || form.title.slice(0, 40),
          shortDesc: form.shortDesc || form.desc.slice(0, 80),
          deliveryTime: Number(form.deliveryTime),
          revisionNumber: Number(form.revisionNumber),
          city: form.city,
        },
      });
      setShowForm(false);
      await loadGigs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create gig");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen">
        <MarketplaceNav />
        <p className="p-lg">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <MarketplaceNav />
        <main className="max-w-container mx-auto p-lg">
          <EmptyState
            title="Sign in required"
            description="Log in as a worker to manage your gigs."
            action={
              <Link href="/login">
                <Button>Log in</Button>
              </Link>
            }
          />
        </main>
      </div>
    );
  }

  if (!user.isSeller) {
    return (
      <div className="min-h-screen">
        <MarketplaceNav />
        <main className="max-w-container mx-auto p-lg">
          <EmptyState
            title="Worker mode off"
            description="Enable seller mode on your account (register as worker or update profile) to post gigs."
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNav />
      <main className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-lg">
        <div className="flex flex-wrap items-center justify-between gap-md mb-lg">
          <div>
            <p className="font-label-caps text-on-surface-variant mb-xs">
              Worker dashboard
            </p>
            <h1 className="font-page-title text-primary">My gigs</h1>
          </div>
          <Button variant="conversion" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close" : "Post a gig"}
          </Button>
        </div>

        {showForm ? (
          <form
            onSubmit={onCreate}
            className="mb-xl p-lg bg-surface-container-lowest border border-outline-variant rounded-card space-y-md max-w-2xl"
          >
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <div className="space-y-xs">
              <label className="font-label-caps text-on-surface-variant">
                Description
              </label>
              <textarea
                className="w-full min-h-28 px-md py-sm rounded-md border border-outline-variant bg-surface-container-low"
                value={form.desc}
                onChange={(e) => setForm({ ...form, desc: e.target.value })}
                required
              />
            </div>
            <div className="space-y-xs">
              <label className="font-label-caps text-on-surface-variant">
                Category
              </label>
              <select
                className="w-full h-12 px-md rounded-md border border-outline-variant bg-surface-container-low"
                value={form.cat}
                onChange={(e) => setForm({ ...form, cat: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label || c.slug}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Price (GHS)"
              type="number"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
            <Input
              label="Cover image URL"
              value={form.cover}
              onChange={(e) => setForm({ ...form, cover: e.target.value })}
              required
            />
            <Input
              label="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            {error ? <p className="text-error font-body-dense">{error}</p> : null}
            <Button type="submit" loading={saving}>
              Submit for approval
            </Button>
          </form>
        ) : null}

        {gigs.length === 0 ? (
          <EmptyState
            title="No gigs yet"
            description="Post your first service listing. New gigs start as pending until admin approval."
          />
        ) : (
          <div className="overflow-x-auto border border-outline-variant rounded-card bg-surface-container-lowest">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low font-label-caps text-on-surface-variant">
                <tr>
                  <th className="p-md">Title</th>
                  <th className="p-md">Category</th>
                  <th className="p-md">Price</th>
                  <th className="p-md">Status</th>
                </tr>
              </thead>
              <tbody>
                {gigs.map((g) => (
                  <tr
                    key={g._id}
                    className="border-t border-surface-container-low"
                  >
                    <td className="p-md">
                      <Link
                        href={`/gigs/${g._id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {g.title}
                      </Link>
                    </td>
                    <td className="p-md font-body-dense">{g.cat}</td>
                    <td className="p-md font-data-price">
                      GHS {Number(g.price).toLocaleString()}
                    </td>
                    <td className="p-md">
                      <StatusChip status={g.status || "pending"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

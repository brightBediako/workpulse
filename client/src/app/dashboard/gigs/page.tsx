"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { CoverImageField } from "@/components/ui/CoverImageField";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Category, Gig } from "@/lib/types";

type GigForm = {
  title: string;
  desc: string;
  cat: string;
  price: string;
  cover: string;
  shortTitle: string;
  shortDesc: string;
  deliveryTime: string;
  revisionNumber: string;
  city: string;
};

const emptyForm = (cat = "plumbing"): GigForm => ({
  title: "",
  desc: "",
  cat,
  price: "",
  cover: "",
  shortTitle: "",
  shortDesc: "",
  deliveryTime: "3",
  revisionNumber: "1",
  city: "Accra",
});

function formFromGig(g: Gig): GigForm {
  return {
    title: g.title || "",
    desc: g.desc || "",
    cat: g.cat || "plumbing",
    price: String(g.price ?? ""),
    cover: g.cover || "",
    shortTitle: g.shortTitle || "",
    shortDesc: g.shortDesc || "",
    deliveryTime: String(g.deliveryTime ?? 3),
    revisionNumber: String(g.revisionNumber ?? 1),
    city: g.location?.city || "Accra",
  };
}

export default function MyGigsPage() {
  const { user, loading: authLoading } = useAuth();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mode, setMode] = useState<"closed" | "create" | "edit">("closed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<GigForm>(emptyForm());

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
      if (list.length) {
        setForm((f) => ({ ...f, cat: f.cat || (list[0] as Category).slug }));
      }
    });
  }, []);

  useEffect(() => {
    if (user?.isSeller) loadGigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, user?.isSeller]);

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setForm(emptyForm(categories[0]?.slug || "plumbing"));
    setError("");
    setMessage("");
  }

  function openEdit(g: Gig) {
    setMode("edit");
    setEditingId(g._id);
    setForm(formFromGig(g));
    setError("");
    setMessage("");
  }

  function closeForm() {
    setMode("closed");
    setEditingId(null);
    setError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const body = {
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
    };
    try {
      if (mode === "edit" && editingId) {
        await api(`/api/gigs/${editingId}`, { method: "PUT", body });
        setMessage(
          "Gig updated. If it was live, it returns to pending for admin review."
        );
      } else {
        await api("/api/gigs", { method: "POST", body });
        setMessage("Gig submitted for approval.");
      }
      closeForm();
      await loadGigs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save gig");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(id: string, fn: () => Promise<void>, ok: string) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(ok);
      if (editingId === id) closeForm();
      await loadGigs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
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
          <Button
            variant="conversion"
            onClick={() => (mode === "closed" ? openCreate() : closeForm())}
          >
            {mode === "closed" ? "Post a gig" : "Close form"}
          </Button>
        </div>

        {error ? <p className="text-error mb-md font-body-dense">{error}</p> : null}
        {message ? (
          <p className="text-on-primary-fixed-variant mb-md font-body-dense">
            {message}
          </p>
        ) : null}

        {mode !== "closed" ? (
          <form
            onSubmit={onSubmit}
            className="mb-lg p-lg bg-surface-container-lowest border border-outline-variant rounded-card space-y-md max-w-2xl"
          >
            <h2 className="font-section-title text-primary">
              {mode === "edit" ? "Update gig" : "New gig"}
            </h2>
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
            <CoverImageField
              label="Cover image"
              value={form.cover}
              onChange={(cover) => setForm({ ...form, cover })}
              required
            />
            <Input
              label="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            <Button type="submit" loading={saving}>
              {mode === "edit" ? "Save changes" : "Submit for approval"}
            </Button>
          </form>
        ) : null}

        {gigs.length === 0 ? (
          <EmptyState
            title="No gigs yet"
            description="Post your first service listing. New gigs start as pending until admin approval."
          />
        ) : (
          <div className="space-y-md">
            {gigs.map((g) => {
              const busy = busyId === g._id;
              return (
                <article
                  key={g._id}
                  className="p-md border border-outline-variant rounded-card bg-surface-container-lowest"
                >
                  <div className="flex flex-wrap items-start justify-between gap-sm mb-sm">
                    <div className="min-w-0">
                      <Link
                        href={`/gigs/${g._id}`}
                        className="font-section-title text-primary hover:underline"
                      >
                        {g.title}
                      </Link>
                      <p className="font-body-dense text-on-surface-variant mt-xs">
                        {g.cat} · GHS {Number(g.price).toLocaleString()}
                        {g.location?.city ? ` · ${g.location.city}` : ""}
                      </p>
                    </div>
                    <StatusChip status={g.status || "pending"} />
                  </div>
                  <div className="flex flex-wrap gap-sm mt-md">
                    <Button
                      variant="outline"
                      className="!py-sm !px-md text-sm"
                      disabled={busy}
                      onClick={() => openEdit(g)}
                    >
                      Update
                    </Button>
                    {g.status === "suspended" ? (
                      <Button
                        variant="conversion"
                        className="!py-sm !px-md text-sm"
                        loading={busy}
                        onClick={() =>
                          runAction(
                            g._id,
                            () =>
                              api(`/api/gigs/${g._id}/resume`, {
                                method: "PUT",
                              }).then(() => undefined),
                            "Gig resumed — pending admin approval"
                          )
                        }
                      >
                        Resume
                      </Button>
                    ) : g.status !== "rejected" ? (
                      <Button
                        variant="outline"
                        className="!py-sm !px-md text-sm"
                        loading={busy}
                        onClick={() =>
                          runAction(
                            g._id,
                            () =>
                              api(`/api/gigs/${g._id}/suspend`, {
                                method: "PUT",
                              }).then(() => undefined),
                            "Gig suspended"
                          )
                        }
                      >
                        Suspend
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      className="!py-sm !px-md text-sm text-error"
                      loading={busy}
                      onClick={() => {
                        if (!window.confirm(`Delete gig "${g.title}"?`)) return;
                        runAction(
                          g._id,
                          () =>
                            api(`/api/gigs/${g._id}`, {
                              method: "DELETE",
                            }).then(() => undefined),
                          "Gig deleted"
                        );
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

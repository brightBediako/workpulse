"use client";

import { useEffect, useState } from "react";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { GigCard } from "@/components/ui/GigCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import type { Category, Gig } from "@/lib/types";

export default function DiscoverPage() {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cat, setCat] = useState("");
  const [city, setCity] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(next?: { cat?: string; city?: string; search?: string }) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    const c = next?.cat ?? cat;
    const cityQ = next?.city ?? city;
    const s = next?.search ?? search;
    if (c) params.set("cat", c);
    if (cityQ) params.set("city", cityQ);
    if (s) params.set("search", s);
    try {
      const data = await api<Gig[] | { gigs?: Gig[] }>(
        `/api/gigs${params.toString() ? `?${params}` : ""}`,
        { auth: false }
      );
      const list = Array.isArray(data) ? data : data.gigs || [];
      setGigs(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gigs");
      setGigs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api<{ categories?: Category[] } | Category[]>("/api/categories", {
      auth: false,
    })
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : res.categories || [];
        setCategories(list as Category[]);
      })
      .catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNav />
      <main className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-lg">
        <div className="mb-lg">
          <p className="font-label-caps text-on-surface-variant mb-xs">
            Marketplace
          </p>
          <h1 className="font-page-title text-primary mb-sm">
            Discover professional services
          </h1>
          <p className="text-on-surface-variant max-w-2xl">
            Browse approved gigs from verified workers across Ghana.
          </p>
        </div>

        <form
          className="flex flex-col md:flex-row gap-md mb-lg p-md bg-surface-container-lowest border border-outline-variant rounded-card"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <input
            className="flex-1 h-11 px-md rounded-md border border-outline-variant bg-surface-container-low"
            placeholder="Search services…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="h-11 px-md rounded-md border border-outline-variant bg-surface-container-low min-w-[160px]"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label || c.slug}
              </option>
            ))}
          </select>
          <input
            className="h-11 px-md rounded-md border border-outline-variant bg-surface-container-low md:w-40"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Button type="submit">Search</Button>
        </form>

        {error ? (
          <p className="text-error mb-md font-body-dense">{error}</p>
        ) : null}

        {loading ? (
          <p className="text-on-surface-variant">Loading services…</p>
        ) : gigs.length === 0 ? (
          <EmptyState
            title="No services found"
            description="Try another category or city, or check back soon."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-lg">
            {gigs.map((g) => (
              <GigCard key={g._id} gig={g} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

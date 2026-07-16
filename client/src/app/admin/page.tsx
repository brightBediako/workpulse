"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Overview = {
  totalUsers?: number;
  sellers?: number;
  employers?: number;
  totalGigs?: number;
  pendingGigs?: number;
  totalOrders?: number;
  completedOrders?: number;
};

export default function AdminPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.isAdmin) return;
    api<{ overview: Overview }>("/api/admin/dashboard")
      .then((res) => setOverview(res.overview || null))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Admin load failed")
      );
  }, [user]);

  if (!user) {
    return (
      <div>
        <MarketplaceNav />
        <main className="max-w-container mx-auto p-lg">
          <EmptyState
            title="Admin sign-in required"
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

  if (!user.isAdmin) {
    return (
      <div>
        <MarketplaceNav />
        <main className="max-w-container mx-auto p-lg">
          <EmptyState title="Admin access only" />
        </main>
      </div>
    );
  }

  const cards = [
    { label: "Users", value: overview?.totalUsers },
    { label: "Workers", value: overview?.sellers },
    { label: "Employers", value: overview?.employers },
    { label: "Gigs", value: overview?.totalGigs },
    { label: "Pending gigs", value: overview?.pendingGigs },
    { label: "Orders", value: overview?.totalOrders },
    { label: "Completed", value: overview?.completedOrders },
  ];

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNav />
      <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-lg flex flex-col md:flex-row gap-lg">
        <aside className="md:w-56 shrink-0 p-md bg-surface-container-low border border-outline-variant rounded-card h-fit">
          <p className="font-label-caps text-on-surface-variant mb-md">Admin</p>
          <nav className="space-y-sm font-body-dense">
            <span className="block font-semibold text-primary">Overview</span>
            <span className="block text-on-surface-variant">
              Users / Gigs / Orders via API
            </span>
          </nav>
        </aside>
        <main className="flex-1">
          <h1 className="font-page-title text-primary mb-lg">Dashboard</h1>
          {error ? <p className="text-error mb-md">{error}</p> : null}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
            {cards.map((c) => (
              <div
                key={c.label}
                className="p-md bg-surface-container-lowest border border-outline-variant rounded-card"
              >
                <p className="font-label-caps text-on-surface-variant mb-xs">
                  {c.label}
                </p>
                <p className="font-data-price text-xl text-primary">
                  {c.value ?? "—"}
                </p>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

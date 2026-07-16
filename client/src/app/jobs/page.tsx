"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import type { Job } from "@/lib/types";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ jobs: Job[] }>("/api/jobs", { auth: false })
      .then((res) => setJobs(res.jobs || []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNav />
      <main className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-lg">
        <div className="flex flex-wrap items-end justify-between gap-md mb-lg">
          <div>
            <p className="font-label-caps text-on-surface-variant mb-xs">
              Employer jobs
            </p>
            <h1 className="font-page-title text-primary">Open job posts</h1>
          </div>
          <Link href="/login">
            <Button variant="outline">Employer login to post</Button>
          </Link>
        </div>
        {loading ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No open jobs"
            description="Employers can post jobs after enabling employer mode."
          />
        ) : (
          <div className="grid gap-md">
            {jobs.map((j) => (
              <article
                key={j._id}
                className="p-md border border-outline-variant rounded-card bg-surface-container-lowest"
              >
                <div className="flex flex-wrap items-start justify-between gap-sm mb-sm">
                  <h2 className="font-section-title text-primary">{j.title}</h2>
                  <StatusChip status={j.status} />
                </div>
                <p className="font-body-dense text-on-surface-variant line-clamp-2 mb-sm">
                  {j.description}
                </p>
                <p className="font-label-caps text-on-surface-variant">
                  {j.cat}
                  {j.location?.city ? ` · ${j.location.city}` : ""}
                </p>
                {(j.budgetMin || j.budgetMax) && (
                  <p className="font-data-price mt-sm text-primary">
                    {j.currency || "GHS"} {j.budgetMin ?? "—"}–
                    {j.budgetMax ?? "—"}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

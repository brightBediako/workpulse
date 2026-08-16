"use client";

import { useEffect, useState } from "react";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { api, ApiError } from "@/lib/api";

type AdminUser = {
  _id: string;
  username?: string;
  email?: string;
  phone?: string;
};

type AdminOrder = {
  _id: string;
  price?: number;
  status?: string;
  isCompleted?: boolean;
  sellerEarnings?: number;
  platformFee?: number;
  payment_intent?: string;
  sourceType?: string;
};

type AdminApplication = {
  _id: string;
  status: string;
  proposedRate?: number;
  agreedAmount?: number;
  workNote?: string;
  worker?: AdminUser | null;
  order?: AdminOrder | null;
};

type AdminJob = {
  _id: string;
  title: string;
  description?: string;
  cat?: string;
  status?: string;
  budgetMin?: number;
  budgetMax?: number;
  currency?: string;
  location?: { city?: string; region?: string };
  employer?: AdminUser | null;
  applications?: AdminApplication[];
};

function money(n?: number, currency = "GHS") {
  if (n == null || Number.isNaN(n)) return "—";
  return `${currency} ${Number(n).toLocaleString()}`;
}

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ jobs: AdminJob[] }>("/api/admin/jobs?limit=50")
      .then((res) => setJobs(res.jobs || []))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load jobs")
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="font-body-dense text-on-surface-variant">Loading…</p>;
  }

  if (error) {
    return <p className="text-error">{error}</p>;
  }

  if (jobs.length === 0) {
    return <EmptyState title="No job posts yet" />;
  }

  return (
    <div className="space-y-lg">
      <div>
        <h1 className="font-page-title text-primary">Jobs & payments</h1>
        <p className="font-body-dense text-on-surface-variant mt-xs">
          All employer job posts, assigned workers, and Paystack payment records.
        </p>
      </div>

      <div className="space-y-md">
        {jobs.map((job) => (
          <article
            key={job._id}
            className="p-md border border-outline-variant rounded-card bg-surface-container-lowest space-y-md"
          >
            <div className="flex flex-wrap items-start justify-between gap-sm">
              <div>
                <h2 className="font-section-title text-primary">{job.title}</h2>
                <p className="font-label-caps text-on-surface-variant mt-xs">
                  {job.cat}
                  {job.location?.city ? ` · ${job.location.city}` : ""}
                  {job.budgetMin != null || job.budgetMax != null
                    ? ` · Budget ${money(job.budgetMin, job.currency)}–${money(job.budgetMax, job.currency)}`
                    : ""}
                </p>
              </div>
              <StatusChip status={job.status} />
            </div>

            <div className="font-body-dense text-on-surface-variant">
              <span className="font-label-caps">Employer</span>
              <p>
                {job.employer?.username || "—"}
                {job.employer?.email ? ` · ${job.employer.email}` : ""}
              </p>
            </div>

            {(job.applications?.length ?? 0) === 0 ? (
              <p className="font-body-dense text-on-surface-variant">
                No applications yet.
              </p>
            ) : (
              <div className="space-y-sm">
                <h3 className="font-label-caps text-on-surface-variant">
                  Applications & payments
                </h3>
                {job.applications?.map((app) => (
                  <div
                    key={app._id}
                    className="p-md rounded-md border border-outline-variant bg-surface-container-low space-y-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-sm">
                      <div>
                        <p className="font-semibold text-primary">
                          Worker: {app.worker?.username || app.worker?._id || "—"}
                        </p>
                        <p className="font-body-dense text-on-surface-variant">
                          {app.worker?.email || ""}
                          {app.worker?.phone ? ` · ${app.worker.phone}` : ""}
                        </p>
                      </div>
                      <StatusChip status={app.status} />
                    </div>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-sm font-body-dense">
                      <div>
                        <dt className="font-label-caps text-on-surface-variant">
                          Proposed
                        </dt>
                        <dd>{money(app.proposedRate, job.currency)}</dd>
                      </div>
                      <div>
                        <dt className="font-label-caps text-on-surface-variant">
                          Agreed
                        </dt>
                        <dd>{money(app.agreedAmount, job.currency)}</dd>
                      </div>
                      <div>
                        <dt className="font-label-caps text-on-surface-variant">
                          Paid
                        </dt>
                        <dd>
                          {app.order?.isCompleted
                            ? money(app.order.price, job.currency)
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-label-caps text-on-surface-variant">
                          Worker earns
                        </dt>
                        <dd>{money(app.order?.sellerEarnings, job.currency)}</dd>
                      </div>
                    </dl>
                    {app.workNote ? (
                      <p className="font-body-dense italic">
                        Work note: {app.workNote}
                      </p>
                    ) : null}
                    {app.order ? (
                      <p className="font-data-ref text-on-surface-variant">
                        Order {String(app.order._id).slice(-8)} ·{" "}
                        {app.order.status || "pending"} · ref{" "}
                        {app.order.payment_intent?.slice(0, 12) || "—"}…
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

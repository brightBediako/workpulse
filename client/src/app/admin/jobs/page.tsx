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
  cat?: string;
  status?: string;
  budgetMin?: number;
  budgetMax?: number;
  currency?: string;
  location?: { city?: string; region?: string };
  employer?: AdminUser | null;
  applications?: AdminApplication[];
};

type AdminServiceRequest = {
  _id: string;
  title: string;
  cat?: string;
  status?: string;
  budget?: number;
  agreedAmount?: number;
  currency?: string;
  workNote?: string;
  location?: { city?: string; region?: string };
  customer?: AdminUser | null;
  worker?: AdminUser | null;
  order?: AdminOrder | null;
};

function money(n?: number, currency = "GHS") {
  if (n == null || Number.isNaN(n)) return "—";
  return `${currency} ${Number(n).toLocaleString()}`;
}

type Tab = "jobs" | "requests";

export default function AdminJobsPage() {
  const [tab, setTab] = useState<Tab>("jobs");
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [requests, setRequests] = useState<AdminServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.allSettled([
      api<{ jobs: AdminJob[] }>("/api/admin/jobs?limit=50"),
      api<{ requests: AdminServiceRequest[] }>(
        "/api/admin/service-requests?limit=50"
      ),
    ])
      .then(([jobsResult, requestsResult]) => {
        if (jobsResult.status === "fulfilled") {
          setJobs(jobsResult.value.jobs || []);
        } else {
          const err = jobsResult.reason;
          setError(
            err instanceof ApiError ? err.message : "Could not load job posts"
          );
        }

        if (requestsResult.status === "fulfilled") {
          setRequests(requestsResult.value.requests || []);
        } else {
          const err = requestsResult.reason;
          const msg =
            err instanceof ApiError ? err.message : "Could not load requests";
          setError((prev) => (prev ? `${prev}. ${msg}` : msg));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="font-body-dense text-on-surface-variant">Loading…</p>;
  }

  if (error) {
    return <p className="text-error">{error}</p>;
  }

  return (
    <div className="space-y-lg">
      <div>
        <h1 className="font-page-title text-primary">Jobs & service requests</h1>
        <p className="font-body-dense text-on-surface-variant mt-xs">
          Employer jobs, customer service requests, workers, and Paystack payments.
        </p>
      </div>

      <div className="flex gap-md border-b border-outline-variant">
        <button
          type="button"
          className={`pb-sm font-body-dense ${
            tab === "jobs"
              ? "font-semibold text-primary border-b-2 border-primary"
              : "text-on-surface-variant"
          }`}
          onClick={() => setTab("jobs")}
        >
          Job posts ({jobs.length})
        </button>
        <button
          type="button"
          className={`pb-sm font-body-dense ${
            tab === "requests"
              ? "font-semibold text-primary border-b-2 border-primary"
              : "text-on-surface-variant"
          }`}
          onClick={() => setTab("requests")}
        >
          Service requests ({requests.length})
        </button>
      </div>

      {tab === "jobs" ? (
        jobs.length === 0 ? (
          <EmptyState title="No job posts yet" />
        ) : (
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
                    </p>
                  </div>
                  <StatusChip status={job.status} />
                </div>
                <p className="font-body-dense text-on-surface-variant">
                  Employer: {job.employer?.username || "—"}
                  {job.employer?.email ? ` · ${job.employer.email}` : ""}
                </p>
                {(job.applications?.length ?? 0) === 0 ? (
                  <p className="font-body-dense text-on-surface-variant">
                    No applications.
                  </p>
                ) : (
                  job.applications?.map((app) => (
                    <div
                      key={app._id}
                      className="p-md rounded-md border border-outline-variant bg-surface-container-low space-y-sm"
                    >
                      <div className="flex flex-wrap justify-between gap-sm">
                        <p className="font-semibold text-primary">
                          Worker: {app.worker?.username || "—"}
                        </p>
                        <StatusChip status={app.status} />
                      </div>
                      <p className="font-body-dense text-on-surface-variant">
                        Proposed {money(app.proposedRate, job.currency)} · Agreed{" "}
                        {money(app.agreedAmount, job.currency)} · Paid{" "}
                        {app.order?.isCompleted
                          ? money(app.order.price, job.currency)
                          : "—"}
                      </p>
                    </div>
                  ))
                )}
              </article>
            ))}
          </div>
        )
      ) : requests.length === 0 ? (
        <EmptyState title="No service requests yet" />
      ) : (
        <div className="space-y-md">
          {requests.map((r) => (
            <article
              key={r._id}
              className="p-md border border-outline-variant rounded-card bg-surface-container-lowest space-y-sm"
            >
              <div className="flex flex-wrap justify-between gap-sm">
                <h2 className="font-section-title text-primary">{r.title}</h2>
                <StatusChip status={r.status} />
              </div>
              <p className="font-label-caps text-on-surface-variant">
                {r.cat}
                {r.location?.city ? ` · ${r.location.city}` : ""}
              </p>
              <p className="font-body-dense">
                Customer: {r.customer?.username || "—"}
                {r.customer?.email ? ` · ${r.customer.email}` : ""}
              </p>
              <p className="font-body-dense">
                Worker: {r.worker?.username || "—"}
                {r.worker?.email ? ` · ${r.worker.email}` : ""}
              </p>
              <p className="font-data-price text-primary">
                Budget {money(r.budget, r.currency)} · Agreed{" "}
                {money(r.agreedAmount, r.currency)} · Paid{" "}
                {r.order?.isCompleted ? money(r.order.price, r.currency) : "—"}
              </p>
              {r.workNote ? (
                <p className="font-body-dense italic">Work: {r.workNote}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

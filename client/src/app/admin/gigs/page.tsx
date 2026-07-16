"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type AdminGig = {
  _id: string;
  title: string;
  desc?: string;
  cat?: string;
  price?: number;
  status?: string;
  cover?: string;
  rejectionReason?: string;
  createdAt?: string;
  userId?:
    | string
    | {
        _id?: string;
        username?: string;
        email?: string;
        isVerified?: boolean;
      };
};

type Pagination = {
  currentPage: number;
  totalPages: number;
  totalGigs: number;
  hasNext: boolean;
  hasPrev: boolean;
};

function ownerName(g: AdminGig) {
  if (!g.userId) return "—";
  if (typeof g.userId === "string") return g.userId;
  return g.userId.username || "—";
}

export default function AdminGigsPage() {
  return (
    <Suspense
      fallback={
        <p className="font-body-main text-on-surface-variant">Loading gigs…</p>
      }
    >
      <AdminGigsInner />
    </Suspense>
  );
}

function AdminGigsInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [gigs, setGigs] = useState<AdminGig[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(
    searchParams.get("status") || "pending"
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.isAdmin) return;
    setError("");
    try {
      const q = new URLSearchParams({ page: String(page), limit: "15" });
      if (search.trim()) q.set("search", search.trim());
      if (status) q.set("status", status);
      const res = await api<{ gigs: AdminGig[]; pagination: Pagination }>(
        `/api/admin/gigs?${q}`
      );
      setGigs(res.gigs || []);
      setPagination(res.pagination || null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load gigs");
    }
  }, [user?.isAdmin, page, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(
    id: string,
    fn: () => Promise<void>,
    okMsg: string
  ) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(okMsg);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!user?.isAdmin) return null;

  return (
    <div>
      <h1 className="font-page-title text-primary mb-xs">Gigs</h1>
      <p className="font-body-dense text-on-surface-variant mb-lg">
        Approve, reject, or suspend marketplace listings.
      </p>

      <div className="flex flex-col sm:flex-row gap-md mb-lg">
        <div className="flex-1">
          <Input
            label="Search"
            placeholder="Title or description"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className="sm:w-48">
          <label className="font-label-caps text-on-surface-variant block mb-xs">
            Status
          </label>
          <select
            className="w-full h-12 bg-surface-container-low border border-outline-variant rounded-md px-md"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {error ? <p className="text-error mb-md">{error}</p> : null}
      {message ? (
        <p className="text-on-primary-fixed-variant mb-md font-body-dense">
          {message}
        </p>
      ) : null}

      {gigs.length === 0 ? (
        <EmptyState title="No gigs match these filters" />
      ) : (
        <div className="space-y-md">
          {gigs.map((g) => {
            const busy = busyId === g._id;
            return (
              <article
                key={g._id}
                className="p-md bg-surface-container-lowest border border-outline-variant rounded-card"
              >
                <div className="flex flex-col sm:flex-row gap-md">
                  {g.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.cover}
                      alt=""
                      className="w-full sm:w-28 h-28 object-cover rounded-md bg-surface-container"
                    />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-sm mb-xs">
                      <h2 className="font-section-title text-primary">
                        {g.title}
                      </h2>
                      <StatusChip status={g.status} />
                    </div>
                    <p className="font-body-dense text-on-surface-variant">
                      {ownerName(g)}
                      {g.cat ? ` · ${g.cat}` : ""}
                      {g.price != null
                        ? ` · GHS ${Number(g.price).toLocaleString()}`
                        : ""}
                    </p>
                    {g.desc ? (
                      <p className="font-body-dense text-on-surface mt-sm line-clamp-2">
                        {g.desc}
                      </p>
                    ) : null}
                    {g.rejectionReason ? (
                      <p className="font-body-dense text-error mt-xs">
                        Reason: {g.rejectionReason}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-sm mt-md">
                      <Link href={`/gigs/${g._id}`}>
                        <Button
                          variant="ghost"
                          className="!py-sm !px-md text-sm"
                        >
                          View
                        </Button>
                      </Link>
                      {g.status !== "approved" ? (
                        <Button
                          variant="conversion"
                          className="!py-sm !px-md text-sm"
                          loading={busy}
                          disabled={busy}
                          onClick={() =>
                            runAction(
                              g._id,
                              () =>
                                api(`/api/admin/gigs/${g._id}/approve`, {
                                  method: "PUT",
                                  body: {},
                                }).then(() => undefined),
                              "Gig approved"
                            )
                          }
                        >
                          Approve
                        </Button>
                      ) : null}
                      {g.status !== "rejected" ? (
                        <Button
                          variant="outline"
                          className="!py-sm !px-md text-sm"
                          loading={busy}
                          disabled={busy}
                          onClick={() => {
                            const reason =
                              window.prompt(
                                "Rejection reason:",
                                "Does not meet listing guidelines"
                              ) || "";
                            if (!reason) return;
                            return runAction(
                              g._id,
                              () =>
                                api(`/api/admin/gigs/${g._id}/reject`, {
                                  method: "PUT",
                                  body: { rejectionReason: reason },
                                }).then(() => undefined),
                              "Gig rejected"
                            );
                          }}
                        >
                          Reject
                        </Button>
                      ) : null}
                      {g.status === "approved" ? (
                        <Button
                          variant="ghost"
                          className="!py-sm !px-md text-sm text-error"
                          loading={busy}
                          disabled={busy}
                          onClick={() => {
                            const reason =
                              window.prompt(
                                "Suspension reason:",
                                "Policy violation"
                              ) || "";
                            if (!reason) return;
                            return runAction(
                              g._id,
                              () =>
                                api(`/api/admin/gigs/${g._id}/suspend`, {
                                  method: "PUT",
                                  body: { suspensionReason: reason },
                                }).then(() => undefined),
                              "Gig suspended"
                            );
                          }}
                        >
                          Suspend
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        className="!py-sm !px-md text-sm text-error"
                        loading={busy}
                        disabled={busy}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Delete gig "${g.title}" permanently?`
                            )
                          )
                            return;
                          return runAction(
                            g._id,
                            () =>
                              api(`/api/admin/gigs/${g._id}`, {
                                method: "DELETE",
                              }).then(() => undefined),
                            "Gig deleted"
                          );
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between mt-lg gap-md">
          <Button
            variant="outline"
            disabled={!pagination.hasPrev || busyId !== null}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <p className="font-body-dense text-on-surface-variant">
            Page {pagination.currentPage} of {pagination.totalPages} (
            {pagination.totalGigs} gigs)
          </p>
          <Button
            variant="outline"
            disabled={!pagination.hasNext || busyId !== null}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

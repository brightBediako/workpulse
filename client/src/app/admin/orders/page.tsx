"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Party = { _id?: string; username?: string; email?: string } | string;

type AdminOrder = {
  _id: string;
  title: string;
  price?: number;
  status?: string;
  isCompleted?: boolean;
  disputeStatus?: string;
  disputeReason?: string;
  disputeDescription?: string;
  adminResolution?: string;
  createdAt?: string;
  buyerId?: Party;
  sellerId?: Party;
  gigId?: { _id?: string; title?: string } | string;
};

type Pagination = {
  currentPage: number;
  totalPages: number;
  totalOrders: number;
  hasNext: boolean;
  hasPrev: boolean;
};

function partyName(p?: Party) {
  if (!p) return "—";
  if (typeof p === "string") return p;
  return p.username || "—";
}

function money(n?: number) {
  if (n == null) return "—";
  return `GHS ${Number(n).toLocaleString()}`;
}

const ORDER_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
  "disputed",
] as const;

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <p className="font-body-main text-on-surface-variant">
          Loading orders…
        </p>
      }
    >
      <AdminOrdersInner />
    </Suspense>
  );
}

function AdminOrdersInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [disputeStatus, setDisputeStatus] = useState(
    searchParams.get("disputeStatus") || ""
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.isAdmin) return;
    setError("");
    try {
      const q = new URLSearchParams({ page: String(page), limit: "15" });
      if (status) q.set("status", status);
      if (disputeStatus) q.set("disputeStatus", disputeStatus);
      const res = await api<{ orders: AdminOrder[]; pagination: Pagination }>(
        `/api/admin/orders?${q}`
      );
      setOrders(res.orders || []);
      setPagination(res.pagination || null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load orders");
    }
  }, [user?.isAdmin, page, status, disputeStatus]);

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
      <h1 className="font-page-title text-primary mb-xs">Orders</h1>
      <p className="font-body-dense text-on-surface-variant mb-lg">
        Update order status and resolve open disputes.
      </p>

      <div className="flex flex-col sm:flex-row gap-md mb-lg">
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
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:w-48">
          <label className="font-label-caps text-on-surface-variant block mb-xs">
            Dispute
          </label>
          <select
            className="w-full h-12 bg-surface-container-low border border-outline-variant rounded-md px-md"
            value={disputeStatus}
            onChange={(e) => {
              setPage(1);
              setDisputeStatus(e.target.value);
            }}
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>

      {error ? <p className="text-error mb-md">{error}</p> : null}
      {message ? (
        <p className="text-on-primary-fixed-variant mb-md font-body-dense">
          {message}
        </p>
      ) : null}

      {orders.length === 0 ? (
        <EmptyState title="No orders match these filters" />
      ) : (
        <div className="space-y-md">
          {orders.map((o) => {
            const busy = busyId === o._id;
            const openDispute = o.disputeStatus === "open";
            return (
              <article
                key={o._id}
                className="p-md bg-surface-container-lowest border border-outline-variant rounded-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-md">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-sm mb-xs">
                      <h2 className="font-section-title text-primary">
                        {o.title}
                      </h2>
                      <StatusChip status={o.status} />
                      {o.disputeStatus && o.disputeStatus !== "none" ? (
                        <StatusChip
                          status={
                            o.disputeStatus === "open" ? "disputed" : o.disputeStatus
                          }
                          label={`dispute: ${o.disputeStatus}`}
                        />
                      ) : null}
                    </div>
                    <p className="font-body-dense text-on-surface-variant">
                      {partyName(o.buyerId)} → {partyName(o.sellerId)} ·{" "}
                      {money(o.price)}
                    </p>
                    {openDispute && (o.disputeReason || o.disputeDescription) ? (
                      <p className="font-body-dense text-on-surface mt-sm">
                        Dispute: {o.disputeReason || o.disputeDescription}
                      </p>
                    ) : null}
                    {o.adminResolution ? (
                      <p className="font-body-dense text-on-surface-variant mt-xs">
                        Resolution: {o.adminResolution}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-sm">
                    <select
                      className="h-10 bg-surface-container-low border border-outline-variant rounded-md px-sm font-body-dense"
                      value={o.status || "pending"}
                      disabled={busy}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next === o.status) return;
                        runAction(
                          o._id,
                          () =>
                            api(`/api/admin/orders/${o._id}/status`, {
                              method: "PUT",
                              body: { status: next },
                            }).then(() => undefined),
                          `Status set to ${next}`
                        );
                      }}
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                    {openDispute ? (
                      <Button
                        variant="conversion"
                        className="!py-sm !px-md text-sm"
                        loading={busy}
                        disabled={busy}
                        onClick={() => {
                          const resolution =
                            window.prompt(
                              "Resolution notes for this dispute:",
                              "Resolved in favor of buyer"
                            ) || "";
                          if (!resolution) return;
                          return runAction(
                            o._id,
                            () =>
                              api(
                                `/api/admin/orders/${o._id}/resolve-dispute`,
                                {
                                  method: "PUT",
                                  body: {
                                    resolution,
                                    adminNotes: resolution,
                                  },
                                }
                              ).then(() => undefined),
                            "Dispute resolved"
                          );
                        }}
                      >
                        Resolve dispute
                      </Button>
                    ) : null}
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
            {pagination.totalOrders} orders)
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

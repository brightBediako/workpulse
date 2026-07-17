"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type PayoutAccountSnap = {
  method?: string;
  provider?: string;
  accountName?: string;
  accountNumber?: string;
};

type PayoutRequest = {
  id: string;
  amount: number;
  currency?: string;
  status: string;
  payoutAccount?: PayoutAccountSnap;
  note?: string | null;
  rejectionReason?: string | null;
  adminNotes?: string | null;
  createdAt?: string;
  user?: {
    _id?: string;
    username?: string;
    email?: string;
    phone?: string;
  };
};

type Pagination = {
  currentPage: number;
  totalPages: number;
  totalRequests: number;
  hasNext: boolean;
  hasPrev: boolean;
};

function money(n?: number, currency = "GHS") {
  if (n == null || Number.isNaN(n)) return "—";
  return `${currency} ${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const STATUSES = [
  "",
  "pending",
  "approved",
  "paid",
  "rejected",
  "cancelled",
] as const;

export default function AdminPayoutsPage() {
  return (
    <Suspense
      fallback={
        <p className="font-body-main text-on-surface-variant">
          Loading payouts…
        </p>
      }
    >
      <AdminPayoutsInner />
    </Suspense>
  );
}

function AdminPayoutsInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(searchParams.get("status") || "pending");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    if (!user?.isAdmin) return;
    setError("");
    try {
      const q = new URLSearchParams({ page: String(page), limit: "15" });
      if (status) q.set("status", status);
      const res = await api<{
        requests: PayoutRequest[];
        pendingCount?: number;
        pagination: Pagination;
      }>(`/api/admin/payouts?${q}`);
      setRequests(res.requests || []);
      setPagination(res.pagination || null);
      setPendingCount(res.pendingCount || 0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load payouts");
    }
  }, [user?.isAdmin, page, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(
    id: string,
    action: "approve" | "reject" | "paid",
    body?: Record<string, unknown>
  ) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      const res = await api<{ message?: string }>(
        `/api/admin/payouts/${id}/${action}`,
        { method: "PUT", body: body || {} }
      );
      setMessage(res.message || "Updated.");
      setRejectId(null);
      setRejectReason("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function onReject(e: FormEvent) {
    e.preventDefault();
    if (!rejectId) return;
    act(rejectId, "reject", { reason: rejectReason.trim() });
  }

  return (
    <div className="space-y-lg">
      <div>
        <h1 className="font-page-title text-primary">Payout requests</h1>
        <p className="font-body-dense text-on-surface-variant mt-xs">
          Review worker withdrawal requests, then mark them paid after you send
          MoMo or bank transfer.
        </p>
        {pendingCount > 0 ? (
          <p className="font-body-dense text-on-secondary-fixed-variant mt-sm">
            {pendingCount} pending review
          </p>
        ) : null}
      </div>

      {error ? <p className="text-error font-body-dense">{error}</p> : null}
      {message ? (
        <p className="font-body-dense text-on-primary-fixed-variant">{message}</p>
      ) : null}

      <div className="max-w-xs">
        <label className="font-label-caps text-on-surface-variant block mb-xs">
          Status filter
        </label>
        <select
          className="w-full h-12 bg-surface-container-low border border-outline-variant rounded-md px-md"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s ? s.replace(/_/g, " ") : "All"}
            </option>
          ))}
        </select>
      </div>

      {requests.length === 0 ? (
        <EmptyState title="No payout requests match this filter" />
      ) : (
        <ul className="space-y-md">
          {requests.map((r) => (
            <li
              key={r.id}
              className="p-md bg-surface-container-lowest border border-outline-variant rounded-card space-y-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-md">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-sm mb-xs">
                    <StatusChip status={r.status} />
                    <p className="font-data-price text-primary text-lg">
                      {money(r.amount, r.currency)}
                    </p>
                  </div>
                  <p className="font-semibold text-primary">
                    {r.user?.username || r.userId || "Worker"}
                  </p>
                  <p className="font-body-dense text-on-surface-variant">
                    {r.user?.email || ""}
                    {r.user?.phone ? ` · ${r.user.phone}` : ""}
                  </p>
                  <p className="font-data-ref text-on-surface-variant mt-xs">
                    {r.createdAt
                      ? new Date(r.createdAt).toLocaleString()
                      : ""}
                  </p>
                </div>
                <div className="font-body-dense text-on-surface text-right">
                  <p className="font-label-caps text-on-surface-variant mb-xs">
                    Destination
                  </p>
                  <p>
                    {r.payoutAccount?.method === "bank"
                      ? "Bank"
                      : "Mobile money"}{" "}
                    · {r.payoutAccount?.provider}
                  </p>
                  <p>{r.payoutAccount?.accountName}</p>
                  <p className="font-data-ref">
                    {r.payoutAccount?.accountNumber}
                  </p>
                </div>
              </div>

              {r.note ? (
                <p className="font-body-dense text-on-surface-variant">
                  Worker note: {r.note}
                </p>
              ) : null}
              {r.rejectionReason ? (
                <p className="font-body-dense text-error">
                  Rejected: {r.rejectionReason}
                </p>
              ) : null}

              {rejectId === r.id ? (
                <form onSubmit={onReject} className="space-y-sm max-w-md">
                  <Input
                    label="Rejection reason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    required
                  />
                  <div className="flex gap-sm">
                    <Button type="submit" loading={busyId === r.id}>
                      Confirm reject
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setRejectId(null);
                        setRejectReason("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap gap-sm">
                  {r.status === "pending" ? (
                    <>
                      <Button
                        type="button"
                        loading={busyId === r.id}
                        onClick={() => act(r.id, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="conversion"
                        loading={busyId === r.id}
                        onClick={() => act(r.id, "paid")}
                      >
                        Mark paid
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setRejectId(r.id);
                          setRejectReason("");
                        }}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                  {r.status === "approved" ? (
                    <>
                      <Button
                        type="button"
                        variant="conversion"
                        loading={busyId === r.id}
                        onClick={() => act(r.id, "paid")}
                      >
                        Mark paid
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setRejectId(r.id);
                          setRejectReason("");
                        }}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {pagination && pagination.totalPages > 1 ? (
        <div className="flex items-center gap-md">
          <Button
            variant="outline"
            disabled={!pagination.hasPrev}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="font-body-dense text-on-surface-variant">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={!pagination.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

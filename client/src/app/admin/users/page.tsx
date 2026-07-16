"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type AdminUser = {
  _id: string;
  username: string;
  email?: string;
  phone?: string;
  country?: string;
  isSeller?: boolean;
  isEmployer?: boolean;
  isAdmin?: boolean;
  isVerified?: boolean;
  isBanned?: boolean;
  banReason?: string | null;
  verificationStatus?: string;
  verificationDocuments?: unknown[];
  createdAt?: string;
};

type Pagination = {
  currentPage: number;
  totalPages: number;
  totalUsers: number;
  hasNext: boolean;
  hasPrev: boolean;
};

function roleLabel(u: AdminUser) {
  const parts: string[] = [];
  if (u.isAdmin) parts.push("admin");
  if (u.isSeller) parts.push("worker");
  if (u.isEmployer) parts.push("employer");
  if (!parts.length) parts.push("customer");
  return parts.join(", ");
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <p className="font-body-main text-on-surface-variant">Loading users…</p>
      }
    >
      <AdminUsersInner />
    </Suspense>
  );
}

function AdminUsersInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [role, setRole] = useState(searchParams.get("role") || "");
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
      if (role) q.set("role", role);
      const res = await api<{ users: AdminUser[]; pagination: Pagination }>(
        `/api/admin/users?${q}`
      );
      setUsers(res.users || []);
      setPagination(res.pagination || null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load users");
    }
  }, [user?.isAdmin, page, search, status, role]);

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
      <h1 className="font-page-title text-primary mb-xs">Users</h1>
      <p className="font-body-dense text-on-surface-variant mb-lg">
        Verify workers, ban accounts, and adjust marketplace roles.
      </p>

      <div className="flex flex-col sm:flex-row gap-md mb-lg">
        <div className="flex-1">
          <Input
            label="Search"
            placeholder="Username or email"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className="sm:w-40">
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
            <option value="verified">Verified</option>
            <option value="pending">Pending verification</option>
            <option value="banned">Banned</option>
          </select>
        </div>
        <div className="sm:w-40">
          <label className="font-label-caps text-on-surface-variant block mb-xs">
            Role
          </label>
          <select
            className="w-full h-12 bg-surface-container-low border border-outline-variant rounded-md px-md"
            value={role}
            onChange={(e) => {
              setPage(1);
              setRole(e.target.value);
            }}
          >
            <option value="">All</option>
            <option value="buyer">Customer</option>
            <option value="worker">Worker</option>
            <option value="employer">Employer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {error ? <p className="text-error mb-md">{error}</p> : null}
      {message ? (
        <p className="text-on-primary-fixed-variant mb-md font-body-dense">
          {message}
        </p>
      ) : null}

      {users.length === 0 ? (
        <EmptyState title="No users match these filters" />
      ) : (
        <div className="space-y-md">
          {users.map((u) => {
            const busy = busyId === u._id;
            const docs = u.verificationDocuments?.length || 0;
            return (
              <article
                key={u._id}
                className="p-md bg-surface-container-lowest border border-outline-variant rounded-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-md">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-sm mb-xs">
                      <h2 className="font-section-title text-primary">
                        {u.username}
                      </h2>
                      {u.isBanned ? (
                        <StatusChip status="rejected" label="banned" />
                      ) : null}
                      {u.isVerified ? (
                        <StatusChip status="verified" />
                      ) : (
                        <StatusChip
                          status={u.verificationStatus || "pending"}
                        />
                      )}
                    </div>
                    <p className="font-body-dense text-on-surface-variant">
                      {u.email}
                      {u.phone ? ` · ${u.phone}` : ""}
                    </p>
                    <p className="font-body-dense text-on-surface-variant mt-xs">
                      Roles: {roleLabel(u)} · Docs: {docs}
                      {u.banReason ? ` · Ban: ${u.banReason}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-sm">
                    {!u.isBanned ? (
                      <>
                        <Button
                          variant="outline"
                          className="!py-sm !px-md text-sm"
                          loading={busy}
                          disabled={busy || docs === 0}
                          title={
                            docs === 0
                              ? "User needs verification documents on file"
                              : undefined
                          }
                          onClick={() =>
                            runAction(
                              u._id,
                              () =>
                                api(`/api/admin/users/${u._id}/verify`, {
                                  method: "PUT",
                                  body: { verificationStatus: "verified" },
                                }).then(() => undefined),
                              "User verified"
                            )
                          }
                        >
                          Verify
                        </Button>
                        <Button
                          variant="ghost"
                          className="!py-sm !px-md text-sm"
                          loading={busy}
                          disabled={busy}
                          onClick={() =>
                            runAction(
                              u._id,
                              () =>
                                api(`/api/admin/users/${u._id}/verify`, {
                                  method: "PUT",
                                  body: {
                                    verificationStatus: "rejected",
                                    adminNotes: "Rejected by admin",
                                  },
                                }).then(() => undefined),
                              "Verification rejected"
                            )
                          }
                        >
                          Reject verify
                        </Button>
                        <Button
                          variant="ghost"
                          className="!py-sm !px-md text-sm text-error"
                          loading={busy}
                          disabled={busy || !!u.isAdmin}
                          onClick={() => {
                            const reason =
                              window.prompt(
                                "Ban reason (shown to support):",
                                "Policy violation"
                              ) || "";
                            if (!reason) return;
                            return runAction(
                              u._id,
                              () =>
                                api(`/api/admin/users/${u._id}/ban`, {
                                  method: "PUT",
                                  body: { banReason: reason },
                                }).then(() => undefined),
                              "User banned"
                            );
                          }}
                        >
                          Ban
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        className="!py-sm !px-md text-sm"
                        loading={busy}
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            u._id,
                            () =>
                              api(`/api/admin/users/${u._id}/unban`, {
                                method: "PUT",
                              }).then(() => undefined),
                            "User unbanned"
                          )
                        }
                      >
                        Unban
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="!py-sm !px-md text-sm"
                      loading={busy}
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          u._id,
                          () =>
                            api(`/api/admin/users/${u._id}`, {
                              method: "PUT",
                              body: { isSeller: !u.isSeller },
                            }).then(() => undefined),
                          u.isSeller ? "Worker role removed" : "Worker role added"
                        )
                      }
                    >
                      {u.isSeller ? "Remove worker" : "Make worker"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="!py-sm !px-md text-sm"
                      loading={busy}
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          u._id,
                          () =>
                            api(`/api/admin/users/${u._id}`, {
                              method: "PUT",
                              body: { isEmployer: !u.isEmployer },
                            }).then(() => undefined),
                          u.isEmployer
                            ? "Employer role removed"
                            : "Employer role added"
                        )
                      }
                    >
                      {u.isEmployer ? "Remove employer" : "Make employer"}
                    </Button>
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
            {pagination.totalUsers} users)
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ServiceRequest } from "@/lib/types";

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ServiceRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!id) return;
    const doc = await api<ServiceRequest>(`/api/service-requests/${id}`, {
      auth: false,
    });
    setRequest(doc);
  }

  useEffect(() => {
    if (!id) return;
    load().catch((err) =>
      setError(err instanceof Error ? err.message : "Request not found")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isWorker = Boolean(user?.isSeller || user?.accountModes?.worker);
  const isOwner =
    user && request && String(request.customerId) === String(user._id);
  const isAcceptedWorker =
    user &&
    request?.acceptedBy &&
    String(request.acceptedBy) === String(user._id);
  const isDirectedToMe =
    user &&
    request?.sellerId &&
    String(request.sellerId) === String(user._id);

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(ok);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  function accept() {
    const note = window.prompt("Optional note for the customer:") || undefined;
    run(
      () =>
        api(`/api/service-requests/${id}/accept`, {
          method: "PUT",
          body: note ? { note } : {},
        }).then(() => undefined),
      "Request accepted"
    );
  }

  function reject() {
    const note = window.prompt("Optional reason for declining:") || undefined;
    run(
      () =>
        api(`/api/service-requests/${id}/reject`, {
          method: "PUT",
          body: note ? { note } : {},
        }).then(() => undefined),
      "Request declined"
    );
  }

  function complete() {
    if (!window.confirm("Mark this service request as completed?")) return;
    run(
      () =>
        api(`/api/service-requests/${id}/complete`, {
          method: "PUT",
          body: {},
        }).then(() => undefined),
      "Request marked completed"
    );
  }

  function cancel() {
    if (!window.confirm("Cancel this service request?")) return;
    run(
      () =>
        api(`/api/service-requests/${id}`, { method: "DELETE" }).then(
          () => undefined
        ),
      "Request cancelled"
    );
  }

  const canAccept =
    isWorker &&
    request?.status === "open" &&
    !isOwner &&
    (!request.sellerId || isDirectedToMe);
  const canReject =
    isWorker &&
    request?.status === "open" &&
    isDirectedToMe &&
    Boolean(request.sellerId);
  const canComplete =
    request?.status === "accepted" && (isOwner || isAcceptedWorker);
  const canCancel =
    isOwner &&
    request &&
    request.status !== "completed" &&
    request.status !== "cancelled";

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNav />
      <main className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-lg">
        <Link
          href="/service-requests"
          className="font-body-dense text-primary-container hover:underline mb-md inline-block"
        >
          ← All service requests
        </Link>

        {error && !request ? <p className="text-error">{error}</p> : null}
        {!request && !error ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : null}

        {request ? (
          <div className="max-w-2xl space-y-md">
            <div className="flex flex-wrap items-start justify-between gap-sm">
              <h1 className="font-page-title text-primary">{request.title}</h1>
              <StatusChip status={request.status} />
            </div>

            <p className="font-label-caps text-on-surface-variant">
              {request.cat}
              {request.location?.city ? ` · ${request.location.city}` : ""}
              {request.location?.region ? `, ${request.location.region}` : ""}
              {request.sellerId ? " · Directed" : " · Open board"}
            </p>

            <div className="p-md border border-outline-variant rounded-card bg-surface-container-lowest">
              <p className="whitespace-pre-wrap text-on-surface">
                {request.description}
              </p>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-md font-body-dense">
              {request.budget != null ? (
                <div>
                  <dt className="font-label-caps text-on-surface-variant">
                    Budget
                  </dt>
                  <dd className="font-data-price text-primary">
                    {request.currency || "GHS"}{" "}
                    {Number(request.budget).toLocaleString()}
                  </dd>
                </div>
              ) : null}
              {request.preferredDate ? (
                <div>
                  <dt className="font-label-caps text-on-surface-variant">
                    Preferred date
                  </dt>
                  <dd>{formatDate(request.preferredDate)}</dd>
                </div>
              ) : null}
              {request.createdAt ? (
                <div>
                  <dt className="font-label-caps text-on-surface-variant">
                    Posted
                  </dt>
                  <dd>{formatDate(request.createdAt)}</dd>
                </div>
              ) : null}
              {request.acceptedAt ? (
                <div>
                  <dt className="font-label-caps text-on-surface-variant">
                    Accepted
                  </dt>
                  <dd>{formatDate(request.acceptedAt)}</dd>
                </div>
              ) : null}
            </dl>

            {request.responseNote ? (
              <p className="font-body-dense text-on-surface italic border-l-2 border-primary-container pl-md">
                Worker note: {request.responseNote}
              </p>
            ) : null}

            {error ? <p className="text-error">{error}</p> : null}
            {message ? (
              <p className="font-body-dense text-on-primary-fixed-variant">
                {message}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-sm pt-md">
              {canAccept ? (
                <Button variant="conversion" loading={busy} onClick={accept}>
                  Accept / claim
                </Button>
              ) : null}
              {canReject ? (
                <Button variant="outline" loading={busy} onClick={reject}>
                  Decline
                </Button>
              ) : null}
              {canComplete ? (
                <Button loading={busy} onClick={complete}>
                  Mark completed
                </Button>
              ) : null}
              {canCancel ? (
                <Button
                  variant="ghost"
                  className="text-error"
                  loading={busy}
                  onClick={cancel}
                >
                  Cancel request
                </Button>
              ) : null}
              {isOwner && request.status === "open" ? (
                <Link href="/service-requests">
                  <Button variant="outline">Manage in My requests</Button>
                </Link>
              ) : null}
              {!user ? (
                <Link href={`/login?next=/service-requests/${id}`}>
                  <Button>Log in to respond</Button>
                </Link>
              ) : null}
              {request.gigId ? (
                <Link href={`/gigs/${request.gigId}`}>
                  <Button variant="ghost">Related gig</Button>
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Category, ServiceRequest } from "@/lib/types";

type RequestForm = {
  title: string;
  description: string;
  cat: string;
  city: string;
  region: string;
  budget: string;
  preferredDate: string;
  sellerId: string;
  gigId: string;
};

type Tab = "open" | "mine" | "inbox";

const emptyForm = (cat = "plumbing"): RequestForm => ({
  title: "",
  description: "",
  cat,
  city: "Accra",
  region: "Greater Accra",
  budget: "",
  preferredDate: "",
  sellerId: "",
  gigId: "",
});

function formFromRequest(r: ServiceRequest): RequestForm {
  return {
    title: r.title || "",
    description: r.description || "",
    cat: r.cat || "plumbing",
    city: r.location?.city || "Accra",
    region: r.location?.region || "Greater Accra",
    budget: r.budget != null ? String(r.budget) : "",
    preferredDate: r.preferredDate
      ? String(r.preferredDate).slice(0, 10)
      : "",
    sellerId: r.sellerId || "",
    gigId: r.gigId || "",
  };
}

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

function RequestCard({
  request: r,
  userId,
  isWorker,
  busyId,
  onAccept,
  onReject,
  onSubmitWork,
  onApproveWork,
  onPay,
  onComplete,
  onCancel,
  onEdit,
  approveAmount,
  onApproveAmountChange,
  workNote,
  onWorkNoteChange,
  showDirectedLabel,
}: {
  request: ServiceRequest;
  userId?: string;
  isWorker: boolean;
  busyId: string | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onSubmitWork: (id: string) => void;
  onApproveWork: (id: string) => void;
  onPay: (id: string) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onEdit: (r: ServiceRequest) => void;
  approveAmount: string;
  onApproveAmountChange: (v: string) => void;
  workNote: string;
  onWorkNoteChange: (v: string) => void;
  showDirectedLabel?: boolean;
}) {
  const busy = busyId === r._id;
  const isOwner = userId && String(r.customerId) === String(userId);
  const isAcceptedWorker =
    userId && r.acceptedBy && String(r.acceptedBy) === String(userId);
  const isDirectedToMe =
    userId && r.sellerId && String(r.sellerId) === String(userId);
  const canAccept =
    isWorker &&
    r.status === "open" &&
    !isOwner &&
    (!r.sellerId || isDirectedToMe);
  const canReject =
    isWorker && r.status === "open" && isDirectedToMe && Boolean(r.sellerId);
  const canSubmitWork = isAcceptedWorker && r.status === "accepted";
  const canApproveWork = isOwner && r.status === "work_submitted";
  const canPay = isOwner && r.status === "work_approved";
  const canComplete = r.status === "paid" && (isOwner || isAcceptedWorker);
  const canEdit = isOwner && r.status === "open";
  const canCancel =
    isOwner &&
    !["completed", "cancelled", "paid", "work_approved"].includes(r.status);

  return (
    <article className="p-md border border-outline-variant rounded-card bg-surface-container-lowest">
      <div className="flex flex-wrap items-start justify-between gap-sm mb-sm">
        <div className="min-w-0">
          <Link
            href={`/service-requests/${r._id}`}
            className="font-section-title text-primary hover:underline"
          >
            {r.title}
          </Link>
          {showDirectedLabel && r.sellerId ? (
            <p className="font-label-caps text-on-surface-variant mt-xs">
              Directed request
            </p>
          ) : null}
          {!r.sellerId && r.status === "open" ? (
            <p className="font-label-caps text-on-surface-variant mt-xs">
              Open board
            </p>
          ) : null}
        </div>
        <StatusChip status={r.status} />
      </div>
      <p className="font-body-dense text-on-surface-variant line-clamp-3 mb-sm">
        {r.description}
      </p>
      <p className="font-label-caps text-on-surface-variant">
        {r.cat}
        {r.location?.city ? ` · ${r.location.city}` : ""}
        {r.location?.region ? `, ${r.location.region}` : ""}
      </p>
      {r.budget != null ? (
        <p className="font-data-price mt-sm text-primary">
          {r.currency || "GHS"} {Number(r.budget).toLocaleString()}
        </p>
      ) : null}
      {r.preferredDate ? (
        <p className="font-body-dense text-on-surface-variant mt-xs">
          Preferred: {formatDate(r.preferredDate)}
        </p>
      ) : null}
      {r.responseNote ? (
        <p className="font-body-dense text-on-surface mt-sm italic">
          Note: {r.responseNote}
        </p>
      ) : null}
      {r.workNote ? (
        <p className="font-body-dense text-on-surface mt-sm italic">
          Work: {r.workNote}
        </p>
      ) : null}
      {r.agreedAmount != null ? (
        <p className="font-data-price text-primary mt-sm">
          Agreed: {r.currency || "GHS"}{" "}
          {Number(r.agreedAmount).toLocaleString()}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-sm mt-md">
        {canAccept ? (
          <Button
            variant="conversion"
            className="!py-sm !px-md text-sm"
            loading={busy}
            onClick={() => onAccept(r._id)}
          >
            Accept / claim
          </Button>
        ) : null}
        {canReject ? (
          <Button
            variant="outline"
            className="!py-sm !px-md text-sm"
            loading={busy}
            onClick={() => onReject(r._id)}
          >
            Decline
          </Button>
        ) : null}
        {canSubmitWork ? (
          <div className="w-full space-y-sm">
            <textarea
              className="w-full min-h-20 bg-surface-container-low border border-outline-variant rounded-md px-md py-md font-sans text-[15px]"
              value={workNote}
              onChange={(e) => onWorkNoteChange(e.target.value)}
              placeholder="Describe completed work (optional)…"
            />
            <Button
              variant="conversion"
              className="!py-sm !px-md text-sm"
              loading={busy}
              onClick={() => onSubmitWork(r._id)}
            >
              Mark work done
            </Button>
          </div>
        ) : null}
        {canApproveWork ? (
          <div className="w-full space-y-sm max-w-xs">
            <Input
              label="Payment amount (GHS)"
              type="number"
              min={0}
              value={
                approveAmount ||
                (r.budget != null ? String(r.budget) : "")
              }
              onChange={(e) => onApproveAmountChange(e.target.value)}
            />
            <Button
              className="!py-sm !px-md text-sm"
              loading={busy}
              onClick={() => onApproveWork(r._id)}
            >
              Approve work
            </Button>
          </div>
        ) : null}
        {canPay ? (
          <Button
            variant="conversion"
            className="!py-sm !px-md text-sm"
            loading={busy}
            onClick={() => onPay(r._id)}
          >
            Pay worker (Paystack)
          </Button>
        ) : null}
        {r.status === "work_submitted" && isAcceptedWorker ? (
          <p className="font-body-dense text-on-surface-variant">
            Waiting for customer approval.
          </p>
        ) : null}
        {r.status === "work_approved" && isAcceptedWorker ? (
          <p className="font-body-dense text-on-surface-variant">
            Waiting for customer payment.
          </p>
        ) : null}
        {r.status === "paid" && isAcceptedWorker ? (
          <Link href="/account">
            <Button variant="outline" className="!py-sm !px-md text-sm">
              Request payout
            </Button>
          </Link>
        ) : null}
        {canComplete ? (
          <Button
            className="!py-sm !px-md text-sm"
            loading={busy}
            onClick={() => onComplete(r._id)}
          >
            Mark completed
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            variant="outline"
            className="!py-sm !px-md text-sm"
            disabled={busy}
            onClick={() => onEdit(r)}
          >
            Update
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            variant="ghost"
            className="!py-sm !px-md text-sm text-error"
            loading={busy}
            onClick={() => onCancel(r._id)}
          >
            Cancel request
          </Button>
        ) : null}
        <Link href={`/service-requests/${r._id}`}>
          <Button variant="ghost" className="!py-sm !px-md text-sm">
            View details
          </Button>
        </Link>
      </div>
    </article>
  );
}

export default function ServiceRequestsPageContent() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("open");
  const [openBoard, setOpenBoard] = useState<ServiceRequest[]>([]);
  const [myRequests, setMyRequests] = useState<ServiceRequest[]>([]);
  const [directedInbox, setDirectedInbox] = useState<ServiceRequest[]>([]);
  const [inboxBoard, setInboxBoard] = useState<ServiceRequest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"closed" | "create" | "edit">("closed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<RequestForm>(emptyForm());
  const [filterCat, setFilterCat] = useState("");
  const [workNote, setWorkNote] = useState("");
  const [approveAmounts, setApproveAmounts] = useState<Record<string, string>>(
    {}
  );

  const isWorker = Boolean(user?.isSeller || user?.accountModes?.worker);

  const prefillGigId = searchParams.get("gigId") || "";
  const prefillSellerId = searchParams.get("sellerId") || "";
  const shouldOpenCreate = searchParams.get("create") === "1";

  const loadOpenBoard = useCallback(async () => {
    try {
      const q = filterCat ? `?cat=${encodeURIComponent(filterCat)}` : "";
      const res = await api<{ requests: ServiceRequest[] }>(
        `/api/service-requests${q}`,
        { auth: false }
      );
      setOpenBoard(res.requests || []);
    } catch {
      setOpenBoard([]);
    }
  }, [filterCat]);

  const loadMine = useCallback(async () => {
    if (!user) {
      setMyRequests([]);
      return;
    }
    try {
      const res = await api<{ requests: ServiceRequest[] }>(
        "/api/service-requests/mine"
      );
      setMyRequests(res.requests || []);
    } catch {
      setMyRequests([]);
    }
  }, [user]);

  const loadInbox = useCallback(async () => {
    if (!user || !isWorker) {
      setDirectedInbox([]);
      setInboxBoard([]);
      return;
    }
    try {
      const res = await api<{
        directed: ServiceRequest[];
        openBoard: ServiceRequest[];
      }>("/api/service-requests/inbox");
      setDirectedInbox(res.directed || []);
      setInboxBoard(res.openBoard || []);
    } catch {
      setDirectedInbox([]);
      setInboxBoard([]);
    }
  }, [user, isWorker]);

  useEffect(() => {
    api<{ categories?: Category[] } | Category[]>("/api/categories", {
      auth: false,
    }).then((res) => {
      const list = Array.isArray(res) ? res : res.categories || [];
      setCategories(list as Category[]);
      if (list.length) {
        setForm((f) => ({
          ...f,
          cat: f.cat || (list[0] as Category).slug,
        }));
      }
    });
  }, []);

  useEffect(() => {
    if (!shouldOpenCreate || !user) return;
    setTab("mine");
    setMode("create");
    setForm((f) => ({
      ...emptyForm(categories[0]?.slug || f.cat),
      gigId: prefillGigId,
      sellerId: prefillSellerId,
    }));
  }, [shouldOpenCreate, user, prefillGigId, prefillSellerId, categories]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([loadOpenBoard(), loadMine(), loadInbox()]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadOpenBoard, loadMine, loadInbox]);

  useEffect(() => {
    if (!user && tab !== "open") setTab("open");
    if (!isWorker && tab === "inbox") setTab("open");
  }, [user, isWorker, tab]);

  function openCreate() {
    if (!user) {
      router.push("/login?next=/service-requests");
      return;
    }
    setMode("create");
    setEditingId(null);
    setForm(emptyForm(categories[0]?.slug || "plumbing"));
    setTab("mine");
    setError("");
    setMessage("");
  }

  function openEdit(r: ServiceRequest) {
    setMode("edit");
    setEditingId(r._id);
    setForm(formFromRequest(r));
    setTab("mine");
    setError("");
    setMessage("");
  }

  function closeForm() {
    setMode("closed");
    setEditingId(null);
  }

  async function enableWorker() {
    if (!user?._id) return;
    setEnabling(true);
    setError("");
    try {
      await api(`/api/users/update/${user._id}`, {
        method: "PUT",
        body: { isSeller: true },
      });
      refreshUser({ ...user, isSeller: true });
      setMessage("Worker mode enabled. You can accept requests in your inbox.");
      setTab("inbox");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not enable worker mode"
      );
    } finally {
      setEnabling(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    setMessage("");
    const body: Record<string, unknown> = {
      title: form.title,
      description: form.description,
      cat: form.cat,
      city: form.city,
      region: form.region,
      country: "Ghana",
      currency: "GHS",
    };
    if (form.budget.trim()) body.budget = Number(form.budget);
    if (form.preferredDate.trim()) body.preferredDate = form.preferredDate;
    if (form.sellerId.trim()) body.sellerId = form.sellerId.trim();
    if (form.gigId.trim()) body.gigId = form.gigId.trim();

    try {
      if (mode === "edit" && editingId) {
        await api(`/api/service-requests/${editingId}`, {
          method: "PUT",
          body,
        });
        setMessage("Request updated.");
      } else {
        await api("/api/service-requests", { method: "POST", body });
        setMessage(
          form.sellerId.trim()
            ? "Directed request sent to the worker."
            : "Request posted to the open board."
        );
      }
      closeForm();
      setTab("mine");
      await Promise.all([loadOpenBoard(), loadMine(), loadInbox()]);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not save request"
      );
    } finally {
      setSaving(false);
    }
  }

  async function runAction(id: string, fn: () => Promise<void>, ok: string) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(ok);
      if (editingId === id) closeForm();
      await Promise.all([loadOpenBoard(), loadMine(), loadInbox()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function handleAccept(id: string) {
    const note = window.prompt("Optional note for the customer:") || undefined;
    runAction(
      id,
      () =>
        api(`/api/service-requests/${id}/accept`, {
          method: "PUT",
          body: note ? { note } : {},
        }).then(() => undefined),
      "Request accepted"
    );
  }

  function handleReject(id: string) {
    const note = window.prompt("Optional reason for declining:") || undefined;
    runAction(
      id,
      () =>
        api(`/api/service-requests/${id}/reject`, {
          method: "PUT",
          body: note ? { note } : {},
        }).then(() => undefined),
      "Request declined"
    );
  }

  function handleComplete(id: string) {
    if (!window.confirm("Close this request as completed?")) return;
    runAction(
      id,
      () =>
        api(`/api/service-requests/${id}/complete`, {
          method: "PUT",
          body: {},
        }).then(() => undefined),
      "Request completed"
    );
  }

  function handleSubmitWork(id: string) {
    runAction(
      id,
      () =>
        api(`/api/service-requests/${id}/submit-work`, {
          method: "PUT",
          body: workNote.trim() ? { note: workNote.trim() } : {},
        }).then(() => undefined),
      "Work submitted for approval"
    );
    setWorkNote("");
  }

  function handleApproveWork(id: string) {
    const amountRaw = approveAmounts[id] ?? "";
    const body: Record<string, unknown> = {};
    if (amountRaw.trim()) body.amount = Number(amountRaw);
    runAction(
      id,
      () =>
        api(`/api/service-requests/${id}/approve-work`, {
          method: "PUT",
          body,
        }).then(() => undefined),
      "Work approved — proceed to payment"
    );
  }

  async function handlePay(id: string) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      const res = await api<{ authorization_url?: string }>(
        `/api/service-requests/${id}/payment-intent`,
        { method: "POST", body: {} }
      );
      if (res.authorization_url) {
        window.location.href = res.authorization_url;
        return;
      }
      setMessage("Payment started.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start payment");
    } finally {
      setBusyId(null);
    }
  }

  function handleCancel(id: string) {
    if (!window.confirm("Cancel this service request?")) return;
    runAction(
      id,
      () =>
        api(`/api/service-requests/${id}`, { method: "DELETE" }).then(
          () => undefined
        ),
      "Request cancelled"
    );
  }

  const pageTitle = useMemo(() => {
    if (tab === "mine") return "My service requests";
    if (tab === "inbox") return "Worker inbox";
    return "Open service requests";
  }, [tab]);

  const cardProps = {
    userId: user?._id,
    isWorker,
    busyId,
    onAccept: handleAccept,
    onReject: handleReject,
    onSubmitWork: handleSubmitWork,
    onApproveWork: handleApproveWork,
    onPay: handlePay,
    onComplete: handleComplete,
    onCancel: handleCancel,
    onEdit: openEdit,
    workNote,
    onWorkNoteChange: setWorkNote,
  };

  function cardExtra(r: ServiceRequest) {
    return {
      approveAmount: approveAmounts[r._id] ?? "",
      onApproveAmountChange: (v: string) =>
        setApproveAmounts((prev) => ({ ...prev, [r._id]: v })),
    };
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MarketplaceNav />
        <main className="max-w-container mx-auto p-lg">
          <p className="text-on-surface-variant">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNav />
      <main className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-lg">
        <div className="flex flex-wrap items-end justify-between gap-md mb-lg">
          <div>
            <p className="font-label-caps text-on-surface-variant mb-xs">
              Customer demand
            </p>
            <h1 className="font-page-title text-primary">{pageTitle}</h1>
            <p className="font-body-dense text-on-surface-variant mt-xs max-w-xl">
              Post what you need done, or claim open requests as a worker. Directed
              requests go to a specific provider; open-board posts any worker can
              accept.
            </p>
          </div>
          <div className="flex flex-wrap gap-sm">
            {!user ? (
              <Link href="/login?next=/service-requests">
                <Button variant="outline">Log in to post or respond</Button>
              </Link>
            ) : (
              <>
                {!isWorker ? (
                  <Button
                    variant="outline"
                    loading={enabling}
                    onClick={enableWorker}
                  >
                    Become a worker
                  </Button>
                ) : null}
                <Button
                  variant="conversion"
                  onClick={() =>
                    mode === "closed" ? openCreate() : closeForm()
                  }
                >
                  {mode === "closed" ? "Post a request" : "Close form"}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-md mb-lg border-b border-outline-variant">
          <button
            type="button"
            className={`pb-sm font-body-dense ${
              tab === "open"
                ? "font-semibold text-primary border-b-2 border-primary"
                : "text-on-surface-variant"
            }`}
            onClick={() => setTab("open")}
          >
            Open board
          </button>
          {user ? (
            <button
              type="button"
              className={`pb-sm font-body-dense ${
                tab === "mine"
                  ? "font-semibold text-primary border-b-2 border-primary"
                  : "text-on-surface-variant"
              }`}
              onClick={() => setTab("mine")}
            >
              My requests ({myRequests.length})
            </button>
          ) : null}
          {isWorker ? (
            <button
              type="button"
              className={`pb-sm font-body-dense ${
                tab === "inbox"
                  ? "font-semibold text-primary border-b-2 border-primary"
                  : "text-on-surface-variant"
              }`}
              onClick={() => setTab("inbox")}
            >
              Worker inbox ({directedInbox.length + inboxBoard.length})
            </button>
          ) : null}
        </div>

        {error ? <p className="text-error mb-md">{error}</p> : null}
        {message ? (
          <p className="font-body-dense text-on-primary-fixed-variant mb-md">
            {message}
          </p>
        ) : null}

        {mode !== "closed" && user ? (
          <form
            onSubmit={onSubmit}
            className="mb-lg p-md bg-surface-container-lowest border border-outline-variant rounded-card space-y-md max-w-xl"
          >
            <h2 className="font-section-title text-primary">
              {mode === "edit" ? "Update request" : "New service request"}
            </h2>
            <Input
              label="Title"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              required
              maxLength={140}
            />
            <div className="space-y-xs">
              <label
                htmlFor="request-description"
                className="font-label-caps text-on-surface-variant block"
              >
                Description
              </label>
              <textarea
                id="request-description"
                className="w-full min-h-28 bg-surface-container-low border border-outline-variant rounded-md px-md py-md font-sans text-[15px] focus:outline-none focus:ring-1 focus:border-primary-container focus:ring-primary-container"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="font-label-caps text-on-surface-variant block mb-xs">
                Category
              </label>
              <select
                className="w-full h-12 bg-surface-container-low border border-outline-variant rounded-md px-md"
                value={form.cat}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cat: e.target.value }))
                }
              >
                {categories.length ? (
                  categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.label}
                    </option>
                  ))
                ) : (
                  <option value="plumbing">Plumbing</option>
                )}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-md">
              <Input
                label="City"
                value={form.city}
                onChange={(e) =>
                  setForm((f) => ({ ...f, city: e.target.value }))
                }
              />
              <Input
                label="Region"
                value={form.region}
                onChange={(e) =>
                  setForm((f) => ({ ...f, region: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-md">
              <Input
                label="Budget (GHS, optional)"
                type="number"
                min={0}
                value={form.budget}
                onChange={(e) =>
                  setForm((f) => ({ ...f, budget: e.target.value }))
                }
              />
              <Input
                label="Preferred date (optional)"
                type="date"
                value={form.preferredDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, preferredDate: e.target.value }))
                }
              />
            </div>
            {mode === "create" ? (
              <>
                <Input
                  label="Worker ID (optional — direct to one provider)"
                  value={form.sellerId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sellerId: e.target.value }))
                  }
                  placeholder="Leave blank for open board"
                />
                <Input
                  label="Related gig ID (optional)"
                  value={form.gigId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, gigId: e.target.value }))
                  }
                />
                {form.sellerId || form.gigId ? (
                  <p className="font-body-dense text-on-surface-variant">
                    This request will be sent directly to the worker instead of
                    the public board.
                  </p>
                ) : null}
              </>
            ) : null}
            <Button type="submit" loading={saving}>
              {mode === "edit" ? "Save changes" : "Post request"}
            </Button>
          </form>
        ) : null}

        {tab === "open" && !loading ? (
          <div className="mb-md max-w-xs">
            <label className="font-label-caps text-on-surface-variant block mb-xs">
              Filter category
            </label>
            <select
              className="w-full h-12 bg-surface-container-low border border-outline-variant rounded-md px-md"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {loading ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : tab === "mine" ? (
          myRequests.length === 0 ? (
            <EmptyState
              title="No requests yet"
              description="Describe the work you need and post to the open board or send directly to a worker."
              action={
                user ? (
                  <Button onClick={openCreate}>Post a request</Button>
                ) : null
              }
            />
          ) : (
            <div className="grid gap-md">
              {myRequests.map((r) => (
                <RequestCard
                  key={r._id}
                  request={r}
                  showDirectedLabel
                  {...cardProps}
                  {...cardExtra(r)}
                />
              ))}
            </div>
          )
        ) : tab === "inbox" ? (
          directedInbox.length === 0 && inboxBoard.length === 0 ? (
            <EmptyState
              title="Inbox is empty"
              description="Directed requests and open-board posts you can claim will appear here."
            />
          ) : (
            <div className="space-y-lg">
              {directedInbox.length > 0 ? (
                <section>
                  <h2 className="font-section-title text-primary mb-md">
                    Directed to you
                  </h2>
                  <div className="grid gap-md">
                    {directedInbox.map((r) => (
                      <RequestCard
                        key={r._id}
                        request={r}
                        showDirectedLabel
                        {...cardProps}
                        {...cardExtra(r)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
              {inboxBoard.length > 0 ? (
                <section>
                  <h2 className="font-section-title text-primary mb-md">
                    Open board (claim)
                  </h2>
                  <div className="grid gap-md">
                    {inboxBoard.map((r) => (
                      <RequestCard key={r._id} request={r} {...cardProps} {...cardExtra(r)} />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )
        ) : openBoard.length === 0 ? (
          <EmptyState
            title="No open requests"
            description="Be the first to post what you need done."
            action={
              user ? (
                <Button onClick={openCreate}>Post a request</Button>
              ) : (
                <Link href="/login?next=/service-requests">
                  <Button>Log in to post</Button>
                </Link>
              )
            }
          />
        ) : (
          <div className="grid gap-md">
            {openBoard.map((r) => (
              <RequestCard key={r._id} request={r} {...cardProps} {...cardExtra(r)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

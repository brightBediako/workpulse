"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { CoverImageField } from "@/components/ui/CoverImageField";
import { api, ApiError, getApiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Category, Job } from "@/lib/types";

function mediaUrl(url?: string) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${getApiUrl()}${url}`;
  return url;
}

const EMPLOYMENT_TYPES = [
  { value: "one_time", label: "One-time" },
  { value: "short_term", label: "Short-term" },
  { value: "contract", label: "Contract" },
  { value: "full_time", label: "Full-time" },
] as const;

type JobForm = {
  title: string;
  description: string;
  cat: string;
  city: string;
  region: string;
  budgetMin: string;
  budgetMax: string;
  employmentType: string;
  positions: string;
  cover: string;
};

type ApplicationRow = {
  _id: string;
  jobId: string;
  workerId: string;
  status: string;
  coverLetter?: string;
  proposedRate?: number;
  reviewNote?: string;
  createdAt?: string;
  job?: Job | null;
  worker?: {
    _id?: string;
    username?: string;
    email?: string;
    phone?: string;
    isVerified?: boolean;
  } | null;
};

type Tab = "open" | "applications" | "mine";

const emptyForm = (cat = "plumbing"): JobForm => ({
  title: "",
  description: "",
  cat,
  city: "Accra",
  region: "Greater Accra",
  budgetMin: "",
  budgetMax: "",
  employmentType: "one_time",
  positions: "1",
  cover: "",
});

function formFromJob(j: Job): JobForm {
  return {
    title: j.title || "",
    description: j.description || "",
    cat: j.cat || "plumbing",
    city: j.location?.city || "Accra",
    region: j.location?.region || "Greater Accra",
    budgetMin: j.budgetMin != null ? String(j.budgetMin) : "",
    budgetMax: j.budgetMax != null ? String(j.budgetMax) : "",
    employmentType: j.employmentType || "one_time",
    positions: String(j.positions ?? 1),
    cover: j.cover || "",
  };
}

export default function JobsPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>("open");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [myApplications, setMyApplications] = useState<ApplicationRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"closed" | "create" | "edit">("closed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [enabling, setEnabling] = useState<"employer" | "worker" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<JobForm>(emptyForm());

  const [applyJobId, setApplyJobId] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [proposedRate, setProposedRate] = useState("");
  const [applying, setApplying] = useState(false);

  const [reviewJobId, setReviewJobId] = useState<string | null>(null);
  const [reviewApps, setReviewApps] = useState<ApplicationRow[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);

  const isEmployer = Boolean(user?.isEmployer || user?.accountModes?.employer);
  const isWorker = Boolean(user?.isSeller || user?.accountModes?.worker);

  const appliedJobIds = useMemo(() => {
    const map = new Map<string, ApplicationRow>();
    for (const a of myApplications) {
      if (a.status !== "withdrawn") map.set(String(a.jobId), a);
    }
    return map;
  }, [myApplications]);

  async function loadOpenJobs() {
    try {
      const res = await api<{ jobs: Job[] }>("/api/jobs", { auth: false });
      setJobs(res.jobs || []);
    } catch {
      setJobs([]);
    }
  }

  async function loadMyJobs() {
    if (!isEmployer) {
      setMyJobs([]);
      return;
    }
    try {
      const res = await api<{ jobs: Job[] }>("/api/jobs/mine");
      setMyJobs(res.jobs || []);
    } catch {
      setMyJobs([]);
    }
  }

  async function loadMyApplications() {
    if (!user) {
      setMyApplications([]);
      return;
    }
    try {
      const res = await api<{ applications: ApplicationRow[] }>(
        "/api/jobs/applications/mine"
      );
      setMyApplications(res.applications || []);
    } catch {
      setMyApplications([]);
    }
  }

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
    let cancelled = false;
    setLoading(true);
    Promise.all([
      loadOpenJobs(),
      loadMyJobs(),
      loadMyApplications(),
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, isEmployer, isWorker]);

  useEffect(() => {
    if (!isEmployer && tab === "mine") setTab("open");
    if (!user && tab === "applications") setTab("open");
  }, [isEmployer, user, tab]);

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setForm(emptyForm(categories[0]?.slug || "plumbing"));
    setTab("mine");
    setError("");
    setMessage("");
  }

  function openEdit(j: Job) {
    setMode("edit");
    setEditingId(j._id);
    setForm(formFromJob(j));
    setTab("mine");
    setError("");
    setMessage("");
  }

  function closeForm() {
    setMode("closed");
    setEditingId(null);
  }

  async function enableEmployer() {
    if (!user) return;
    setEnabling("employer");
    setError("");
    try {
      const res = await api<{ user?: typeof user; token?: string }>(
        "/api/users/me/employer",
        { method: "PUT", body: { isEmployer: true } }
      );
      if (res.user) refreshUser(res.user);
      else refreshUser({ ...user, isEmployer: true });
      setMessage("Employer mode enabled. You can post jobs now.");
      openCreate();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not enable employer mode"
      );
    } finally {
      setEnabling(null);
    }
  }

  async function enableWorker() {
    if (!user?._id) return;
    setEnabling("worker");
    setError("");
    try {
      await api(`/api/users/update/${user._id}`, {
        method: "PUT",
        body: { isSeller: true },
      });
      refreshUser({ ...user, isSeller: true });
      setMessage("Worker mode enabled. You can apply to jobs now.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not enable worker mode"
      );
    } finally {
      setEnabling(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const body = {
      title: form.title,
      description: form.description,
      cat: form.cat,
      city: form.city,
      region: form.region,
      country: "Ghana",
      budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
      budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
      employmentType: form.employmentType,
      positions: Number(form.positions) || 1,
      currency: "GHS",
      cover: form.cover.trim() || "",
    };
    try {
      if (mode === "edit" && editingId) {
        await api(`/api/jobs/${editingId}`, { method: "PUT", body });
        setMessage("Job updated.");
      } else {
        await api("/api/jobs", { method: "POST", body });
        setMessage("Job posted.");
      }
      closeForm();
      setTab("mine");
      await Promise.all([loadOpenJobs(), loadMyJobs()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save job");
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
      await Promise.all([loadOpenJobs(), loadMyJobs(), loadMyApplications()]);
      if (reviewJobId === id) await openReview(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function startApply(jobId: string) {
    if (!user) {
      window.location.href = `/login?next=${encodeURIComponent("/jobs")}`;
      return;
    }
    setApplyJobId(jobId);
    setCoverLetter("");
    setProposedRate("");
    setError("");
    setMessage("");
  }

  async function submitApplication(e: FormEvent) {
    e.preventDefault();
    if (!applyJobId) return;
    if (!isWorker) {
      setError("Enable worker mode to apply for jobs.");
      return;
    }
    setApplying(true);
    setError("");
    setMessage("");
    try {
      const body: Record<string, unknown> = {
        coverLetter: coverLetter.trim() || undefined,
      };
      if (proposedRate.trim()) {
        body.proposedRate = Number(proposedRate);
      }
      const res = await api<{ message?: string }>(
        `/api/jobs/${applyJobId}/applications`,
        { method: "POST", body }
      );
      setMessage(res.message || "Application submitted.");
      setApplyJobId(null);
      await Promise.all([loadMyApplications(), loadOpenJobs()]);
      setTab("applications");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not apply");
    } finally {
      setApplying(false);
    }
  }

  async function withdrawApplication(jobId: string, appId: string) {
    if (!window.confirm("Withdraw this application?")) return;
    await runAction(
      appId,
      () =>
        api(`/api/jobs/${jobId}/applications/${appId}/withdraw`, {
          method: "PUT",
        }).then(() => undefined),
      "Application withdrawn"
    );
  }

  async function openReview(jobId: string) {
    setReviewJobId(jobId);
    setLoadingReview(true);
    setError("");
    try {
      const res = await api<{ applications: ApplicationRow[] }>(
        `/api/jobs/${jobId}/applications`
      );
      setReviewApps(res.applications || []);
    } catch (err) {
      setReviewApps([]);
      setError(
        err instanceof ApiError ? err.message : "Could not load applicants"
      );
    } finally {
      setLoadingReview(false);
    }
  }

  async function reviewApp(
    jobId: string,
    appId: string,
    decision: "accept" | "reject"
  ) {
    await runAction(
      appId,
      () =>
        api(`/api/jobs/${jobId}/applications/${appId}/${decision}`, {
          method: "PUT",
          body: {},
        }).then(() => undefined),
      decision === "accept" ? "Applicant accepted" : "Applicant rejected"
    );
  }

  const pageTitle =
    tab === "mine"
      ? "My job posts"
      : tab === "applications"
        ? "My applications"
        : "Open job posts";

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
              Jobs marketplace
            </p>
            <h1 className="font-page-title text-primary">{pageTitle}</h1>
          </div>
          <div className="flex flex-wrap gap-sm">
            {!user ? (
              <Link href="/login?next=/jobs">
                <Button variant="outline">Log in to apply or post</Button>
              </Link>
            ) : (
              <>
                {!isWorker ? (
                  <Button
                    variant="outline"
                    loading={enabling === "worker"}
                    onClick={enableWorker}
                  >
                    Become a worker
                  </Button>
                ) : null}
                {!isEmployer ? (
                  <Button
                    variant="conversion"
                    loading={enabling === "employer"}
                    onClick={enableEmployer}
                  >
                    Enable employer mode
                  </Button>
                ) : (
                  <Button
                    variant="conversion"
                    onClick={() =>
                      mode === "closed" ? openCreate() : closeForm()
                    }
                  >
                    {mode === "closed" ? "Post a job" : "Close form"}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {user ? (
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
              Browse open
            </button>
            <button
              type="button"
              className={`pb-sm font-body-dense ${
                tab === "applications"
                  ? "font-semibold text-primary border-b-2 border-primary"
                  : "text-on-surface-variant"
              }`}
              onClick={() => setTab("applications")}
            >
              My applications ({myApplications.length})
            </button>
            {isEmployer ? (
              <button
                type="button"
                className={`pb-sm font-body-dense ${
                  tab === "mine"
                    ? "font-semibold text-primary border-b-2 border-primary"
                    : "text-on-surface-variant"
                }`}
                onClick={() => setTab("mine")}
              >
                My posts ({myJobs.length})
              </button>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-error mb-md">{error}</p> : null}
        {message ? (
          <p className="font-body-dense text-on-primary-fixed-variant mb-md">
            {message}
          </p>
        ) : null}

        {mode !== "closed" && isEmployer ? (
          <form
            onSubmit={onSubmit}
            className="mb-lg p-md bg-surface-container-lowest border border-outline-variant rounded-card space-y-md max-w-xl"
          >
            <h2 className="font-section-title text-primary">
              {mode === "edit" ? "Update job" : "New job post"}
            </h2>
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
            <div className="space-y-xs">
              <label
                htmlFor="job-description"
                className="font-label-caps text-on-surface-variant block"
              >
                Description
              </label>
              <textarea
                id="job-description"
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
                onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))}
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
            <div>
              <label className="font-label-caps text-on-surface-variant block mb-xs">
                Employment type
              </label>
              <select
                className="w-full h-12 bg-surface-container-low border border-outline-variant rounded-md px-md"
                value={form.employmentType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, employmentType: e.target.value }))
                }
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
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
                label="Budget min (GHS)"
                type="number"
                min={0}
                value={form.budgetMin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, budgetMin: e.target.value }))
                }
              />
              <Input
                label="Budget max (GHS)"
                type="number"
                min={0}
                value={form.budgetMax}
                onChange={(e) =>
                  setForm((f) => ({ ...f, budgetMax: e.target.value }))
                }
              />
            </div>
            <Input
              label="Positions"
              type="number"
              min={1}
              max={50}
              value={form.positions}
              onChange={(e) =>
                setForm((f) => ({ ...f, positions: e.target.value }))
              }
            />
            <CoverImageField
              label="Job cover image"
              value={form.cover}
              onChange={(cover) => setForm((f) => ({ ...f, cover }))}
              required={false}
            />
            <Button type="submit" loading={saving}>
              {mode === "edit" ? "Save changes" : "Publish job"}
            </Button>
          </form>
        ) : null}

        {loading ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : tab === "applications" ? (
          myApplications.length === 0 ? (
            <EmptyState
              title="No applications yet"
              description="Browse open jobs and apply with a short cover letter."
              action={
                <Button onClick={() => setTab("open")}>Browse open jobs</Button>
              }
            />
          ) : (
            <div className="grid gap-md">
              {myApplications.map((a) => (
                <article
                  key={a._id}
                  className="p-md border border-outline-variant rounded-card bg-surface-container-lowest"
                >
                  <div className="flex flex-wrap items-start justify-between gap-sm mb-sm">
                    <h2 className="font-section-title text-primary">
                      {a.job?.title || "Job"}
                    </h2>
                    <StatusChip status={a.status} />
                  </div>
                  <p className="font-body-dense text-on-surface-variant mb-sm">
                    {a.job?.location?.city || ""}
                    {a.job?.cat ? ` · ${a.job.cat}` : ""}
                  </p>
                  {a.coverLetter ? (
                    <p className="font-body-dense text-on-surface mb-sm">
                      {a.coverLetter}
                    </p>
                  ) : null}
                  {a.proposedRate != null ? (
                    <p className="font-data-price text-primary mb-sm">
                      Proposed: GHS {Number(a.proposedRate).toLocaleString()}
                    </p>
                  ) : null}
                  {a.status === "pending" ? (
                    <Button
                      variant="ghost"
                      className="!py-sm !px-md text-sm"
                      loading={busyId === a._id}
                      onClick={() => withdrawApplication(a.jobId, a._id)}
                    >
                      Withdraw
                    </Button>
                  ) : null}
                </article>
              ))}
            </div>
          )
        ) : (tab === "mine" ? myJobs : jobs).length === 0 ? (
          <EmptyState
            title={tab === "mine" ? "No job posts yet" : "No open jobs"}
            description={
              tab === "mine"
                ? "Create your first job post to start hiring."
                : "Check back when employers publish openings."
            }
            action={
              tab === "mine" && isEmployer ? (
                <Button onClick={openCreate}>Post a job</Button>
              ) : null
            }
          />
        ) : (
          <div className="grid gap-md">
            {(tab === "mine" ? myJobs : jobs).map((j) => {
              const busy = busyId === j._id;
              const canManage =
                tab === "mine" &&
                isEmployer &&
                j.status !== "cancelled" &&
                j.status !== "filled";
              const existing = appliedJobIds.get(String(j._id));
              const isOwnJob =
                user && String(j.employerId) === String(user._id);
              const showApply =
                tab === "open" &&
                j.status === "open" &&
                !isOwnJob;

              return (
                <article
                  key={j._id}
                  className="p-md border border-outline-variant rounded-card bg-surface-container-lowest"
                >
                  {j.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrl(j.cover)}
                      alt=""
                      className="w-full h-36 object-cover rounded-md mb-md bg-surface-container"
                    />
                  ) : null}
                  <div className="flex flex-wrap items-start justify-between gap-sm mb-sm">
                    <h2 className="font-section-title text-primary">{j.title}</h2>
                    <StatusChip status={j.status} />
                  </div>
                  <p className="font-body-dense text-on-surface-variant line-clamp-3 mb-sm">
                    {j.description}
                  </p>
                  <p className="font-label-caps text-on-surface-variant">
                    {j.cat}
                    {j.location?.city ? ` · ${j.location.city}` : ""}
                    {j.employmentType
                      ? ` · ${j.employmentType.replace(/_/g, " ")}`
                      : ""}
                  </p>
                  {(j.budgetMin != null || j.budgetMax != null) && (
                    <p className="font-data-price mt-sm text-primary">
                      {j.currency || "GHS"} {j.budgetMin ?? "—"}–
                      {j.budgetMax ?? "—"}
                    </p>
                  )}

                  {showApply ? (
                    <div className="mt-md space-y-md">
                      {existing ? (
                        <div className="flex flex-wrap items-center gap-sm">
                          <StatusChip
                            status={existing.status}
                            label={`Applied · ${existing.status}`}
                          />
                          {existing.status === "pending" ? (
                            <Button
                              variant="ghost"
                              className="!py-sm !px-md text-sm"
                              loading={busyId === existing._id}
                              onClick={() =>
                                withdrawApplication(j._id, existing._id)
                              }
                            >
                              Withdraw
                            </Button>
                          ) : null}
                        </div>
                      ) : applyJobId === j._id ? (
                        <form
                          onSubmit={submitApplication}
                          className="p-md rounded-md border border-outline-variant bg-surface-container-low space-y-md max-w-lg"
                        >
                          {!isWorker ? (
                            <p className="font-body-dense text-on-surface-variant">
                              Enable worker mode to submit an application.
                            </p>
                          ) : null}
                          <div className="space-y-xs">
                            <label className="font-label-caps text-on-surface-variant block">
                              Cover letter
                            </label>
                            <textarea
                              className="w-full min-h-24 bg-surface-container-lowest border border-outline-variant rounded-md px-md py-md font-sans text-[15px] focus:outline-none focus:ring-1 focus:border-primary-container focus:ring-primary-container"
                              value={coverLetter}
                              onChange={(e) => setCoverLetter(e.target.value)}
                              placeholder="Why you're a fit for this job…"
                              maxLength={2000}
                            />
                          </div>
                          <Input
                            label="Proposed rate (GHS, optional)"
                            type="number"
                            min={0}
                            value={proposedRate}
                            onChange={(e) => setProposedRate(e.target.value)}
                          />
                          <div className="flex flex-wrap gap-sm">
                            <Button
                              type="submit"
                              variant="conversion"
                              loading={applying}
                              disabled={!isWorker}
                            >
                              Submit application
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setApplyJobId(null)}
                            >
                              Cancel
                            </Button>
                            {!isWorker ? (
                              <Button
                                type="button"
                                variant="outline"
                                loading={enabling === "worker"}
                                onClick={enableWorker}
                              >
                                Become a worker
                              </Button>
                            ) : null}
                          </div>
                        </form>
                      ) : (
                        <Button
                          variant="conversion"
                          className="!py-sm !px-md text-sm"
                          onClick={() => startApply(j._id)}
                        >
                          Apply
                        </Button>
                      )}
                    </div>
                  ) : null}

                  {canManage ? (
                    <div className="flex flex-wrap gap-sm mt-md">
                      <Button
                        variant="outline"
                        className="!py-sm !px-md text-sm"
                        disabled={busy}
                        onClick={() => openEdit(j)}
                      >
                        Update
                      </Button>
                      <Button
                        variant="outline"
                        className="!py-sm !px-md text-sm"
                        loading={loadingReview && reviewJobId === j._id}
                        onClick={() =>
                          reviewJobId === j._id
                            ? setReviewJobId(null)
                            : openReview(j._id)
                        }
                      >
                        {reviewJobId === j._id
                          ? "Hide applicants"
                          : `Applicants (${j.applicationCount ?? 0})`}
                      </Button>
                      {j.status === "suspended" || j.status === "closed" ? (
                        <Button
                          variant="conversion"
                          className="!py-sm !px-md text-sm"
                          loading={busy}
                          onClick={() =>
                            runAction(
                              j._id,
                              () =>
                                api(`/api/jobs/${j._id}`, {
                                  method: "PUT",
                                  body: { status: "open" },
                                }).then(() => undefined),
                              "Job resumed (open)"
                            )
                          }
                        >
                          Resume
                        </Button>
                      ) : j.status === "open" ? (
                        <Button
                          variant="outline"
                          className="!py-sm !px-md text-sm"
                          loading={busy}
                          onClick={() =>
                            runAction(
                              j._id,
                              () =>
                                api(`/api/jobs/${j._id}`, {
                                  method: "PUT",
                                  body: { status: "suspended" },
                                }).then(() => undefined),
                              "Job suspended"
                            )
                          }
                        >
                          Suspend
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        className="!py-sm !px-md text-sm text-error"
                        loading={busy}
                        onClick={() => {
                          if (!window.confirm(`Delete job "${j.title}"?`))
                            return;
                          runAction(
                            j._id,
                            () =>
                              api(`/api/jobs/${j._id}`, {
                                method: "DELETE",
                              }).then(() => undefined),
                            "Job deleted"
                          );
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  ) : null}

                  {tab === "mine" && reviewJobId === j._id ? (
                    <div className="mt-md pt-md border-t border-surface-container-low space-y-sm">
                      <h3 className="font-label-caps text-on-surface-variant">
                        Applicants
                      </h3>
                      {loadingReview ? (
                        <p className="font-body-dense text-on-surface-variant">
                          Loading…
                        </p>
                      ) : reviewApps.length === 0 ? (
                        <p className="font-body-dense text-on-surface-variant">
                          No applications yet.
                        </p>
                      ) : (
                        reviewApps.map((a) => (
                          <div
                            key={a._id}
                            className="p-md rounded-md border border-outline-variant bg-surface-container-low space-y-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-sm">
                              <div>
                                <p className="font-semibold text-primary">
                                  {a.worker?.username || "Worker"}
                                </p>
                                <p className="font-body-dense text-on-surface-variant">
                                  {a.worker?.email || ""}
                                  {a.worker?.phone
                                    ? ` · ${a.worker.phone}`
                                    : ""}
                                </p>
                              </div>
                              <StatusChip status={a.status} />
                            </div>
                            {a.coverLetter ? (
                              <p className="font-body-dense">{a.coverLetter}</p>
                            ) : null}
                            {a.proposedRate != null ? (
                              <p className="font-data-price text-primary">
                                Proposed: GHS{" "}
                                {Number(a.proposedRate).toLocaleString()}
                              </p>
                            ) : null}
                            {a.status === "pending" ? (
                              <div className="flex flex-wrap gap-sm">
                                <Button
                                  className="!py-sm !px-md text-sm"
                                  loading={busyId === a._id}
                                  onClick={() =>
                                    reviewApp(j._id, a._id, "accept")
                                  }
                                >
                                  Accept
                                </Button>
                                <Button
                                  variant="outline"
                                  className="!py-sm !px-md text-sm"
                                  loading={busyId === a._id}
                                  onClick={() =>
                                    reviewApp(j._id, a._id, "reject")
                                  }
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { api, ApiError, getApiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";

type Profile = User & {
  serviceCity?: string;
  serviceRegion?: string;
  serviceCountry?: string;
  companyDesc?: string | null;
  payoutMethod?: string;
  payoutProvider?: string | null;
  payoutAccountName?: string | null;
  payoutAccountNumber?: string | null;
  verificationDocuments?: string[];
  verificationSubmittedAt?: string | null;
  adminNotes?: string | null;
};

type Earnings = {
  totalEarnings: number;
  totalGross: number;
  totalPlatformFees: number;
  completedOrders: number;
  currency: string;
  recentOrders: Array<{
    _id: string;
    title: string;
    price?: number;
    sellerEarnings?: number;
    platformFee?: number;
    createdAt?: string;
  }>;
};

type Verification = {
  isVerified?: boolean;
  verificationStatus?: string;
  verificationDocuments?: string[];
  verificationSubmittedAt?: string | null;
  adminNotes?: string | null;
};

function money(n?: number, currency = "GHS") {
  if (n == null || Number.isNaN(n)) return "—";
  return `${currency} ${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function docHref(url: string) {
  if (url.startsWith("http")) return url;
  return `${getApiUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function AccountPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [savingVerify, setSavingVerify] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [details, setDetails] = useState({
    username: "",
    email: "",
    phone: "",
    address: "",
    country: "Ghana",
    desc: "",
    serviceCity: "",
    serviceRegion: "",
    companyName: "",
    companyDesc: "",
  });

  const [payout, setPayout] = useState({
    payoutMethod: "none",
    payoutProvider: "",
    payoutAccountName: "",
    payoutAccountNumber: "",
  });

  const [pendingDocs, setPendingDocs] = useState<string[]>([]);

  const isWorker = Boolean(user?.isSeller);
  const isEmployer = Boolean(user?.isEmployer);
  const canManageBiz = isWorker || isEmployer;

  async function loadAll() {
    if (!user) return;
    setError("");
    try {
      const me = await api<Profile>("/api/users/me");
      setProfile(me);
      setDetails({
        username: me.username || "",
        email: me.email || "",
        phone: me.phone || "",
        address: me.address || "",
        country: me.country || "Ghana",
        desc: me.desc || "",
        serviceCity: me.serviceCity || "",
        serviceRegion: me.serviceRegion || "",
        companyName: me.companyName || "",
        companyDesc: me.companyDesc || "",
      });
      setPayout({
        payoutMethod: me.payoutMethod || "none",
        payoutProvider: me.payoutProvider || "",
        payoutAccountName: me.payoutAccountName || "",
        payoutAccountNumber: me.payoutAccountNumber || "",
      });
      refreshUser({
        ...user,
        ...me,
        _id: me._id || user._id,
      });

      if (canManageBiz) {
        const v = await api<Verification>("/api/users/me/verification");
        setVerification(v);
        setPendingDocs(v.verificationDocuments || []);
      }

      if (isWorker) {
        const e = await api<Earnings>("/api/users/me/earnings");
        setEarnings(e);
      } else {
        setEarnings(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load account");
    }
  }

  useEffect(() => {
    if (user) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, user?.isSeller, user?.isEmployer]);

  async function onSaveDetails(e: FormEvent) {
    e.preventDefault();
    if (!user?._id) return;
    setSavingProfile(true);
    setError("");
    setMessage("");
    try {
      const body: Record<string, unknown> = {
        username: details.username,
        email: details.email,
        phone: details.phone,
        address: details.address,
        country: details.country,
        desc: details.desc,
      };
      if (isWorker) {
        body.serviceCity = details.serviceCity;
        body.serviceRegion = details.serviceRegion;
      }
      if (isEmployer) {
        await api("/api/users/me/employer", {
          method: "PUT",
          body: {
            isEmployer: true,
            companyName: details.companyName,
            companyDesc: details.companyDesc,
          },
        });
      }
      const updated = await api<Profile>(`/api/users/update/${user._id}`, {
        method: "PUT",
        body,
      });
      setProfile(updated);
      refreshUser({ ...user, ...updated, _id: user._id });
      setMessage("Account details saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save details");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onSavePayout(e: FormEvent) {
    e.preventDefault();
    setSavingPayout(true);
    setError("");
    setMessage("");
    try {
      await api("/api/users/me/payout", {
        method: "PUT",
        body:
          payout.payoutMethod === "none"
            ? { payoutMethod: "none" }
            : {
                payoutMethod: payout.payoutMethod,
                payoutProvider: payout.payoutProvider,
                payoutAccountName: payout.payoutAccountName,
                payoutAccountNumber: payout.payoutAccountNumber,
              },
      });
      setMessage("Payout settings saved.");
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save payout");
    } finally {
      setSavingPayout(false);
    }
  }

  async function onUploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append("documents", f));
      const res = await api<{ documents: string[] }>(
        "/api/users/me/verification/upload",
        { method: "POST", body: form }
      );
      setPendingDocs((prev) => [...new Set([...prev, ...(res.documents || [])])]);
      setMessage("Files uploaded. Click submit for admin review.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmitVerification() {
    setSavingVerify(true);
    setError("");
    setMessage("");
    try {
      const res = await api<Verification & { message?: string }>(
        "/api/users/me/verification",
        {
          method: "PUT",
          body: { documents: pendingDocs },
        }
      );
      setVerification(res);
      setMessage(res.message || "Submitted for admin review.");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not submit verification"
      );
    } finally {
      setSavingVerify(false);
    }
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

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <MarketplaceNav />
        <main className="max-w-container mx-auto p-lg">
          <EmptyState
            title="Sign in to manage your account"
            action={
              <Link href="/login">
                <Button>Log in</Button>
              </Link>
            }
          />
        </main>
      </div>
    );
  }

  if (!canManageBiz) {
    return (
      <div className="min-h-screen bg-background">
        <MarketplaceNav />
        <main className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-lg max-w-2xl">
          <h1 className="font-page-title text-primary mb-md">Account</h1>
          <p className="font-body-main text-on-surface-variant mb-lg">
            Enable worker or employer mode to manage payouts, earnings, and
            verification. You can still update basic details below.
          </p>
          {error ? <p className="text-error mb-md">{error}</p> : null}
          {message ? (
            <p className="font-body-dense text-on-primary-fixed-variant mb-md">
              {message}
            </p>
          ) : null}
          <AccountDetailsForm
            details={details}
            setDetails={setDetails}
            onSave={onSaveDetails}
            saving={savingProfile}
            showWorker={false}
            showEmployer={false}
          />
          <div className="mt-lg flex flex-wrap gap-sm">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await api(`/api/users/update/${user._id}`, {
                    method: "PUT",
                    body: { isSeller: true },
                  });
                  refreshUser({ ...user, isSeller: true });
                  setMessage("Worker mode enabled.");
                } catch (err) {
                  setError(
                    err instanceof ApiError ? err.message : "Could not enable worker"
                  );
                }
              }}
            >
              Become a worker
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const res = await api<{ user?: User; token?: string }>(
                    "/api/users/me/employer",
                    { method: "PUT", body: { isEmployer: true } }
                  );
                  if (res.user) refreshUser(res.user);
                  else refreshUser({ ...user, isEmployer: true });
                  setMessage("Employer mode enabled.");
                } catch (err) {
                  setError(
                    err instanceof ApiError
                      ? err.message
                      : "Could not enable employer"
                  );
                }
              }}
            >
              Become an employer
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNav />
      <main className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-lg space-y-lg">
        <div>
          <h1 className="font-page-title text-primary">Account</h1>
          <p className="font-body-dense text-on-surface-variant mt-xs">
            Profile, payouts, earnings, and verification for{" "}
            {[isWorker && "workers", isEmployer && "employers"]
              .filter(Boolean)
              .join(" & ")}
            .
          </p>
          <div className="flex flex-wrap gap-sm mt-md">
            {profile?.isVerified ? (
              <StatusChip status="verified" />
            ) : (
              <StatusChip
                status={verification?.verificationStatus || "pending"}
              />
            )}
            {isWorker ? <StatusChip status="approved" label="worker" /> : null}
            {isEmployer ? (
              <StatusChip status="open" label="employer" />
            ) : null}
          </div>
        </div>

        {error ? <p className="text-error">{error}</p> : null}
        {message ? (
          <p className="font-body-dense text-on-primary-fixed-variant">
            {message}
          </p>
        ) : null}

        <section id="details" className="space-y-md">
          <h2 className="font-section-title text-primary">Account details</h2>
          <AccountDetailsForm
            details={details}
            setDetails={setDetails}
            onSave={onSaveDetails}
            saving={savingProfile}
            showWorker={isWorker}
            showEmployer={isEmployer}
          />
        </section>

        <section id="payout" className="space-y-md">
          <h2 className="font-section-title text-primary">Payment setup</h2>
          <p className="font-body-dense text-on-surface-variant">
            Where WorkPulse should send your payouts (mobile money or bank).
            Automated withdrawals via Stripe Connect are not live yet — admins
            use these details for manual settlement.
          </p>
          <form
            onSubmit={onSavePayout}
            className="p-md bg-surface-container-lowest border border-outline-variant rounded-card space-y-md max-w-xl"
          >
            <div>
              <label className="font-label-caps text-on-surface-variant block mb-xs">
                Method
              </label>
              <select
                className="w-full h-12 bg-surface-container-low border border-outline-variant rounded-md px-md"
                value={payout.payoutMethod}
                onChange={(e) =>
                  setPayout((p) => ({ ...p, payoutMethod: e.target.value }))
                }
              >
                <option value="none">Not set</option>
                <option value="mobile_money">Mobile money</option>
                <option value="bank">Bank account</option>
              </select>
            </div>
            {payout.payoutMethod !== "none" ? (
              <>
                <Input
                  label={
                    payout.payoutMethod === "mobile_money"
                      ? "Provider (MTN, Telecel, AirtelTigo…)"
                      : "Bank name"
                  }
                  value={payout.payoutProvider}
                  onChange={(e) =>
                    setPayout((p) => ({ ...p, payoutProvider: e.target.value }))
                  }
                  required
                />
                <Input
                  label="Account name"
                  value={payout.payoutAccountName}
                  onChange={(e) =>
                    setPayout((p) => ({
                      ...p,
                      payoutAccountName: e.target.value,
                    }))
                  }
                  required
                />
                <Input
                  label={
                    payout.payoutMethod === "mobile_money"
                      ? "MoMo number"
                      : "Account number"
                  }
                  value={payout.payoutAccountNumber}
                  onChange={(e) =>
                    setPayout((p) => ({
                      ...p,
                      payoutAccountNumber: e.target.value,
                    }))
                  }
                  required
                />
              </>
            ) : null}
            <Button type="submit" loading={savingPayout}>
              Save payout details
            </Button>
          </form>
        </section>

        {isWorker ? (
          <section id="earnings" className="space-y-md">
            <h2 className="font-section-title text-primary">Earnings</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
              <Stat
                label="Net earnings"
                value={money(earnings?.totalEarnings, earnings?.currency)}
              />
              <Stat
                label="Gross sales"
                value={money(earnings?.totalGross, earnings?.currency)}
              />
              <Stat
                label="Platform fees"
                value={money(earnings?.totalPlatformFees, earnings?.currency)}
              />
              <Stat
                label="Completed orders"
                value={String(earnings?.completedOrders ?? "—")}
              />
            </div>
            <div className="space-y-sm">
              <h3 className="font-label-caps text-on-surface-variant">
                Recent paid orders
              </h3>
              {!earnings?.recentOrders?.length ? (
                <p className="font-body-dense text-on-surface-variant">
                  No completed orders yet.
                </p>
              ) : (
                earnings.recentOrders.map((o) => (
                  <div
                    key={o._id}
                    className="p-sm bg-surface-container-lowest border border-outline-variant rounded-md flex justify-between gap-md"
                  >
                    <div className="min-w-0">
                      <p className="font-body-dense font-semibold truncate">
                        {o.title}
                      </p>
                      <p className="font-body-dense text-on-surface-variant">
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleDateString()
                          : ""}
                      </p>
                    </div>
                    <p className="font-data-price shrink-0">
                      {money(o.sellerEarnings)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}

        <section id="verification" className="space-y-md">
          <h2 className="font-section-title text-primary">
            Verification documents
          </h2>
          <p className="font-body-dense text-on-surface-variant">
            Upload ID or business documents for admin review. PDF, PNG, JPG, or
            WEBP — max 5 MB each.
          </p>
          <div className="p-md bg-surface-container-lowest border border-outline-variant rounded-card space-y-md max-w-xl">
            <div className="flex flex-wrap items-center gap-sm">
              <StatusChip
                status={
                  verification?.isVerified
                    ? "verified"
                    : verification?.verificationStatus || "pending"
                }
              />
              {verification?.verificationSubmittedAt ? (
                <span className="font-body-dense text-on-surface-variant">
                  Submitted{" "}
                  {new Date(
                    verification.verificationSubmittedAt
                  ).toLocaleString()}
                </span>
              ) : null}
            </div>
            {verification?.adminNotes ? (
              <p className="font-body-dense text-error">
                Admin note: {verification.adminNotes}
              </p>
            ) : null}
            {pendingDocs.length ? (
              <ul className="space-y-xs">
                {pendingDocs.map((doc) => (
                  <li key={doc}>
                    <a
                      href={docHref(doc)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-body-dense text-primary-container hover:underline break-all"
                    >
                      {doc}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-body-dense text-on-surface-variant">
                No documents yet.
              </p>
            )}
            {!verification?.isVerified ? (
              <>
                <Input
                  label="Upload files"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                  multiple
                  disabled={uploading}
                  onChange={(e) => onUploadFiles(e.target.files)}
                />
                <Button
                  type="button"
                  loading={savingVerify || uploading}
                  disabled={!pendingDocs.length}
                  onClick={onSubmitVerification}
                >
                  Submit for admin review
                </Button>
              </>
            ) : (
              <p className="font-body-dense text-on-surface-variant">
                Your account is verified. Contact support to change documents.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-md bg-surface-container-lowest border border-outline-variant rounded-card">
      <p className="font-label-caps text-on-surface-variant mb-xs">{label}</p>
      <p className="font-data-price text-lg text-primary">{value}</p>
    </div>
  );
}

function AccountDetailsForm({
  details,
  setDetails,
  onSave,
  saving,
  showWorker,
  showEmployer,
}: {
  details: {
    username: string;
    email: string;
    phone: string;
    address: string;
    country: string;
    desc: string;
    serviceCity: string;
    serviceRegion: string;
    companyName: string;
    companyDesc: string;
  };
  setDetails: React.Dispatch<
    React.SetStateAction<{
      username: string;
      email: string;
      phone: string;
      address: string;
      country: string;
      desc: string;
      serviceCity: string;
      serviceRegion: string;
      companyName: string;
      companyDesc: string;
    }>
  >;
  onSave: (e: FormEvent) => void;
  saving: boolean;
  showWorker: boolean;
  showEmployer: boolean;
}) {
  return (
    <form
      onSubmit={onSave}
      className="p-md bg-surface-container-lowest border border-outline-variant rounded-card space-y-md max-w-xl"
    >
      <Input
        label="Name"
        value={details.username}
        onChange={(e) =>
          setDetails((d) => ({ ...d, username: e.target.value }))
        }
        required
      />
      <Input
        label="Email"
        type="email"
        value={details.email}
        onChange={(e) => setDetails((d) => ({ ...d, email: e.target.value }))}
        required
      />
      <Input
        label="Phone"
        value={details.phone}
        onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))}
        hint="International format, e.g. +233 24 123 4567"
        required
      />
      <Input
        label="Address / location"
        value={details.address}
        onChange={(e) => setDetails((d) => ({ ...d, address: e.target.value }))}
        required
      />
      <Input
        label="Country"
        value={details.country}
        onChange={(e) => setDetails((d) => ({ ...d, country: e.target.value }))}
        required
      />
      <Input
        label="Bio"
        value={details.desc}
        onChange={(e) => setDetails((d) => ({ ...d, desc: e.target.value }))}
      />
      {showWorker ? (
        <>
          <Input
            label="Service city"
            value={details.serviceCity}
            onChange={(e) =>
              setDetails((d) => ({ ...d, serviceCity: e.target.value }))
            }
          />
          <Input
            label="Service region"
            value={details.serviceRegion}
            onChange={(e) =>
              setDetails((d) => ({ ...d, serviceRegion: e.target.value }))
            }
          />
        </>
      ) : null}
      {showEmployer ? (
        <>
          <Input
            label="Company name"
            value={details.companyName}
            onChange={(e) =>
              setDetails((d) => ({ ...d, companyName: e.target.value }))
            }
          />
          <Input
            label="Company description"
            value={details.companyDesc}
            onChange={(e) =>
              setDetails((d) => ({ ...d, companyDesc: e.target.value }))
            }
          />
        </>
      ) : null}
      <Button type="submit" loading={saving}>
        Save details
      </Button>
    </form>
  );
}

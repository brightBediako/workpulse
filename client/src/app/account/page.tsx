"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CircleDollarSign,
  Plus,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
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
  payoutAccounts?: PayoutAccount[];
  verificationDocuments?: string[];
  verificationSubmittedAt?: string | null;
  adminNotes?: string | null;
};

type PayoutAccount = {
  id: string;
  method: "mobile_money" | "bank" | string;
  provider: string;
  accountName: string;
  accountNumber: string;
  label?: string | null;
};

type PayoutForm = {
  method: "mobile_money" | "bank";
  provider: string;
  accountName: string;
  accountNumber: string;
};

type Earnings = {
  totalEarnings: number;
  totalGross: number;
  totalPlatformFees: number;
  completedOrders: number;
  availableBalance?: number;
  pendingAmount?: number;
  approvedAmount?: number;
  paidOut?: number;
  minPayoutAmount?: number;
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

type WorkerPayoutRequest = {
  id: string;
  amount: number;
  currency?: string;
  status: string;
  payoutAccount?: {
    method?: string;
    provider?: string;
    accountName?: string;
    accountNumber?: string;
  };
  note?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
};

type Verification = {
  isVerified?: boolean;
  verificationStatus?: string;
  verificationDocuments?: string[];
  verificationSubmittedAt?: string | null;
  adminNotes?: string | null;
};

type DetailsState = {
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

type SectionId =
  | "profile"
  | "modes"
  | "payout"
  | "earnings"
  | "verification";

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

function fileLabel(url: string) {
  const parts = url.split("/");
  return parts[parts.length - 1] || url;
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function validatePayoutForm(form: PayoutForm): Partial<Record<keyof PayoutForm, string>> {
  const errors: Partial<Record<keyof PayoutForm, string>> = {};
  if (!form.provider.trim()) errors.provider = "Provider is required.";
  if (!form.accountName.trim()) errors.accountName = "Account name is required.";
  const number = digitsOnly(form.accountNumber);
  if (form.method === "mobile_money") {
    if (!/^\d{10}$/.test(number)) {
      errors.accountNumber = "MoMo number must be exactly 10 digits.";
    }
  } else if (!/^\d{8,20}$/.test(number)) {
    errors.accountNumber = "Bank account must be 8–20 digits.";
  }
  return errors;
}

const emptyPayoutForm = (): PayoutForm => ({
  method: "mobile_money",
  provider: "",
  accountName: "",
  accountNumber: "",
});

const selectClass =
  "w-full h-12 bg-surface-container-low border border-outline-variant rounded-md px-md font-sans text-[15px] focus:outline-none focus:ring-1 focus:border-primary-container focus:ring-primary-container";

export default function AccountPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [deletingPayoutId, setDeletingPayoutId] = useState<string | null>(null);
  const [savingVerify, setSavingVerify] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [enablingMode, setEnablingMode] = useState<"worker" | "employer" | null>(
    null
  );
  const [activeSection, setActiveSection] = useState<SectionId>("profile");
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [editingPayoutId, setEditingPayoutId] = useState<string | null>(null);
  const [payoutForm, setPayoutForm] = useState<PayoutForm>(emptyPayoutForm);
  const [payoutFieldErrors, setPayoutFieldErrors] = useState<
    Partial<Record<keyof PayoutForm, string>>
  >({});
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutAccount[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<WorkerPayoutRequest[]>(
    []
  );
  const [requestAmount, setRequestAmount] = useState("");
  const [requestAccountId, setRequestAccountId] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(
    null
  );
  const [showRequestForm, setShowRequestForm] = useState(false);

  const [details, setDetails] = useState<DetailsState>({
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

  const [pendingDocs, setPendingDocs] = useState<string[]>([]);

  const isWorker = Boolean(user?.isSeller);
  const isEmployer = Boolean(user?.isEmployer);
  const canManageBiz = isWorker || isEmployer;

  const sections = useMemo(() => {
    const items: Array<{
      id: SectionId;
      label: string;
      icon: typeof UserRound;
      hint: string;
    }> = [
      {
        id: "profile",
        label: "Profile",
        icon: UserRound,
        hint: "Name, contact, and bio",
      },
      {
        id: "modes",
        label: "Roles",
        icon: Briefcase,
        hint: "Worker and employer modes",
      },
    ];
    if (canManageBiz) {
      items.push({
        id: "payout",
        label: "Payout",
        icon: Wallet,
        hint: "MoMo or bank details",
      });
    }
    if (isWorker) {
      items.push({
        id: "earnings",
        label: "Earnings",
        icon: CircleDollarSign,
        hint: "Completed order totals",
      });
    }
    if (canManageBiz) {
      items.push({
        id: "verification",
        label: "Verification",
        icon: BadgeCheck,
        hint: "ID and business docs",
      });
    }
    return items;
  }, [canManageBiz, isWorker]);

  useEffect(() => {
    if (!sections.some((s) => s.id === activeSection)) {
      setActiveSection("profile");
    }
  }, [sections, activeSection]);

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
      refreshUser({
        ...user,
        ...me,
        _id: me._id || user._id,
      });

      if (me.isSeller || me.isEmployer) {
        const [v, payoutRes] = await Promise.all([
          api<Verification>("/api/users/me/verification"),
          api<{ accounts?: PayoutAccount[] }>("/api/users/me/payout"),
        ]);
        setVerification(v);
        setPendingDocs(v.verificationDocuments || []);
        const accounts = payoutRes.accounts || me.payoutAccounts || [];
        setPayoutAccounts(accounts);
        if (accounts[0]?.id) {
          setRequestAccountId((prev) => prev || accounts[0].id);
        }
      } else {
        setVerification(null);
        setPendingDocs([]);
        setPayoutAccounts([]);
      }

      if (me.isSeller) {
        const [e, pr] = await Promise.all([
          api<Earnings>("/api/users/me/earnings"),
          api<{ requests?: WorkerPayoutRequest[] }>(
            "/api/users/me/payout-requests"
          ),
        ]);
        setEarnings(e);
        setPayoutRequests(pr.requests || []);
      } else {
        setEarnings(null);
        setPayoutRequests([]);
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
      setMessage("Profile saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save details");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onSavePayout(e: FormEvent) {
    e.preventDefault();
    const fieldErrors = validatePayoutForm(payoutForm);
    setPayoutFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) {
      setError(
        fieldErrors.accountNumber ||
          fieldErrors.provider ||
          fieldErrors.accountName ||
          "Fix the payout form errors."
      );
      return;
    }

    setSavingPayout(true);
    setError("");
    setMessage("");
    const body = {
      method: payoutForm.method,
      provider: payoutForm.provider.trim(),
      accountName: payoutForm.accountName.trim(),
      accountNumber: digitsOnly(payoutForm.accountNumber),
    };
    try {
      const res = editingPayoutId
        ? await api<{ accounts?: PayoutAccount[]; message?: string }>(
            `/api/users/me/payout/${editingPayoutId}`,
            { method: "PUT", body }
          )
        : await api<{ accounts?: PayoutAccount[]; message?: string }>(
            "/api/users/me/payout",
            { method: "POST", body }
          );
      setPayoutAccounts(res.accounts || []);
      setMessage(res.message || "Payout account saved.");
      setShowPayoutForm(false);
      setEditingPayoutId(null);
      setPayoutForm(emptyPayoutForm());
      setPayoutFieldErrors({});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save payout");
    } finally {
      setSavingPayout(false);
    }
  }

  async function onDeletePayout(id: string) {
    if (!window.confirm("Remove this payout account?")) return;
    setDeletingPayoutId(id);
    setError("");
    setMessage("");
    try {
      const res = await api<{ accounts?: PayoutAccount[]; message?: string }>(
        `/api/users/me/payout/${id}`,
        { method: "DELETE" }
      );
      setPayoutAccounts(res.accounts || []);
      setMessage(res.message || "Payout account removed.");
      if (editingPayoutId === id) {
        setEditingPayoutId(null);
        setShowPayoutForm(false);
        setPayoutForm(emptyPayoutForm());
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not remove payout account"
      );
    } finally {
      setDeletingPayoutId(null);
    }
  }

  function startAddPayout() {
    setEditingPayoutId(null);
    setPayoutForm(emptyPayoutForm());
    setPayoutFieldErrors({});
    setShowPayoutForm(true);
    setError("");
    setMessage("");
  }

  function startEditPayout(account: PayoutAccount) {
    setEditingPayoutId(account.id);
    setPayoutForm({
      method:
        account.method === "bank" ? "bank" : "mobile_money",
      provider: account.provider || "",
      accountName: account.accountName || "",
      accountNumber: digitsOnly(account.accountNumber || ""),
    });
    setPayoutFieldErrors({});
    setShowPayoutForm(true);
    setError("");
    setMessage("");
  }

  async function onRequestPayout(e: FormEvent) {
    e.preventDefault();
    const amount = Number(requestAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid payout amount.");
      return;
    }
    if (!requestAccountId) {
      setError("Select a payout account, or add one under Payout.");
      return;
    }
    setRequestingPayout(true);
    setError("");
    setMessage("");
    try {
      const res = await api<{
        message?: string;
        balance?: Earnings;
        request?: WorkerPayoutRequest;
      }>("/api/users/me/payout-requests", {
        method: "POST",
        body: {
          amount,
          payoutAccountId: requestAccountId,
          note: requestNote.trim() || undefined,
        },
      });
      setMessage(res.message || "Payout request submitted.");
      setShowRequestForm(false);
      setRequestAmount("");
      setRequestNote("");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not submit payout request"
      );
    } finally {
      setRequestingPayout(false);
    }
  }

  async function onCancelPayoutRequest(id: string) {
    if (!window.confirm("Cancel this payout request?")) return;
    setCancellingRequestId(id);
    setError("");
    setMessage("");
    try {
      const res = await api<{ message?: string }>(
        `/api/users/me/payout-requests/${id}/cancel`,
        { method: "PUT" }
      );
      setMessage(res.message || "Request cancelled.");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not cancel request"
      );
    } finally {
      setCancellingRequestId(null);
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
      setMessage("Files uploaded. Submit them for admin review when ready.");
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

  async function enableWorker() {
    if (!user?._id) return;
    setEnablingMode("worker");
    setError("");
    setMessage("");
    try {
      await api(`/api/users/update/${user._id}`, {
        method: "PUT",
        body: { isSeller: true },
      });
      refreshUser({ ...user, isSeller: true });
      setMessage("Worker mode enabled.");
      setActiveSection("profile");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not enable worker mode"
      );
    } finally {
      setEnablingMode(null);
    }
  }

  async function enableEmployer() {
    if (!user) return;
    setEnablingMode("employer");
    setError("");
    setMessage("");
    try {
      const res = await api<{ user?: User; token?: string }>(
        "/api/users/me/employer",
        { method: "PUT", body: { isEmployer: true } }
      );
      if (res.user) refreshUser(res.user);
      else refreshUser({ ...user, isEmployer: true });
      setMessage("Employer mode enabled.");
      setActiveSection("profile");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not enable employer mode"
      );
    } finally {
      setEnablingMode(null);
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

  const displayName = profile?.username || user.username || "Account";
  const verifyStatus = profile?.isVerified
    ? "verified"
    : verification?.verificationStatus || "pending";

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNav />
      <main className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-lg pb-xl">
        {/* Profile summary */}
        <header className="mb-lg p-md md:p-lg bg-surface-container-lowest border border-outline-variant rounded-card">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-md">
            <div className="flex items-start gap-md min-w-0">
              <div
                className="shrink-0 w-14 h-14 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-page-title text-xl"
                aria-hidden
              >
                {(displayName[0] || "W").toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="font-page-title text-primary truncate">
                  {displayName}
                </h1>
                <p className="font-body-dense text-on-surface-variant truncate mt-xs">
                  {profile?.email || user.email}
                </p>
                <div className="flex flex-wrap gap-sm mt-md">
                  {canManageBiz ? (
                    <StatusChip status={verifyStatus} />
                  ) : (
                    <StatusChip status="open" label="customer" />
                  )}
                  {isWorker ? (
                    <StatusChip status="approved" label="worker" />
                  ) : null}
                  {isEmployer ? (
                    <StatusChip status="open" label="employer" />
                  ) : null}
                  {user.isAdmin ? (
                    <StatusChip status="verified" label="admin" />
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-sm shrink-0">
              {isWorker ? (
                <Link href="/dashboard/gigs">
                  <Button variant="outline" className="!py-sm !px-md text-sm">
                    My gigs
                  </Button>
                </Link>
              ) : null}
              {isEmployer ? (
                <Link href="/jobs">
                  <Button variant="outline" className="!py-sm !px-md text-sm">
                    My jobs
                  </Button>
                </Link>
              ) : null}
              <Link href="/orders">
                <Button variant="ghost" className="!py-sm !px-md text-sm">
                  Orders
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {(error || message) && (
          <div
            className={`mb-lg px-md py-sm rounded-md border font-body-dense ${
              error
                ? "bg-error-container/40 border-error/30 text-on-error-container"
                : "bg-primary-fixed/40 border-primary-fixed text-on-primary-fixed-variant"
            }`}
            role="status"
          >
            {error || message}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-lg lg:gap-xl items-start">
          {/* Section nav */}
          <nav
            aria-label="Account sections"
            className="w-full lg:w-56 shrink-0 lg:sticky lg:top-24"
          >
            <p className="font-label-caps text-on-surface-variant mb-sm px-xs hidden lg:block">
              Sections
            </p>
            <ul className="flex lg:flex-col gap-sm overflow-x-auto pb-xs lg:pb-0 -mx-1 px-1">
              {sections.map((s) => {
                const Icon = s.icon;
                const active = activeSection === s.id;
                return (
                  <li key={s.id} className="shrink-0 lg:shrink lg:w-full">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection(s.id);
                        setError("");
                        setMessage("");
                      }}
                      className={`w-full flex items-center gap-sm px-md py-sm rounded-md text-left transition border ${
                        active
                          ? "bg-primary-container text-on-primary border-primary-container"
                          : "bg-surface-container-lowest text-on-surface border-outline-variant hover:bg-surface-container-low"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden />
                      <span className="min-w-0">
                        <span className="block font-semibold text-sm">
                          {s.label}
                        </span>
                        <span
                          className={`hidden lg:block font-body-dense text-xs mt-0.5 ${
                            active
                              ? "text-on-primary/80"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {s.hint}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Panels */}
          <div className="flex-1 min-w-0 w-full space-y-md">
            {activeSection === "profile" ? (
              <SectionCard
                title="Profile"
                description="Keep your contact details current. Buyers and employers use this to reach you."
              >
                <form onSubmit={onSaveDetails} className="space-y-lg">
                  <FieldGroup title="Personal">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                      <Input
                        label="Display name"
                        value={details.username}
                        onChange={(e) =>
                          setDetails((d) => ({
                            ...d,
                            username: e.target.value,
                          }))
                        }
                        required
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={details.email}
                        onChange={(e) =>
                          setDetails((d) => ({ ...d, email: e.target.value }))
                        }
                        required
                      />
                      <Input
                        label="Phone"
                        value={details.phone}
                        onChange={(e) =>
                          setDetails((d) => ({ ...d, phone: e.target.value }))
                        }
                        hint="e.g. +233 24 123 4567"
                        required
                      />
                      <Input
                        label="Country"
                        value={details.country}
                        onChange={(e) =>
                          setDetails((d) => ({
                            ...d,
                            country: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <Input
                      label="Address"
                      value={details.address}
                      onChange={(e) =>
                        setDetails((d) => ({ ...d, address: e.target.value }))
                      }
                      required
                    />
                    <Input
                      label="Bio"
                      value={details.desc}
                      onChange={(e) =>
                        setDetails((d) => ({ ...d, desc: e.target.value }))
                      }
                      hint="Short intro shown on your public profile"
                    />
                  </FieldGroup>

                  {isWorker ? (
                    <FieldGroup
                      title="Service area"
                      description="Used for worker discovery filters."
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                        <Input
                          label="Service city"
                          value={details.serviceCity}
                          onChange={(e) =>
                            setDetails((d) => ({
                              ...d,
                              serviceCity: e.target.value,
                            }))
                          }
                          placeholder="Accra"
                        />
                        <Input
                          label="Service region"
                          value={details.serviceRegion}
                          onChange={(e) =>
                            setDetails((d) => ({
                              ...d,
                              serviceRegion: e.target.value,
                            }))
                          }
                          placeholder="Greater Accra"
                        />
                      </div>
                    </FieldGroup>
                  ) : null}

                  {isEmployer ? (
                    <FieldGroup
                      title="Company"
                      description="Shown when you post jobs."
                    >
                      <Input
                        label="Company name"
                        value={details.companyName}
                        onChange={(e) =>
                          setDetails((d) => ({
                            ...d,
                            companyName: e.target.value,
                          }))
                        }
                      />
                      <Input
                        label="Company description"
                        value={details.companyDesc}
                        onChange={(e) =>
                          setDetails((d) => ({
                            ...d,
                            companyDesc: e.target.value,
                          }))
                        }
                      />
                    </FieldGroup>
                  ) : null}

                  <div className="flex justify-end pt-xs border-t border-surface-container-low">
                    <Button type="submit" loading={savingProfile}>
                      Save profile
                    </Button>
                  </div>
                </form>
              </SectionCard>
            ) : null}

            {activeSection === "modes" ? (
              <SectionCard
                title="Account roles"
                description="Modes are independent. You can buy services, work as a provider, and hire on the same account."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  <RoleCard
                    icon={Briefcase}
                    title="Worker"
                    body="List gigs, get paid for completed orders, and submit verification."
                    active={isWorker}
                    actionLabel={isWorker ? "Enabled" : "Become a worker"}
                    loading={enablingMode === "worker"}
                    disabled={isWorker}
                    onAction={enableWorker}
                    href={isWorker ? "/dashboard/gigs" : undefined}
                    hrefLabel="Manage gigs"
                  />
                  <RoleCard
                    icon={Building2}
                    title="Employer"
                    body="Post jobs, review applications, and hire workers."
                    active={isEmployer}
                    actionLabel={isEmployer ? "Enabled" : "Become an employer"}
                    loading={enablingMode === "employer"}
                    disabled={isEmployer}
                    onAction={enableEmployer}
                    href={isEmployer ? "/jobs" : undefined}
                    hrefLabel="Manage jobs"
                  />
                </div>
              </SectionCard>
            ) : null}

            {activeSection === "payout" && canManageBiz ? (
              <SectionCard
                title="Payout details"
                description="Save one or more MoMo and bank accounts. Admins settle manually until Paystack Transfers go live."
              >
                <div className="space-y-md">
                  {payoutAccounts.length ? (
                    <ul className="space-y-sm">
                      {payoutAccounts.map((account) => (
                        <li
                          key={account.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm p-md rounded-md border border-outline-variant bg-surface-container-low"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-sm mb-xs">
                              <StatusChip
                                status={
                                  account.method === "bank"
                                    ? "open"
                                    : "approved"
                                }
                                label={
                                  account.method === "bank"
                                    ? "bank"
                                    : "mobile money"
                                }
                              />
                              <span className="font-semibold text-primary truncate">
                                {account.provider}
                              </span>
                            </div>
                            <p className="font-body-dense text-on-surface">
                              {account.accountName}
                            </p>
                            <p className="font-data-ref text-on-surface-variant">
                              {account.accountNumber}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-sm shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              className="!py-sm !px-md text-sm"
                              onClick={() => startEditPayout(account)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="!py-sm !px-md text-sm"
                              loading={deletingPayoutId === account.id}
                              onClick={() => onDeletePayout(account.id)}
                            >
                              <Trash2 className="w-4 h-4" aria-hidden />
                              Remove
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="font-body-dense text-on-surface-variant">
                      No payout accounts yet. Add mobile money, a bank account,
                      or both.
                    </p>
                  )}

                  {!showPayoutForm ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={startAddPayout}
                      className="gap-sm"
                    >
                      <Plus className="w-4 h-4" aria-hidden />
                      Add payout account
                    </Button>
                  ) : (
                    <form
                      onSubmit={onSavePayout}
                      className="space-y-md max-w-lg p-md rounded-md border border-outline-variant bg-surface-container-lowest"
                    >
                      <h3 className="font-section-title text-primary text-base">
                        {editingPayoutId
                          ? "Edit payout account"
                          : "New payout account"}
                      </h3>
                      <div>
                        <label className="font-label-caps text-on-surface-variant block mb-xs">
                          Method
                        </label>
                        <select
                          className={selectClass}
                          value={payoutForm.method}
                          onChange={(e) => {
                            const method = e.target.value as
                              | "mobile_money"
                              | "bank";
                            setPayoutForm((p) => ({
                              ...p,
                              method,
                              accountNumber: digitsOnly(p.accountNumber).slice(
                                0,
                                method === "mobile_money" ? 10 : 20
                              ),
                            }));
                            setPayoutFieldErrors((err) => ({
                              ...err,
                              accountNumber: undefined,
                            }));
                          }}
                        >
                          <option value="mobile_money">Mobile money</option>
                          <option value="bank">Bank account</option>
                        </select>
                      </div>
                      <Input
                        label={
                          payoutForm.method === "mobile_money"
                            ? "Provider (MTN, Telecel, AirtelTigo…)"
                            : "Bank name"
                        }
                        value={payoutForm.provider}
                        error={payoutFieldErrors.provider}
                        onChange={(e) =>
                          setPayoutForm((p) => ({
                            ...p,
                            provider: e.target.value,
                          }))
                        }
                        required
                      />
                      <Input
                        label="Account name"
                        value={payoutForm.accountName}
                        error={payoutFieldErrors.accountName}
                        onChange={(e) =>
                          setPayoutForm((p) => ({
                            ...p,
                            accountName: e.target.value,
                          }))
                        }
                        required
                      />
                      <Input
                        label={
                          payoutForm.method === "mobile_money"
                            ? "MoMo number"
                            : "Account number"
                        }
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={
                          payoutForm.method === "mobile_money" ? 10 : 20
                        }
                        value={payoutForm.accountNumber}
                        error={payoutFieldErrors.accountNumber}
                        hint={
                          payoutForm.method === "mobile_money"
                            ? "Exactly 10 digits, numbers only"
                            : "8–20 digits, numbers only"
                        }
                        onChange={(e) => {
                          const max =
                            payoutForm.method === "mobile_money" ? 10 : 20;
                          setPayoutForm((p) => ({
                            ...p,
                            accountNumber: digitsOnly(e.target.value).slice(
                              0,
                              max
                            ),
                          }));
                          setPayoutFieldErrors((err) => ({
                            ...err,
                            accountNumber: undefined,
                          }));
                        }}
                        required
                      />
                      <div className="flex flex-wrap justify-end gap-sm pt-xs border-t border-surface-container-low">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setShowPayoutForm(false);
                            setEditingPayoutId(null);
                            setPayoutForm(emptyPayoutForm());
                            setPayoutFieldErrors({});
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" loading={savingPayout}>
                          {editingPayoutId ? "Update account" : "Add account"}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </SectionCard>
            ) : null}

            {activeSection === "earnings" && isWorker ? (
              <SectionCard
                title="Earnings & payouts"
                description="Available balance is your net earnings minus pending, approved, and paid payout requests."
              >
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-md mb-lg">
                  <Stat
                    label="Available"
                    value={money(
                      earnings?.availableBalance,
                      earnings?.currency
                    )}
                  />
                  <Stat
                    label="Lifetime net"
                    value={money(earnings?.totalEarnings, earnings?.currency)}
                  />
                  <Stat
                    label="Paid out"
                    value={money(earnings?.paidOut, earnings?.currency)}
                  />
                  <Stat
                    label="Pending requests"
                    value={money(earnings?.pendingAmount, earnings?.currency)}
                  />
                </div>

                <div className="mb-lg p-md rounded-md border border-outline-variant bg-surface-container-low space-y-md">
                  <div className="flex flex-wrap items-center justify-between gap-md">
                    <div>
                      <h3 className="font-section-title text-primary text-base">
                        Request a payout
                      </h3>
                      <p className="font-body-dense text-on-surface-variant">
                        Minimum{" "}
                        {money(
                          earnings?.minPayoutAmount ?? 10,
                          earnings?.currency
                        )}
                        . Admins review and send to your MoMo or bank account.
                      </p>
                    </div>
                    {!showRequestForm ? (
                      <Button
                        type="button"
                        variant="conversion"
                        disabled={
                          !payoutAccounts.length ||
                          (earnings?.availableBalance ?? 0) <= 0
                        }
                        onClick={() => {
                          setShowRequestForm(true);
                          setError("");
                          setMessage("");
                          if (!requestAccountId && payoutAccounts[0]?.id) {
                            setRequestAccountId(payoutAccounts[0].id);
                          }
                        }}
                      >
                        Request payout
                      </Button>
                    ) : null}
                  </div>

                  {!payoutAccounts.length ? (
                    <p className="font-body-dense text-on-surface-variant">
                      Add a MoMo or bank account under{" "}
                      <button
                        type="button"
                        className="text-primary-container font-semibold hover:underline"
                        onClick={() => setActiveSection("payout")}
                      >
                        Payout
                      </button>{" "}
                      before requesting.
                    </p>
                  ) : null}

                  {showRequestForm ? (
                    <form
                      onSubmit={onRequestPayout}
                      className="space-y-md max-w-md pt-sm border-t border-outline-variant"
                    >
                      <Input
                        label="Amount (GHS)"
                        inputMode="decimal"
                        value={requestAmount}
                        onChange={(e) => setRequestAmount(e.target.value)}
                        hint={`Available ${money(earnings?.availableBalance, earnings?.currency)}`}
                        required
                      />
                      <div>
                        <label className="font-label-caps text-on-surface-variant block mb-xs">
                          Payout account
                        </label>
                        <select
                          className={selectClass}
                          value={requestAccountId}
                          onChange={(e) => setRequestAccountId(e.target.value)}
                          required
                        >
                          <option value="">Select account</option>
                          {payoutAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.method === "bank" ? "Bank" : "MoMo"} ·{" "}
                              {a.provider} · {a.accountNumber}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Input
                        label="Note (optional)"
                        value={requestNote}
                        onChange={(e) => setRequestNote(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-sm">
                        <Button type="submit" loading={requestingPayout}>
                          Submit request
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setShowRequestForm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </div>

                <div className="mb-lg">
                  <h3 className="font-label-caps text-on-surface-variant mb-sm">
                    Your payout requests
                  </h3>
                  {!payoutRequests.length ? (
                    <p className="font-body-dense text-on-surface-variant">
                      No payout requests yet.
                    </p>
                  ) : (
                    <ul className="space-y-sm">
                      {payoutRequests.map((r) => (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center justify-between gap-md p-md rounded-md border border-outline-variant bg-surface-container-lowest"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-sm mb-xs">
                              <StatusChip status={r.status} />
                              <span className="font-data-price text-primary">
                                {money(r.amount, r.currency)}
                              </span>
                            </div>
                            <p className="font-body-dense text-on-surface-variant">
                              {r.payoutAccount?.method === "bank"
                                ? "Bank"
                                : "MoMo"}{" "}
                              · {r.payoutAccount?.provider} ·{" "}
                              {r.payoutAccount?.accountNumber}
                            </p>
                            <p className="font-data-ref text-on-surface-variant">
                              {r.createdAt
                                ? new Date(r.createdAt).toLocaleString()
                                : ""}
                            </p>
                            {r.rejectionReason ? (
                              <p className="font-body-dense text-error mt-xs">
                                {r.rejectionReason}
                              </p>
                            ) : null}
                          </div>
                          {r.status === "pending" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="!py-sm !px-md text-sm"
                              loading={cancellingRequestId === r.id}
                              onClick={() => onCancelPayoutRequest(r.id)}
                            >
                              Cancel
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="font-label-caps text-on-surface-variant mb-sm">
                    Recent paid orders
                  </h3>
                  {!earnings?.recentOrders?.length ? (
                    <p className="font-body-dense text-on-surface-variant py-md">
                      No completed orders yet. Paid gigs will show here.
                    </p>
                  ) : (
                    <ul className="divide-y divide-surface-container-low border border-outline-variant rounded-md overflow-hidden bg-surface-container-lowest">
                      {earnings.recentOrders.map((o) => (
                        <li
                          key={o._id}
                          className="px-md py-sm flex justify-between gap-md items-center"
                        >
                          <div className="min-w-0">
                            <p className="font-body-dense font-semibold truncate text-on-surface">
                              {o.title}
                            </p>
                            <p className="font-data-ref text-on-surface-variant">
                              {o.createdAt
                                ? new Date(o.createdAt).toLocaleDateString()
                                : ""}
                            </p>
                          </div>
                          <p className="font-data-price shrink-0 text-primary">
                            {money(o.sellerEarnings, earnings?.currency)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-md">
                  <Link
                    href="/orders"
                    className="font-body-dense text-primary-container hover:underline"
                  >
                    View all orders →
                  </Link>
                </div>
              </SectionCard>
            ) : null}

            {activeSection === "verification" && canManageBiz ? (
              <SectionCard
                title="Verification"
                description="Upload ID or business documents for admin review. PDF, PNG, JPG, or WEBP — max 5 MB each."
              >
                <div className="flex flex-wrap items-center gap-sm mb-md">
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
                  <p className="font-body-dense mb-md px-md py-sm rounded-md bg-error-container/40 text-on-error-container">
                    Admin note: {verification.adminNotes}
                  </p>
                ) : null}

                <div className="mb-md">
                  <h3 className="font-label-caps text-on-surface-variant mb-sm">
                    Documents
                  </h3>
                  {pendingDocs.length ? (
                    <ul className="space-y-sm">
                      {pendingDocs.map((doc) => (
                        <li
                          key={doc}
                          className="flex items-center justify-between gap-md px-md py-sm rounded-md border border-outline-variant bg-surface-container-low"
                        >
                          <a
                            href={docHref(doc)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-body-dense text-primary-container hover:underline truncate"
                          >
                            {fileLabel(doc)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="font-body-dense text-on-surface-variant">
                      No documents uploaded yet.
                    </p>
                  )}
                </div>

                {!verification?.isVerified ? (
                  <div className="space-y-md pt-md border-t border-surface-container-low">
                    <Input
                      label="Upload files"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                      multiple
                      disabled={uploading}
                      onChange={(e) => onUploadFiles(e.target.files)}
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        loading={savingVerify || uploading}
                        disabled={!pendingDocs.length}
                        onClick={onSubmitVerification}
                      >
                        Submit for review
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="font-body-dense text-on-surface-variant pt-md border-t border-surface-container-low">
                    Your account is verified. Contact support to change
                    documents.
                  </p>
                )}
              </SectionCard>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="p-md md:p-lg bg-surface-container-lowest border border-outline-variant rounded-card">
      <div className="mb-lg pb-md border-b border-surface-container-low">
        <h2 className="font-section-title text-primary">{title}</h2>
        {description ? (
          <p className="font-body-dense text-on-surface-variant mt-xs max-w-2xl">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-md">
      <div>
        <h3 className="font-label-caps text-on-surface-variant">{title}</h3>
        {description ? (
          <p className="font-body-dense text-on-surface-variant mt-xs">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-md bg-surface-container-low rounded-md">
      <p className="font-label-caps text-on-surface-variant mb-xs">{label}</p>
      <p className="font-data-price text-lg text-primary">{value}</p>
    </div>
  );
}

function RoleCard({
  icon: Icon,
  title,
  body,
  active,
  actionLabel,
  loading,
  disabled,
  onAction,
  href,
  hrefLabel,
}: {
  icon: typeof Briefcase;
  title: string;
  body: string;
  active: boolean;
  actionLabel: string;
  loading?: boolean;
  disabled?: boolean;
  onAction: () => void;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div
      className={`p-md rounded-md border flex flex-col gap-md ${
        active
          ? "border-primary-container/40 bg-primary-fixed/20"
          : "border-outline-variant bg-surface-container-low"
      }`}
    >
      <div className="flex items-center gap-sm">
        <div className="w-9 h-9 rounded-md bg-surface-container-lowest border border-outline-variant flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" aria-hidden />
        </div>
        <div>
          <p className="font-semibold text-primary">{title}</p>
          {active ? (
            <StatusChip status="approved" label="active" />
          ) : (
            <span className="font-body-dense text-on-surface-variant text-xs">
              Not enabled
            </span>
          )}
        </div>
      </div>
      <p className="font-body-dense text-on-surface-variant flex-1">{body}</p>
      <div className="flex flex-wrap gap-sm">
        <Button
          type="button"
          variant={active ? "ghost" : "primary"}
          loading={loading}
          disabled={disabled}
          onClick={onAction}
          className="!py-sm !px-md text-sm"
        >
          {actionLabel}
        </Button>
        {href && hrefLabel ? (
          <Link href={href}>
            <Button
              type="button"
              variant="outline"
              className="!py-sm !px-md text-sm"
            >
              {hrefLabel}
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

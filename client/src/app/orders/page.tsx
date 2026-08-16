"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Order } from "@/lib/types";

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [workNote, setWorkNote] = useState("");
  const [approveAmount, setApproveAmount] = useState<Record<string, string>>(
    {}
  );

  const isSeller = Boolean(user?.isSeller || user?.accountModes?.worker);

  async function load() {
    try {
      const data = await api<Order[]>("/api/orders");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load orders");
    }
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function confirmPaid(payment_intent?: string) {
    if (!payment_intent || payment_intent.startsWith("book_")) return;
    setBusy(payment_intent);
    setError("");
    try {
      await api("/api/orders", {
        method: "PUT",
        body: { payment_intent },
      });
      setMessage("Payment confirmed.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Confirm failed");
    } finally {
      setBusy(null);
    }
  }

  async function submitWork(orderId: string) {
    setBusy(orderId);
    setError("");
    try {
      await api(`/api/orders/${orderId}/submit-work`, {
        method: "PUT",
        body: workNote.trim() ? { note: workNote.trim() } : {},
      });
      setMessage("Work submitted for buyer approval.");
      setWorkNote("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit work");
    } finally {
      setBusy(null);
    }
  }

  async function approveWork(order: Order) {
    setBusy(order._id);
    setError("");
    try {
      const amountRaw = approveAmount[order._id] ?? "";
      const body: Record<string, unknown> = {};
      if (amountRaw.trim()) body.amount = Number(amountRaw);
      await api(`/api/orders/${order._id}/approve-work`, {
        method: "PUT",
        body,
      });
      setMessage("Work approved. You can pay now.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not approve work");
    } finally {
      setBusy(null);
    }
  }

  async function payOrder(orderId: string) {
    setBusy(orderId);
    setError("");
    try {
      const res = await api<{ authorization_url?: string }>(
        `/api/orders/${orderId}/payment-intent`,
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
      setBusy(null);
    }
  }

  async function completeOrder(orderId: string) {
    setBusy(orderId);
    try {
      await api(`/api/orders/${orderId}/complete`, { method: "PUT" });
      setMessage("Order marked completed.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not complete");
    } finally {
      setBusy(null);
    }
  }

  if (authLoading) {
    return (
      <div>
        <MarketplaceNav />
        <p className="p-lg">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <MarketplaceNav />
        <main className="max-w-container mx-auto p-lg">
          <EmptyState
            title="Sign in to view orders"
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

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNav />
      <main className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-lg">
        <h1 className="font-page-title text-primary mb-lg">Orders</h1>
        <p className="font-body-dense text-on-surface-variant mb-lg">
          Gig bookings: worker completes work → you approve → you pay → worker
          requests payout from Account.
        </p>
        {error ? <p className="text-error mb-md font-body-dense">{error}</p> : null}
        {message ? (
          <p className="font-body-dense text-on-primary-fixed-variant mb-md">
            {message}
          </p>
        ) : null}
        {orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Book a service from Discover to get started."
            action={
              <Link href="/discover">
                <Button variant="conversion">Find a worker</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-md">
            {orders.map((o) => {
              const isBuyer = String(o.buyerId) === String(user._id);
              const isOrderSeller = String(o.sellerId) === String(user._id);
              const busyThis = busy === o._id || busy === o.payment_intent;

              return (
                <article
                  key={o._id}
                  className="p-md bg-surface-container-lowest border border-outline-variant rounded-card space-y-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-md">
                    <div>
                      <p className="font-section-title text-primary">{o.title}</p>
                      <p className="font-data-price text-on-surface">
                        GHS {Number(o.price).toLocaleString()}
                      </p>
                      <p className="font-label-caps text-on-surface-variant mt-xs">
                        {o.sourceType === "gig" ? "Gig booking" : o.sourceType || "order"}
                        {isBuyer ? " · You are the buyer" : ""}
                        {isOrderSeller ? " · You are the seller" : ""}
                      </p>
                    </div>
                    <StatusChip status={o.status} />
                  </div>

                  {o.workNote ? (
                    <p className="font-body-dense italic">Work note: {o.workNote}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-sm">
                    {isOrderSeller &&
                    isSeller &&
                    o.status === "pending" &&
                    !o.isCompleted ? (
                      <div className="w-full space-y-sm">
                        <textarea
                          className="w-full min-h-20 bg-surface-container-low border border-outline-variant rounded-md px-md py-md font-sans text-[15px]"
                          value={workNote}
                          onChange={(e) => setWorkNote(e.target.value)}
                          placeholder="Describe completed work (optional)…"
                        />
                        <Button
                          variant="conversion"
                          className="!py-sm !px-md text-sm"
                          loading={busyThis}
                          onClick={() => submitWork(o._id)}
                        >
                          Mark work done
                        </Button>
                      </div>
                    ) : null}

                    {isBuyer && o.status === "work_submitted" ? (
                      <div className="w-full space-y-sm max-w-xs">
                        <Input
                          label="Payment amount (GHS)"
                          type="number"
                          min={0}
                          value={approveAmount[o._id] ?? String(o.price)}
                          onChange={(e) =>
                            setApproveAmount((prev) => ({
                              ...prev,
                              [o._id]: e.target.value,
                            }))
                          }
                        />
                        <Button
                          className="!py-sm !px-md text-sm"
                          loading={busyThis}
                          onClick={() => approveWork(o)}
                        >
                          Approve work
                        </Button>
                      </div>
                    ) : null}

                    {isBuyer && o.status === "work_approved" && !o.isCompleted ? (
                      <Button
                        variant="conversion"
                        className="!py-sm !px-md text-sm"
                        loading={busyThis}
                        onClick={() => payOrder(o._id)}
                      >
                        Pay (Paystack)
                      </Button>
                    ) : null}

                    {!o.isCompleted &&
                    o.payment_intent &&
                    !o.payment_intent.startsWith("book_") &&
                    o.status === "pending" ? (
                      <Button
                        variant="outline"
                        className="!py-sm !px-md text-sm"
                        loading={busy === o.payment_intent}
                        onClick={() => confirmPaid(o.payment_intent)}
                      >
                        Verify Paystack payment
                      </Button>
                    ) : null}

                    {o.isCompleted && o.status === "in_progress" ? (
                      <Button
                        variant="outline"
                        className="!py-sm !px-md text-sm"
                        loading={busyThis}
                        onClick={() => completeOrder(o._id)}
                      >
                        Mark completed
                      </Button>
                    ) : null}

                    {o.isCompleted && isOrderSeller ? (
                      <Link href="/account">
                        <Button variant="ghost" className="!py-sm !px-md text-sm">
                          Request payout
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Order } from "@/lib/types";

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

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
    if (!payment_intent) return;
    setBusy(payment_intent);
    try {
      await api("/api/orders", {
        method: "PUT",
        body: { payment_intent },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Confirm failed");
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
        {error ? <p className="text-error mb-md font-body-dense">{error}</p> : null}
        {orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Order a service from Discover to get started."
            action={
              <Link href="/discover">
                <Button variant="conversion">Find a worker</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-md">
            {orders.map((o) => (
              <div
                key={o._id}
                className="flex flex-wrap items-center justify-between gap-md p-md bg-surface-container-lowest border border-outline-variant rounded-card"
              >
                <div>
                  <p className="font-section-title text-primary">{o.title}</p>
                  <p className="font-data-price text-on-surface">
                    GHS {Number(o.price).toLocaleString()}
                  </p>
                  <p className="font-data-ref text-on-surface-variant mt-xs">
                    {o._id}
                  </p>
                </div>
                <div className="flex items-center gap-md">
                  <StatusChip status={o.status} />
                  {!o.isCompleted && o.payment_intent ? (
                    <Button
                      variant="conversion"
                      loading={busy === o.payment_intent}
                      onClick={() => confirmPaid(o.payment_intent)}
                    >
                      Verify Paystack payment
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function CallbackInner() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState("Confirming your Paystack payment…");
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;

    const reference =
      searchParams.get("reference") || searchParams.get("trxref");

    if (!user) {
      const next = reference
        ? `/orders/callback?reference=${encodeURIComponent(reference)}`
        : "/orders";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    if (!reference) {
      setError("Missing payment reference from Paystack.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await api("/api/orders", {
          method: "PUT",
          body: { reference, payment_intent: reference },
        });
        if (!cancelled) {
          setMessage("Payment confirmed. Redirecting to your orders…");
          router.replace("/orders");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Could not confirm payment. You can retry from Orders."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, searchParams, router]);

  return (
    <main className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-xl">
      <h1 className="font-page-title text-primary mb-md">Payment return</h1>
      {error ? (
        <div className="space-y-md">
          <p className="text-error font-body-dense">{error}</p>
          <Link href="/orders">
            <Button>Go to orders</Button>
          </Link>
        </div>
      ) : (
        <p className="text-on-surface-variant">{message}</p>
      )}
    </main>
  );
}

export default function OrdersCallbackPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNav />
      <Suspense
        fallback={
          <main className="p-lg text-on-surface-variant">Loading…</main>
        }
      >
        <CallbackInner />
      </Suspense>
    </div>
  );
}

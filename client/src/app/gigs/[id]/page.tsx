"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { api, ApiError, getApiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Gig } from "@/lib/types";

function mediaUrl(url?: string) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${getApiUrl()}${url}`;
  return url;
}

export default function GigDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [gig, setGig] = useState<Gig | null>(null);
  const [error, setError] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [orderMsg, setOrderMsg] = useState("");

  useEffect(() => {
    if (!id) return;
    api<Gig>(`/api/gigs/single/${id}`, { auth: false })
      .then(setGig)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Gig not found")
      );
  }, [id]);

  async function orderNow() {
    if (!user) {
      router.push("/login");
      return;
    }
    setOrdering(true);
    setOrderMsg("");
    try {
      const res = await api<{
        authorization_url?: string;
        reference?: string;
        payment_intent?: string;
        orderId?: string;
      }>(`/api/orders/create-payment-intent/${id}`, { method: "POST" });

      if (res.authorization_url) {
        window.location.href = res.authorization_url;
        return;
      }

      setOrderMsg(
        `Payment started (${res.reference || res.payment_intent}). Complete checkout, then confirm from Orders.`
      );
      router.push("/orders");
    } catch (err) {
      setOrderMsg(
        err instanceof ApiError ? err.message : "Could not start order"
      );
    } finally {
      setOrdering(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNav />
      <main className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-lg">
        {error ? <p className="text-error">{error}</p> : null}
        {!gig && !error ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : null}
        {gig ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-xl">
            <div className="lg:col-span-3 space-y-md">
              <div className="rounded-card overflow-hidden border border-outline-variant bg-surface-container aspect-[16/10]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrl(gig.cover)}
                  alt={gig.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="font-label-caps text-on-surface-variant mb-xs">
                  {gig.cat}
                </p>
                <h1 className="font-page-title text-primary mb-sm">
                  {gig.title}
                </h1>
                {gig.status ? <StatusChip status={gig.status} /> : null}
              </div>
              <div className="prose-none text-on-surface whitespace-pre-wrap">
                {gig.desc}
              </div>
              {gig.features?.length ? (
                <ul className="list-disc pl-md space-y-xs text-on-surface-variant">
                  {gig.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <aside className="lg:col-span-2">
              <div className="sticky top-24 bg-surface-container-lowest border border-outline-variant rounded-card p-lg space-y-md">
                <p className="font-label-caps text-on-surface-variant">Price</p>
                <p className="font-data-price text-2xl text-primary">
                  GHS {Number(gig.price).toLocaleString()}
                </p>
                {gig.location?.city ? (
                  <p className="font-body-dense text-on-surface-variant">
                    {gig.location.city}
                    {gig.location.region ? `, ${gig.location.region}` : ""}
                  </p>
                ) : null}
                <Button
                  variant="conversion"
                  className="w-full rounded-xl"
                  onClick={orderNow}
                  loading={ordering}
                >
                  Order / Pay
                </Button>
                <Link
                  href="/discover"
                  className="block text-center font-body-dense text-primary-container hover:underline"
                >
                  Back to discover
                </Link>
                {orderMsg ? (
                  <p className="font-body-dense text-on-surface-variant">
                    {orderMsg}
                  </p>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}
      </main>
    </div>
  );
}

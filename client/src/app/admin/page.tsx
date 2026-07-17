"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Overview = {
  totalUsers?: number;
  newUsersThisMonth?: number;
  verifiedUsers?: number;
  bannedUsers?: number;
  sellers?: number;
  employers?: number;
  totalGigs?: number;
  pendingGigs?: number;
  approvedGigs?: number;
  rejectedGigs?: number;
  totalOrders?: number;
  completedOrders?: number;
  pendingOrders?: number;
  disputedOrders?: number;
  pendingPayouts?: number;
  approvedPayouts?: number;
  totalRevenue?: number;
  monthlyRevenue?: number;
  totalPlatformFees?: number;
  monthlyPlatformFees?: number;
};

type RecentUser = {
  _id: string;
  username: string;
  email?: string;
  isVerified?: boolean;
  isBanned?: boolean;
  createdAt?: string;
};

type RecentGig = {
  _id: string;
  title: string;
  status?: string;
  price?: number;
  createdAt?: string;
  userId?: { username?: string } | string;
};

type RecentOrder = {
  _id: string;
  title: string;
  price?: number;
  status?: string;
  createdAt?: string;
  buyerId?: { username?: string } | string;
  sellerId?: { username?: string } | string;
};

function money(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  return `GHS ${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function nameOf(v?: { username?: string } | string) {
  if (!v) return "—";
  if (typeof v === "string") return v;
  return v.username || "—";
}

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentGigs, setRecentGigs] = useState<RecentGig[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.isAdmin) return;
    api<{
      overview: Overview;
      recentActivities?: {
        recentUsers?: RecentUser[];
        recentGigs?: RecentGig[];
        recentOrders?: RecentOrder[];
      };
    }>("/api/admin/dashboard")
      .then((res) => {
        setOverview(res.overview || null);
        setRecentUsers(res.recentActivities?.recentUsers || []);
        setRecentGigs(res.recentActivities?.recentGigs || []);
        setRecentOrders(res.recentActivities?.recentOrders || []);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Admin load failed")
      );
  }, [user]);

  if (!user?.isAdmin) return null;

  const cards = [
    { label: "Users", value: overview?.totalUsers, href: "/admin/users" },
    { label: "Workers", value: overview?.sellers, href: "/admin/users?role=worker" },
    {
      label: "Employers",
      value: overview?.employers,
      href: "/admin/users?role=employer",
    },
    {
      label: "Pending gigs",
      value: overview?.pendingGigs,
      href: "/admin/gigs?status=pending",
    },
    { label: "Live gigs", value: overview?.approvedGigs, href: "/admin/gigs?status=approved" },
    { label: "Orders", value: overview?.totalOrders, href: "/admin/orders" },
    {
      label: "Open disputes",
      value: overview?.disputedOrders,
      href: "/admin/orders?disputeStatus=open",
    },
    {
      label: "Pending payouts",
      value: overview?.pendingPayouts,
      href: "/admin/payouts?status=pending",
    },
    {
      label: "Banned",
      value: overview?.bannedUsers,
      href: "/admin/users?status=banned",
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-md mb-lg">
        <div>
          <h1 className="font-page-title text-primary">Admin overview</h1>
          <p className="font-body-dense text-on-surface-variant mt-xs">
            Manage users, moderate listings, and resolve orders from one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-sm">
          <Link href="/admin/payouts">
            <Button variant="conversion">Review payouts</Button>
          </Link>
          <Link href="/admin/gigs?status=pending">
            <Button variant="outline">Review pending gigs</Button>
          </Link>
          <Link href="/admin/users">
            <Button variant="outline">Manage users</Button>
          </Link>
        </div>
      </div>

      {error ? <p className="text-error mb-md">{error}</p> : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-md mb-lg">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="p-md bg-surface-container-lowest border border-outline-variant rounded-card hover:border-primary-container transition"
          >
            <p className="font-label-caps text-on-surface-variant mb-xs">
              {c.label}
            </p>
            <p className="font-data-price text-xl text-primary">
              {c.value ?? "—"}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-md mb-lg">
        <div className="p-md bg-surface-container-lowest border border-outline-variant rounded-card">
          <p className="font-label-caps text-on-surface-variant mb-xs">
            Total revenue
          </p>
          <p className="font-data-price text-lg text-primary">
            {money(overview?.totalRevenue)}
          </p>
        </div>
        <div className="p-md bg-surface-container-lowest border border-outline-variant rounded-card">
          <p className="font-label-caps text-on-surface-variant mb-xs">
            This month
          </p>
          <p className="font-data-price text-lg text-primary">
            {money(overview?.monthlyRevenue)}
          </p>
        </div>
        <div className="p-md bg-surface-container-lowest border border-outline-variant rounded-card">
          <p className="font-label-caps text-on-surface-variant mb-xs">
            Platform fees
          </p>
          <p className="font-data-price text-lg text-primary">
            {money(overview?.totalPlatformFees)}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-lg">
        <section>
          <div className="flex items-center justify-between mb-md">
            <h2 className="font-section-title text-primary">Recent users</h2>
            <Link
              href="/admin/users"
              className="font-body-dense text-primary-container hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="space-y-sm">
            {recentUsers.length === 0 ? (
              <li className="font-body-dense text-on-surface-variant">
                No users yet
              </li>
            ) : (
              recentUsers.map((u) => (
                <li
                  key={u._id}
                  className="p-sm bg-surface-container-lowest border border-outline-variant rounded-md flex items-center justify-between gap-sm"
                >
                  <div className="min-w-0">
                    <p className="font-body-dense font-semibold truncate">
                      {u.username}
                    </p>
                    <p className="font-body-dense text-on-surface-variant truncate">
                      {u.email}
                    </p>
                  </div>
                  {u.isBanned ? (
                    <StatusChip status="rejected" label="banned" />
                  ) : u.isVerified ? (
                    <StatusChip status="verified" />
                  ) : (
                    <StatusChip status="pending" />
                  )}
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <div className="flex items-center justify-between mb-md">
            <h2 className="font-section-title text-primary">Recent gigs</h2>
            <Link
              href="/admin/gigs"
              className="font-body-dense text-primary-container hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="space-y-sm">
            {recentGigs.length === 0 ? (
              <li className="font-body-dense text-on-surface-variant">
                No gigs yet
              </li>
            ) : (
              recentGigs.map((g) => (
                <li
                  key={g._id}
                  className="p-sm bg-surface-container-lowest border border-outline-variant rounded-md"
                >
                  <div className="flex items-start justify-between gap-sm">
                    <p className="font-body-dense font-semibold line-clamp-2">
                      {g.title}
                    </p>
                    <StatusChip status={g.status} />
                  </div>
                  <p className="font-body-dense text-on-surface-variant mt-xs">
                    {nameOf(g.userId)} · {money(g.price)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <div className="flex items-center justify-between mb-md">
            <h2 className="font-section-title text-primary">Recent orders</h2>
            <Link
              href="/admin/orders"
              className="font-body-dense text-primary-container hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="space-y-sm">
            {recentOrders.length === 0 ? (
              <li className="font-body-dense text-on-surface-variant">
                No orders yet
              </li>
            ) : (
              recentOrders.map((o) => (
                <li
                  key={o._id}
                  className="p-sm bg-surface-container-lowest border border-outline-variant rounded-md"
                >
                  <div className="flex items-start justify-between gap-sm">
                    <p className="font-body-dense font-semibold line-clamp-2">
                      {o.title}
                    </p>
                    <StatusChip status={o.status} />
                  </div>
                  <p className="font-body-dense text-on-surface-variant mt-xs">
                    {nameOf(o.buyerId)} → {nameOf(o.sellerId)} ·{" "}
                    {money(o.price)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

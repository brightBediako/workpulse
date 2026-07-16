"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Notification } from "@/lib/types";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function load() {
    const res = await api<{
      notifications: Notification[];
      unreadCount: number;
    }>("/api/notifications");
    setItems(res.notifications || []);
    setUnreadCount(res.unreadCount || 0);
  }

  useEffect(() => {
    if (user) load().catch(() => {});
  }, [user]);

  async function markAll() {
    await api("/api/notifications/read-all", { method: "PUT" });
    await load();
  }

  if (!user) {
    return (
      <div>
        <MarketplaceNav />
        <main className="max-w-container mx-auto p-lg">
          <EmptyState
            title="Sign in required"
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
        <div className="flex items-center justify-between mb-lg">
          <div>
            <h1 className="font-page-title text-primary">Notifications</h1>
            <p className="font-body-dense text-on-surface-variant">
              {unreadCount} unread
            </p>
          </div>
          <Button variant="outline" onClick={markAll}>
            Mark all read
          </Button>
        </div>
        {items.length === 0 ? (
          <EmptyState title="You're all caught up" />
        ) : (
          <ul className="space-y-sm">
            {items.map((n) => (
              <li
                key={n._id}
                className={`p-md rounded-card border border-outline-variant ${
                  n.read ? "bg-surface" : "bg-surface-container-lowest"
                }`}
              >
                <p className="font-body-dense text-on-surface">{n.message}</p>
                <p className="font-label-caps text-on-surface-variant mt-xs">
                  {n.type}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

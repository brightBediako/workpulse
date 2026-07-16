"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Conversation } from "@/lib/types";

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!user) return;
    api<Conversation[]>("/api/conversations")
      .then((data) => setConversations(Array.isArray(data) ? data : []))
      .catch(() => setConversations([]));
  }, [user]);

  if (!user) {
    return (
      <div>
        <MarketplaceNav />
        <main className="max-w-container mx-auto p-lg">
          <EmptyState
            title="Sign in to message"
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
        <h1 className="font-page-title text-primary mb-lg">Messages</h1>
        {conversations.length === 0 ? (
          <EmptyState
            title="No conversations yet"
            description="Start a conversation from an order or worker profile."
          />
        ) : (
          <ul className="divide-y divide-surface-container-low border border-outline-variant rounded-card bg-surface-container-lowest">
            {conversations.map((c) => (
              <li key={c.id} className="p-md hover:bg-surface-container-low">
                <p className="font-section-title text-primary">{c.id}</p>
                <p className="font-body-dense text-on-surface-variant line-clamp-1">
                  {c.lastMessage || "No messages yet"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

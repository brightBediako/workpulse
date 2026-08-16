"use client";

import { Suspense } from "react";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import ServiceRequestsPageContent from "./ServiceRequestsPageContent";

export default function ServiceRequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background">
          <MarketplaceNav />
          <main className="max-w-container mx-auto p-lg">
            <p className="text-on-surface-variant">Loading…</p>
          </main>
        </div>
      }
    >
      <ServiceRequestsPageContent />
    </Suspense>
  );
}

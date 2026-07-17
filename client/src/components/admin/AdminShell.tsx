"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/gigs", label: "Gigs" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/payouts", label: "Payouts" },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MarketplaceNav />
        <main className="max-w-container mx-auto p-lg">
          <p className="font-body-main text-on-surface-variant">Loading…</p>
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
            title="Admin sign-in required"
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

  if (!user.isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <MarketplaceNav />
        <main className="max-w-container mx-auto p-lg">
          <EmptyState title="Admin access only" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNav />
      <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-lg flex flex-col md:flex-row gap-lg">
        <aside className="md:w-56 shrink-0 p-md bg-surface-container-low border border-outline-variant rounded-card h-fit sticky top-4">
          <p className="font-label-caps text-on-surface-variant mb-md">Admin</p>
          <nav className="space-y-sm font-body-dense">
            {NAV.map((item) => {
              const active = isActive(
                pathname,
                item.href,
                "exact" in item ? item.exact : false
              );
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-md px-sm py-xs transition ${
                    active
                      ? "font-semibold text-primary bg-surface-container"
                      : "text-primary-container hover:bg-surface-container"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="border-t border-outline-variant pt-sm mt-md space-y-sm">
              <Link
                href="/discover"
                className="block text-on-surface-variant hover:text-primary-container"
              >
                Marketplace
              </Link>
              {user.isSeller ? (
                <Link
                  href="/dashboard/gigs"
                  className="block text-on-surface-variant hover:text-primary-container"
                >
                  Worker dashboard
                </Link>
              ) : null}
            </div>
          </nav>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

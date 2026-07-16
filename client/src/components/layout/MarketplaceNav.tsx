"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api, getApiUrl, getStoredToken } from "@/lib/api";
import { io } from "socket.io-client";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { workspacesForUser } from "@/lib/workspace";

const links = [
  { href: "/discover", label: "Discover" },
  { href: "/orders", label: "Orders" },
  { href: "/messages", label: "Messages" },
  { href: "/jobs", label: "Jobs" },
];

export function MarketplaceNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const workspaces = workspacesForUser(user);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api<{ unreadCount: number }>("/api/notifications?limit=1")
      .then((res) => {
        if (!cancelled) setUnread(res.unreadCount || 0);
      })
      .catch(() => {});

    const token = getStoredToken();
    const socket = io(getApiUrl(), {
      auth: token ? { token } : undefined,
      withCredentials: true,
    });
    socket.on("notification:badge", (payload: { unreadCount?: number }) => {
      if (typeof payload?.unreadCount === "number") {
        setUnread(payload.unreadCount);
      }
    });
    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [user]);

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-outline-variant">
      <nav className="max-w-container mx-auto flex items-center justify-between h-16 px-margin-mobile md:px-margin-desktop">
        <div className="flex items-center gap-lg min-w-0">
          <Link href="/" className="font-page-title text-primary shrink-0">
            WorkPulse
          </Link>
          <div className="hidden md:flex gap-lg">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-[15px] transition-colors pb-1 ${
                  pathname.startsWith(l.href)
                    ? "text-primary font-bold border-b-2 border-primary"
                    : "text-on-surface-variant font-medium hover:text-primary"
                }`}
              >
                {l.label}
              </Link>
            ))}
            {user?.isSeller ? (
              <Link
                href="/dashboard/gigs"
                className={`text-[15px] transition-colors pb-1 ${
                  pathname.startsWith("/dashboard")
                    ? "text-primary font-bold border-b-2 border-primary"
                    : "text-on-surface-variant font-medium hover:text-primary"
                }`}
              >
                My gigs
              </Link>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-md shrink-0">
          {user ? (
            <>
              <div className="hidden sm:block">
                <WorkspaceSwitcher />
              </div>
              <Link href="/notifications" className="relative p-1">
                <Bell className="w-5 h-5 text-on-surface-variant" />
                {unread > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-error text-on-error text-[10px] flex items-center justify-center font-bold">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Link>
              <span className="hidden lg:inline font-body-dense text-on-surface-variant max-w-[8rem] truncate">
                {user.username}
              </span>
              <button
                type="button"
                onClick={() => logout()}
                className="hidden sm:inline font-body-dense text-primary-container hover:underline"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="font-medium text-on-surface-variant hover:text-primary"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="hidden sm:inline-flex bg-primary-container text-on-primary px-md py-sm rounded-md font-semibold text-sm"
              >
                Sign up
              </Link>
            </>
          )}
          <button
            type="button"
            className="md:hidden p-1"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>
      {open ? (
        <div className="md:hidden border-t border-outline-variant bg-surface px-margin-mobile py-md space-y-sm">
          {user && workspaces.length > 1 ? (
            <div className="pb-sm border-b border-outline-variant mb-sm">
              <p className="font-label-caps text-on-surface-variant mb-sm">
                Workspaces
              </p>
              <div className="space-y-sm">
                {workspaces.map((ws) => (
                  <Link
                    key={ws.id}
                    href={ws.href}
                    onClick={() => setOpen(false)}
                    className="block py-sm"
                  >
                    <span className="font-semibold text-primary">{ws.label}</span>
                    <span className="block font-body-dense text-on-surface-variant">
                      {ws.description}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-sm text-on-surface"
            >
              {l.label}
            </Link>
          ))}
          {user?.isSeller ? (
            <Link
              href="/dashboard/gigs"
              onClick={() => setOpen(false)}
              className="block py-sm"
            >
              My gigs
            </Link>
          ) : null}
          {user ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="block py-sm text-primary-container font-semibold"
            >
              Log out
            </button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

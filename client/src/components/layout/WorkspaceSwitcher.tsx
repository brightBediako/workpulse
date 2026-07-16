"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LayoutDashboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  setStoredWorkspace,
  workspaceFromPath,
  workspacesForUser,
  type Workspace,
} from "@/lib/workspace";

export function WorkspaceSwitcher({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const workspaces = workspacesForUser(user);
  const activeId = workspaceFromPath(pathname);
  const active =
    workspaces.find((w) => w.id === activeId) || workspaces[0] || null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (active) setStoredWorkspace(active.id);
  }, [active]);

  if (!user || workspaces.length < 2) return null;

  function go(ws: Workspace) {
    setStoredWorkspace(ws.id);
    setOpen(false);
    onNavigate?.();
    router.push(ws.href);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-sm h-9 px-3 rounded-md border border-outline-variant bg-surface-container-lowest text-sm font-semibold text-primary hover:bg-surface-container-low transition"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <LayoutDashboard className="w-4 h-4 text-primary-container" />
        <span className="max-w-[7rem] truncate">{active?.label || "Workspace"}</span>
        <ChevronDown
          className={`w-4 h-4 text-on-surface-variant transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-64 z-50 rounded-card border border-outline-variant bg-surface-container-lowest shadow-[0_8px_24px_rgba(18,25,22,0.08)] overflow-hidden"
        >
          <p className="font-label-caps text-on-surface-variant px-3 pt-3 pb-2">
            Switch workspace
          </p>
          <ul>
            {workspaces.map((ws) => {
              const isActive = ws.id === active?.id;
              return (
                <li key={ws.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => go(ws)}
                    className={`w-full text-left px-3 py-2.5 transition ${
                      isActive
                        ? "bg-primary-fixed/40 text-primary"
                        : "hover:bg-surface-container-low text-on-surface"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{ws.label}</span>
                    <span className="block font-body-dense text-on-surface-variant">
                      {ws.description}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-outline-variant px-3 py-2">
            <Link
              href="/discover"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="font-body-dense text-primary-container hover:underline"
            >
              Browse marketplace
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

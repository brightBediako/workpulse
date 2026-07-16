import type { User } from "./types";

export type WorkspaceId = "marketplace" | "worker" | "employer" | "admin";

export type Workspace = {
  id: WorkspaceId;
  label: string;
  description: string;
  href: string;
};

const STORAGE_KEY = "workpulse_workspace";

export function workspacesForUser(user: User | null): Workspace[] {
  if (!user) return [];

  const list: Workspace[] = [
    {
      id: "marketplace",
      label: "Marketplace",
      description: "Browse & hire services",
      href: "/discover",
    },
  ];

  if (user.isSeller || user.accountModes?.worker) {
    list.push({
      id: "worker",
      label: "Worker",
      description: "Manage your gigs",
      href: "/dashboard/gigs",
    });
  }

  if (user.isEmployer || user.accountModes?.employer) {
    list.push({
      id: "employer",
      label: "Employer",
      description: "Job posts & hiring",
      href: "/jobs",
    });
  }

  if (user.isAdmin || user.accountModes?.admin) {
    list.push({
      id: "admin",
      label: "Admin",
      description: "Platform console",
      href: "/admin",
    });
  }

  return list;
}

export function workspaceFromPath(pathname: string): WorkspaceId {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/dashboard")) return "worker";
  if (pathname.startsWith("/jobs")) return "employer";
  return "marketplace";
}

export function getStoredWorkspace(): WorkspaceId | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (
    raw === "marketplace" ||
    raw === "worker" ||
    raw === "employer" ||
    raw === "admin"
  ) {
    return raw;
  }
  return null;
}

export function setStoredWorkspace(id: WorkspaceId) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, id);
}

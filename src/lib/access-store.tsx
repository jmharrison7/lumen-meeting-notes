import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth-store";
import { listCollaborators } from "./api";
import type { Collaborator } from "./types";

const KEY = "lumen.previewAs.v1";

interface AccessState {
  /** Collaborator being previewed, or null for Owner (Mary). */
  previewing: Collaborator | null;
  collaborators: Collaborator[];
  previewAs: (collaboratorId: string | null) => void;
  isOwner: boolean;
  /** Owner: undefined (everything). Collaborator: the granted client ids. */
  grantedClientIds: string[] | undefined;
  canSeeClient: (clientId: string | undefined) => boolean;
  canContribute: boolean;
  canEdit: boolean;
  canManageAccess: boolean;
}

const Ctx = createContext<AccessState | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { user, grants } = useAuth();
  const { data } = useQuery({ queryKey: ["collaborators"], queryFn: listCollaborators });
  const collaborators = useMemo(() => data ?? [], [data]);

  useEffect(() => {
    try {
      setPreviewId(window.localStorage.getItem(KEY));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const previewAs = useCallback((id: string | null) => {
    setPreviewId(id);
    try {
      if (id) window.localStorage.setItem(KEY, id);
      else window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const previewing = hydrated ? collaborators.find((c) => c.id === previewId) ?? null : null;

  const value = useMemo<AccessState>(() => {
    const actualOwner = user?.role === "owner" || !user?.role;
    const isOwner = actualOwner && !previewing;
    const effectiveClientIds = previewing
      ? previewing.clientIds
      : actualOwner
        ? undefined
        : grants.map((g) => g.clientId);
    const strongestGrant = grants.some((g) => g.access === "editor")
      ? "editor"
      : grants.some((g) => g.access === "contributor")
        ? "contributor"
        : "viewer";
    const effectiveRole = previewing?.role ?? (actualOwner ? "editor" : strongestGrant);
    return {
      previewing,
      collaborators,
      previewAs,
      isOwner,
      grantedClientIds: isOwner ? undefined : effectiveClientIds,
      canSeeClient: (clientId) =>
        isOwner || (!!clientId && !!effectiveClientIds?.includes(clientId)),
      canContribute: isOwner || effectiveRole === "contributor" || effectiveRole === "editor",
      canEdit: isOwner || effectiveRole === "editor",
      canManageAccess: isOwner,
    };
  }, [previewing, collaborators, previewAs, user, grants]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccess() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAccess must be used inside AccessProvider");
  return ctx;
}

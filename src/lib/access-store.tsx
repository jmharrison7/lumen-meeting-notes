import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
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
  canEdit: boolean;
  canManageAccess: boolean;
}

const Ctx = createContext<AccessState | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
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
    const isOwner = !previewing;
    return {
      previewing,
      collaborators,
      previewAs,
      isOwner,
      grantedClientIds: isOwner ? undefined : previewing!.clientIds,
      canSeeClient: (clientId) =>
        isOwner || (!!clientId && previewing!.clientIds.includes(clientId)),
      canEdit: isOwner || previewing!.role === "editor",
      canManageAccess: isOwner,
    };
  }, [previewing, collaborators, previewAs]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccess() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAccess must be used inside AccessProvider");
  return ctx;
}

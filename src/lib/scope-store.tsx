import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Client, ClientScope } from "./types";

const KEY = "lumen.scope.v1";

interface ScopeState {
  scope: ClientScope;
  setScope: (scope: ClientScope) => void;
  isInScope: (client?: Client | undefined) => boolean;
}

const Ctx = createContext<ScopeState | null>(null);

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setRawScope] = useState<ClientScope>("work");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved === "work" || saved === "personal") setRawScope(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setScope = useCallback((next: ClientScope) => {
    setRawScope(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ScopeState>(
    () => ({
      scope,
      setScope,
      isInScope: (client) => (client?.scope ?? "work") === scope,
    }),
    [scope, setScope],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScope() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useScope must be used inside ScopeProvider");
  return ctx;
}

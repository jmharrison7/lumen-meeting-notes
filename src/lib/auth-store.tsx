import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { signOut as apiSignOut, whoAmI, type AuthUser, type WhoAmI } from "./api";

type Status = "loading" | "signedOut" | "signedIn";

interface AuthState {
  status: Status;
  user: AuthUser | null;
  grants: Extract<WhoAmI, { authenticated: true }>["grants"];
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [grants, setGrants] = useState<Extract<WhoAmI, { authenticated: true }>["grants"]>([]);

  const refresh = useCallback(async () => {
    try {
      const me = await whoAmI();
      if (me.authenticated) {
        setUser(me.user);
        setGrants(me.grants);
        setStatus("signedIn");
      } else {
        setUser(null);
        setGrants([]);
        setStatus("signedOut");
      }
    } catch {
      setUser(null);
      setGrants([]);
      setStatus("signedOut");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setGrants([]);
      setStatus("signedOut");
    };
    window.addEventListener("lumen:unauthorized", onUnauthorized);
    return () => window.removeEventListener("lumen:unauthorized", onUnauthorized);
  }, []);

  const signOut = useCallback(async () => {
    await apiSignOut();
    setUser(null);
    setGrants([]);
    setStatus("signedOut");
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, user, grants, refresh, signOut }),
    [status, user, grants, refresh, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

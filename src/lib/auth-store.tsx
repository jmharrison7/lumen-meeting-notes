import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { signOut as apiSignOut, whoAmI, type AuthUser } from "./api";

type Status = "loading" | "signedOut" | "signedIn";

interface AuthState {
  status: Status;
  user: AuthUser | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await whoAmI();
      if (me.authenticated) {
        setUser(me.user);
        setStatus("signedIn");
      } else {
        setUser(null);
        setStatus("signedOut");
      }
    } catch {
      setUser(null);
      setStatus("signedOut");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setStatus("signedOut");
    };
    window.addEventListener("lumen:unauthorized", onUnauthorized);
    return () => window.removeEventListener("lumen:unauthorized", onUnauthorized);
  }, []);

  const signOut = useCallback(async () => {
    await apiSignOut();
    setUser(null);
    setStatus("signedOut");
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, user, refresh, signOut }),
    [status, user, refresh, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

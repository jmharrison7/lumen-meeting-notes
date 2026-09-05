import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-store";
import { SignIn } from "./SignIn";

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="w-full max-w-sm space-y-3" aria-busy="true" aria-label="Loading Lumen">
          <div className="h-6 w-32 animate-pulse rounded-md bg-muted" />
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (status === "signedOut") return <SignIn />;

  return <>{children}</>;
}

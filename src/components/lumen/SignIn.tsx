import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { requestMagicLink } from "@/lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError("That doesn't look like an email address yet.");
      return;
    }
    setError(null);
    setState("sending");
    try {
      await requestMagicLink(value);
      setState("sent");
    } catch {
      setState("idle");
      setError("We couldn't send that link just now. Try again in a moment.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-baseline gap-2">
          <span className="text-title text-[26px] font-semibold">Lumen</span>
          <span className="size-1.5 rounded-full bg-ember" />
        </div>

        <div className="rounded-2xl border border-hairline bg-card p-6 shadow-sm">
          {state === "sent" ? (
            <>
              <span className="grid size-9 place-items-center rounded-full bg-ember-soft text-ember">
                <Mail className="size-4" />
              </span>
              <h1 className="text-title mt-4 text-2xl font-semibold tracking-tight">
                Check {email}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Your sign-in link is on the way. It works for 15 minutes and keeps you signed in
                for 90 days.
              </p>
              <button
                onClick={() => setState("idle")}
                className="mt-5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Use a different address
              </button>
            </>
          ) : (
            <>
              <h1 className="text-title text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Pick up where you left off. Enter your email and we'll send a one-tap sign-in link.
              </p>
              <form onSubmit={submit} className="mt-5 space-y-3">
                <label className="block text-xs font-medium text-muted-foreground" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="mary@embr.studio"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
                {error ? <p className="text-xs text-destructive">{error}</p> : null}
                <button
                  type="submit"
                  disabled={state === "sending"}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ember px-3.5 py-2.5 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {state === "sending" ? <Loader2 className="size-4 animate-spin" /> : null}
                  Email me a sign-in link
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
          Links are emailed from Mary's Embr address. No passwords, ever.
        </p>
      </div>
    </main>
  );
}

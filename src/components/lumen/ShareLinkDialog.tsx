import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { createShareLink, listShareLinks, revokeShareLink } from "@/lib/api";
import { fullDate, relativeDate } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ShareTarget } from "@/lib/types";
import { cn } from "@/lib/utils";

const expiryOptions = [
  { label: "Never", days: undefined },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
] as const;

function linkUrl(token: string) {
  const host = typeof window === "undefined" ? "lumen.app" : window.location.host;
  return `https://${host}/shared/${token}`;
}

export function ShareLinkDialog({
  target,
  label,
  open,
  onOpenChange,
}: {
  target: ShareTarget;
  label: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const links = useQuery({ queryKey: ["shareLinks"], queryFn: listShareLinks });
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [expiry, setExpiry] = useState<number | undefined>(30);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: () => createShareLink({ target, label, permission, expiresInDays: expiry }),
    onSuccess: async (l) => {
      setCreated(l.token);
      await qc.invalidateQueries({ queryKey: ["shareLinks"] });
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeShareLink(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["shareLinks"] });
      toast.success("Link revoked");
    },
  });

  async function copy(token: string) {
    await navigator.clipboard.writeText(linkUrl(token));
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1600);
  }

  const all = links.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-title text-xl">Share a link</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          A one-off link to <span className="text-foreground">{label}</span> — for people who only
          need this once.
        </p>

        <div className="mt-2 space-y-3 rounded-xl border border-hairline bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">They can</span>
            {(["view", "edit"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPermission(p)}
                className={cn(
                  "min-h-[36px] rounded-full border px-3 text-xs capitalize transition-colors",
                  permission === p
                    ? "border-ember bg-ember-soft text-ember"
                    : "border-hairline text-muted-foreground hover:text-foreground",
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Expires</span>
            {expiryOptions.map((o) => (
              <button
                key={o.label}
                onClick={() => setExpiry(o.days)}
                className={cn(
                  "min-h-[36px] rounded-full border px-3 text-xs transition-colors",
                  expiry === o.days
                    ? "border-ember bg-ember-soft text-ember"
                    : "border-hairline text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          {created ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-ember-soft/60 p-3">
              <code className="min-w-0 flex-1 truncate text-xs text-foreground">
                {linkUrl(created)}
              </code>
              <button
                onClick={() => void copy(created)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-ember px-3 text-xs font-medium text-[oklch(0.99_0.005_85)]"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copy
              </button>
            </div>
          ) : (
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-ember px-3.5 text-sm font-medium text-[oklch(0.99_0.005_85)] disabled:opacity-60"
            >
              <Link2 className="size-4" /> {create.isPending ? "Creating…" : "Create link"}
            </button>
          )}
        </div>

        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Manage links
          </h3>
          {all.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No links yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {all.map((l) => {
                const expired =
                  !!l.expiresAtISO && new Date(l.expiresAtISO).getTime() < Date.now();
                const dead = l.revoked || expired;
                return (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{l.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.permission === "edit" ? "Can edit" : "View only"} ·{" "}
                        {l.expiresAtISO ? (
                          <span title={fullDate(l.expiresAtISO)}>
                            expires {relativeDate(l.expiresAtISO).toLowerCase()}
                          </span>
                        ) : (
                          "no expiry"
                        )}{" "}
                        · created <span title={fullDate(l.createdAtISO)}>
                          {relativeDate(l.createdAtISO).toLowerCase()}
                        </span>
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px]",
                        dead ? "bg-muted text-muted-foreground" : "bg-ember-soft text-ember",
                      )}
                    >
                      {l.revoked ? "Revoked" : expired ? "Expired" : "Active"}
                    </span>
                    <button
                      disabled={dead}
                      onClick={() => void copy(l.token)}
                      className="min-h-[36px] rounded-lg border border-hairline px-2.5 text-xs disabled:opacity-40"
                    >
                      Copy
                    </button>
                    {!l.revoked ? (
                      <button
                        onClick={() => revoke.mutate(l.id)}
                        className="min-h-[36px] rounded-lg px-2.5 text-xs text-muted-foreground hover:text-destructive"
                      >
                        Revoke
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Links open once sharing is live.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

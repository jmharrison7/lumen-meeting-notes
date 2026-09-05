import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  inviteCollaborator,
  listCollaborators,
  removeCollaboratorFromClient,
  updateCollaboratorAccess,
} from "@/lib/api";
import { relativeDate, fullDate } from "@/lib/format";
import { EmptyState, ListSkeleton } from "@/components/lumen/primitives";
import { cn } from "@/lib/utils";
import type { CollaboratorRole } from "@/lib/types";

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export function AccessPanel({ clientId, clientName }: { clientId: string; clientName: string }) {
  const qc = useQueryClient();
  const people = useQuery({ queryKey: ["collaborators"], queryFn: listCollaborators });
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("editor");
  const [error, setError] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["collaborators"] });

  const invite = useMutation({
    mutationFn: () =>
      inviteCollaborator({ email, ...(name ? { name } : {}), role, clientIds: [clientId] }),
    onSuccess: async (p) => {
      await refresh();
      setEmail("");
      setName("");
      setRole("editor");
      setOpen(false);
      toast.success(`Invite sent to ${p.email}`);
    },
  });

  const setRoleFor = useMutation({
    mutationFn: (v: { id: string; role: CollaboratorRole }) =>
      updateCollaboratorAccess(v.id, { role: v.role }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeCollaboratorFromClient(id, clientId),
    onSuccess: async (p) => {
      await refresh();
      toast.success(`${p?.name ?? p?.email ?? "They"} no longer have access to ${clientName}`);
    },
  });

  const list = (people.data ?? []).filter((c) => c.clientIds.includes(clientId));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-title text-lg font-semibold">Who can see {clientName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Collaborators only ever see the clients you list here.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-hairline bg-card px-3 text-sm transition-colors hover:border-ember/40 hover:bg-ember-soft hover:text-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <UserPlus className="size-4" /> Invite collaborator
        </button>
      </div>

      {open ? (
        <form
          className="grid gap-3 rounded-xl border border-hairline bg-card p-4 sm:grid-cols-[1.4fr_1fr_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!emailOk(email)) {
              setError("That doesn't look like an email address.");
              return;
            }
            setError("");
            invite.mutate();
          }}
        >
          <label className="text-xs text-muted-foreground">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jamie@studio.com"
              aria-label="Collaborator email"
              className="mt-1 h-11 w-full rounded-lg border border-hairline bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Name (optional)
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jamie"
              aria-label="Collaborator name"
              className="mt-1 h-11 w-full rounded-lg border border-hairline bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as CollaboratorRole)}
              aria-label="Collaborator role"
              className="mt-1 h-11 w-full rounded-lg border border-hairline bg-background px-2 text-sm text-foreground"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={invite.isPending}
            className="mt-[18px] h-11 rounded-lg bg-ember px-4 text-sm font-medium text-[oklch(0.99_0.005_85)] disabled:opacity-60"
          >
            {invite.isPending ? "Inviting…" : "Send invite"}
          </button>
          {error ? <p className="text-xs text-destructive sm:col-span-4">{error}</p> : null}
        </form>
      ) : null}

      {people.isLoading ? (
        <ListSkeleton rows={2} />
      ) : list.length === 0 ? (
        <EmptyState
          title="No collaborators on this client yet"
          body="Invite a contractor and they'll see only this client's notes, files and ideas."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-hairline bg-card">
          {list.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name ?? c.email}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.name ? `${c.email} · ` : ""}
                  {c.status === "invited" ? "Invited" : "Active"} ·{" "}
                  {c.lastActiveAt ? (
                    <span title={fullDate(c.lastActiveAt)}>
                      last active {relativeDate(c.lastActiveAt).toLowerCase()}
                    </span>
                  ) : (
                    "never signed in"
                  )}
                </p>
              </div>
              <select
                value={c.role}
                aria-label={`Role for ${c.name ?? c.email}`}
                onChange={(e) =>
                  setRoleFor.mutate({ id: c.id, role: e.target.value as CollaboratorRole })
                }
                className={cn(
                  "h-9 rounded-full border border-hairline bg-background px-2 text-xs",
                  c.role === "editor" ? "text-ember" : "text-muted-foreground",
                )}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={() => remove.mutate(c.id)}
                aria-label={`Remove ${c.name ?? c.email} from ${clientName}`}
                className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Removing someone revokes their access immediately.
      </p>
    </div>
  );
}

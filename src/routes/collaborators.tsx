import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { listClients, listCollaborators, removeCollaborator, updateCollaboratorAccess } from "@/lib/api";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/lumen/primitives";
import { fullDate, relativeDate } from "@/lib/format";
import { useAccess } from "@/lib/access-store";
import type { CollaboratorRole } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/collaborators")({
  head: () => ({
    meta: [
      { title: "Collaborators — Lumen" },
      {
        name: "description",
        content:
          "Everyone outside the studio with access to a Lumen client: their role, the clients they can open, and how to remove them.",
      },
      { property: "og:title", content: "Collaborators — Lumen" },
      {
        property: "og:description",
        content: "Manage contractor access to individual client workspaces.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CollaboratorsPage,
});

function CollaboratorsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isOwner } = useAccess();
  const people = useQuery({ queryKey: ["collaborators"], queryFn: listCollaborators });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });

  useEffect(() => {
    if (!isOwner) void navigate({ to: "/" });
  }, [isOwner, navigate]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["collaborators"] });

  const setRole = useMutation({
    mutationFn: (v: { id: string; role: CollaboratorRole }) =>
      updateCollaboratorAccess(v.id, { role: v.role }),
    onSuccess: refresh,
  });

  const removeAll = useMutation({
    mutationFn: (id: string) => removeCollaborator(id),
    onSuccess: async () => {
      await refresh();
      toast.success("Access revoked everywhere");
    },
  });

  const nameOf = (id: string) => (clients.data ?? []).find((c) => c.id === id)?.name ?? "Client";
  const list = people.data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-title text-3xl font-semibold tracking-tight">Collaborators</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Freelancers and contractors, and exactly which clients they can open.
        </p>
      </header>

      {people.isError ? (
        <ErrorState onRetry={() => void people.refetch()} />
      ) : people.isLoading ? (
        <ListSkeleton rows={3} />
      ) : list.length === 0 ? (
        <EmptyState
          title="No collaborators yet"
          body="Open a client and invite someone from its Access tab — they'll see only that client."
          actionLabel="Browse clients"
          actionTo="/clients"
        />
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <div key={c.id} className="rounded-xl border border-hairline bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-title text-lg font-semibold">{c.name ?? c.email}</p>
                  <p className="text-xs text-muted-foreground">
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
                    setRole.mutate({ id: c.id, role: e.target.value as CollaboratorRole })
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
                  onClick={() => {
                    if (window.confirm(`Remove ${c.name ?? c.email} from every client?`))
                      removeAll.mutate(c.id);
                  }}
                  className="min-h-[36px] rounded-lg border border-hairline px-2.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
                >
                  Remove entirely
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.clientIds.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No clients granted.</span>
                ) : (
                  c.clientIds.map((id) => (
                    <Link
                      key={id}
                      to="/clients/$clientId"
                      params={{ clientId: id }}
                      className="rounded-full border border-hairline px-2.5 py-1 text-xs transition-colors hover:border-ember/40 hover:text-ember"
                    >
                      {nameOf(id)} · {c.role === "editor" ? "Editor" : "Viewer"}
                    </Link>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Removing someone revokes access immediately.
      </p>
    </div>
  );
}

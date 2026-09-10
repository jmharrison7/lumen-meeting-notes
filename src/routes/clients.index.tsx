import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listClients, listNotes } from "@/lib/api";
import { fullDate, relativeDate, tagStyles } from "@/lib/format";
import { EmptyState, ErrorState } from "@/components/lumen/primitives";
import { cn } from "@/lib/utils";
import { useAccess } from "@/lib/access-store";
import { useScope } from "@/lib/scope-store";
import type { Client, Note } from "@/lib/types";

export const Route = createFileRoute("/clients/")({
  head: () => ({
    meta: [
      { title: "Clients — Lumen" },
      {
        name: "description",
        content: "Every client account with meeting counts, the latest note, and a way in.",
      },
      { property: "og:title", content: "Clients — Lumen" },
      {
        property: "og:description",
        content: "Client accounts with meeting counts and the latest write-up.",
      },
    ],
  }),
  component: ClientsPage,
});

function ClientCard({ client, latest, dim }: { client: Client; latest?: Note | undefined; dim?: boolean }) {
  return (
    <Link
      to="/clients/$clientId"
      params={{ clientId: client.id }}
      className={cn(
        "group flex flex-col rounded-xl border border-hairline bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft",
        dim && "opacity-70 hover:opacity-100",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn("size-2.5 rounded-full", tagStyles[client.tagColor].split(" ")[0])} />
        <h2 className="text-title text-lg font-semibold">{client.name}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {client.meetingsThisMonth ?? 0} meetings in the last 30 days
        {client.lastMeetingAt ? (
          <span title={fullDate(client.lastMeetingAt)}> · last {relativeDate(client.lastMeetingAt).toLowerCase()}</span>
        ) : null}
      </p>
      {latest?.summary ? (
        <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{latest.summary}</p>
      ) : (
        <p className="mt-4 text-sm italic text-muted-foreground">No notes yet.</p>
      )}
      {client.note ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground/70">{client.note}</p> : null}
      <span className="mt-4 text-xs text-muted-foreground transition-colors group-hover:text-ember">
        Open workspace →
      </span>
    </Link>
  );
}

function ClientsPage() {
  const { canSeeClient } = useAccess();
  const { scope } = useScope();
  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const clients = {
    ...clientsQuery,
    data: (clientsQuery.data ?? []).filter((c) => canSeeClient(c.id) && (c.scope ?? "work") === scope),
  };
  const notes = useQuery({ queryKey: ["notes"], queryFn: listNotes });
  const [showPast, setShowPast] = useState(false);

  const latestFor = (id: string) =>
    (notes.data ?? [])
      .filter((n) => n.clientId === id)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

  const all = (clients.data ?? []) as Client[];
  const active = all
    .filter((c) => !c.status || c.status === "active")
    .sort((a, b) => (b.meetingsThisMonth ?? 0) - (a.meetingsThisMonth ?? 0));
  const past = all
    .filter((c) => c.status === "archived" || c.status === "potential")
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8">
      <header>
          <h1 className="text-title text-3xl font-semibold tracking-tight">
            {scope === "personal" ? "Personal areas" : "Clients"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {scope === "personal"
              ? "Events, family planning and home projects with their own notes, files and next steps."
              : "Where the work lives. Open one to see only its notes."}
          </p>
      </header>

      {clients.isError ? (
        <ErrorState onRetry={() => void clients.refetch()} />
      ) : clients.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-hairline bg-muted/60" />
          ))}
        </div>
      ) : active.length === 0 && past.length === 0 ? (
        <EmptyState
          title="No clients yet"
          body="Clients appear as soon as Lumen files your first meeting against one."
        />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {scope === "personal" ? "Current" : "Active"} · {active.length}
            </h2>
            {active.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">No active clients right now.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {active.map((c) => (
                  <ClientCard key={c.id} client={c} latest={latestFor(c.id)} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 ? (
            <section className="space-y-3 border-t border-hairline pt-6">
              <button
                onClick={() => setShowPast((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {scope === "personal" ? "Past personal areas" : "Past & potential"} · {past.length}
                </h2>
                <span className="text-xs text-muted-foreground">{showPast ? "Hide" : "Show"}</span>
              </button>
              {showPast ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {past.map((c) => (
                    <ClientCard key={c.id} client={c} latest={latestFor(c.id)} dim />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/70">
                  {past.map((c) => c.name).join(", ")} — click to expand.
                </p>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

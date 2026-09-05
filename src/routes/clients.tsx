import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listClients, listNotes } from "@/lib/api";
import { fullDate, relativeDate, tagStyles } from "@/lib/format";
import { EmptyState, ErrorState } from "@/components/lumen/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clients")({
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

function ClientsPage() {
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const notes = useQuery({ queryKey: ["notes"], queryFn: listNotes });

  const latestFor = (id: string) =>
    (notes.data ?? [])
      .filter((n) => n.clientId === id)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-title text-3xl font-semibold tracking-tight">Clients</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Where the work lives. Open one to see only its notes.
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
      ) : (clients.data ?? []).length === 0 ? (
        <EmptyState
          title="No clients yet"
          body="Clients appear as soon as Lumen files your first meeting against one."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(clients.data ?? []).map((c) => {
            const latest = latestFor(c.id);
            return (
              <Link
                key={c.id}
                to="/notes"
                search={{ client: c.id }}
                className="group flex flex-col rounded-xl border border-hairline bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div className="flex items-center gap-2.5">
                  <span className={cn("size-2.5 rounded-full", tagStyles[c.tagColor].split(" ")[0])} />
                  <h2 className="text-title text-lg font-semibold">{c.name}</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.meetingsThisMonth ?? 0} meetings in the last 30 days
                  {c.lastMeetingAt ? (
                    <span title={fullDate(c.lastMeetingAt)}> · last {relativeDate(c.lastMeetingAt).toLowerCase()}</span>
                  ) : null}
                </p>
                {latest ? (
                  <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {latest.summary}
                  </p>
                ) : (
                  <p className="mt-4 text-sm italic text-muted-foreground">No notes yet.</p>
                )}
                <span className="mt-4 text-xs text-muted-foreground transition-colors group-hover:text-ember">
                  View notes →
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

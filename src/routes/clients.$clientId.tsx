import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { listClients, listNotes } from "@/lib/api";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/lumen/primitives";
import { NoteRow } from "@/components/lumen/NoteRow";
import { FilesPanel } from "@/components/lumen/FilesPanel";
import { TemplatesPanel } from "@/components/lumen/TemplatesPanel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clients/$clientId")({
  head: () => ({
    meta: [
      { title: "Client workspace — Lumen" },
      {
        name: "description",
        content: "Notes, Drive docs, uploads and templates for a single client account.",
      },
      { property: "og:title", content: "Client workspace — Lumen" },
      {
        property: "og:description",
        content: "Everything for one client: meeting notes, files and templates.",
      },
    ],
  }),
  component: ClientDetail,
});

const tabs = ["Notes", "Files", "Templates"] as const;

function ClientDetail() {
  const { clientId } = Route.useParams();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Notes");
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const notes = useQuery({ queryKey: ["notes"], queryFn: listNotes });

  const client = (clients.data ?? []).find((c) => c.id === clientId);
  const clientNotes = (notes.data ?? [])
    .filter((n) => n.clientId === clientId)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <Link
        to="/clients"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-ember"
      >
        <ArrowLeft className="size-3.5" /> All clients
      </Link>

      <header>
        <h1 className="text-title text-3xl font-semibold tracking-tight">
          {client?.name ?? "Client"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Notes, working documents and templates in one place.
        </p>
      </header>

      <div role="tablist" aria-label="Client sections" className="flex gap-1 border-b border-hairline">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px min-h-[44px] border-b-2 px-3 text-sm transition-colors",
              tab === t
                ? "border-ember font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Notes" ? (
        notes.isError ? (
          <ErrorState onRetry={() => void notes.refetch()} />
        ) : notes.isLoading ? (
          <ListSkeleton rows={4} />
        ) : clientNotes.length === 0 ? (
          <EmptyState
            title="No notes for this client yet"
            body="The next meeting Lumen captures for them will land here."
            actionLabel="Browse all notes"
            actionTo="/notes"
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-hairline bg-card">
            {clientNotes.map((n) => (
              <NoteRow key={n.id} note={n} client={client} />
            ))}
          </div>
        )
      ) : tab === "Files" ? (
        <FilesPanel clientId={clientId} />
      ) : (
        <TemplatesPanel clientId={clientId} />
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { listClients, listNotes } from "@/lib/api";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/lumen/primitives";
import { NoteRow } from "@/components/lumen/NoteRow";
import { FilesPanel } from "@/components/lumen/FilesPanel";
import { TemplatesPanel } from "@/components/lumen/TemplatesPanel";
import { AskPanel } from "@/components/lumen/AskPanel";
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

const tabs = ["Notes", "Files", "Templates", "Ask"] as const;

function ClientDetail() {
  const { clientId } = Route.useParams();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Notes");
  const [askOpen, setAskOpen] = useState(false);
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

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h1 className="text-title text-3xl font-semibold tracking-tight">
          {client?.name ?? "Client"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Notes, working documents and templates in one place.
        </p>
        </div>
        <button
          onClick={() => setAskOpen(true)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-hairline bg-card px-3 text-sm transition-colors hover:border-ember/40 hover:bg-ember-soft hover:text-ember"
        >
          <Sparkles className="size-4" /> Ask Lumen
        </button>
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
      ) : tab === "Templates" ? (
        <TemplatesPanel clientId={clientId} />
      ) : (
        <div className="rounded-xl border border-hairline bg-card p-6">
          <p className="text-title text-lg">Ask Lumen about {client?.name ?? "this client"}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Questions answered from this account's meetings, transcripts and files.
          </p>
          <button
            onClick={() => setAskOpen(true)}
            className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-ember px-3.5 text-sm font-medium text-[oklch(0.99_0.005_85)]"
          >
            <Sparkles className="size-4" /> Open the Ask panel
          </button>
        </div>
      )}

      <AskPanel
        scope={{
          clientId,
          label: `${client?.name ?? "Client"} — all notes, files & transcripts`,
        }}
        open={askOpen}
        onOpenChange={setAskOpen}
      />
    </div>
  );
}

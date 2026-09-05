import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { listClients, searchNotes } from "@/lib/api";
import { EmptyState, ListSkeleton } from "@/components/lumen/primitives";
import { NoteRow } from "@/components/lumen/NoteRow";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — Lumen" },
      {
        name: "description",
        content:
          "Search instantly across meeting titles, summaries, decisions, and action items.",
      },
      { property: "og:title", content: "Search — Lumen" },
      {
        property: "og:description",
        content: "Instant search across titles, summaries, decisions, and action items.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 180);
    return () => clearTimeout(t);
  }, [q]);

  const results = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => searchNotes(debounced),
    enabled: debounced.trim().length > 0,
  });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-title text-3xl font-semibold tracking-tight">Search</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Titles, summaries, decisions, action items — all of it.
        </p>
      </header>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={ref}
          data-search-input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQ("")}
          placeholder="Search everything…"
          className="h-12 w-full rounded-xl border border-hairline bg-card pl-11 pr-4 text-[15px] outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {!debounced.trim() ? (
        <EmptyState
          title="Start typing"
          body="Try a client name, a decision you half-remember, or the person who owed you something."
        />
      ) : results.isLoading ? (
        <ListSkeleton rows={3} />
      ) : (results.data ?? []).length === 0 ? (
        <EmptyState
          title={`Nothing for "${debounced}"`}
          body="No note mentions that yet. Check a different spelling or browse the full archive."
          actionLabel="All notes"
          actionTo="/notes"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-hairline bg-card">
          {(results.data ?? []).map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              client={clients.data?.find((c) => c.id === n.clientId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

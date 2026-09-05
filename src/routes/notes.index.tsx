import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import { deleteNotes, listClients, listNotes } from "@/lib/api";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/lumen/primitives";
import { NoteRow } from "@/components/lumen/NoteRow";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notes/")({
  head: () => ({
    meta: [
      { title: "All notes — Lumen" },
      {
        name: "description",
        content:
          "Every meeting write-up in one calm list. Filter by client, tag, or open action items and search as you type.",
      },
      { property: "og:title", content: "All notes — Lumen" },
      {
        property: "og:description",
        content: "Every meeting write-up in one calm list, filterable by client, tag, and date.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { client?: string } =>
    typeof search["client"] === "string" ? { client: search["client"] } : {},
  component: NotesPage,
});

type Sort = "newest" | "oldest" | "title";

function NotesPage() {
  const { client: clientParam } = Route.useSearch();
  const { hiddenNotes, hideNotes, applyItem } = useUi();
  const qc = useQueryClient();
  const notes = useQuery({ queryKey: ["notes"], queryFn: listNotes });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });

  const [q, setQ] = useState("");
  const [clientFilter, setClientFilter] = useState<string>(clientParam ?? "all");
  const [tagFilter, setTagFilter] = useState("all");
  const [onlyActions, setOnlyActions] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  const [selected, setSelected] = useState<string[]>([]);

  const allTags = useMemo(
    () => [...new Set((notes.data ?? []).flatMap((n) => n.tags))].sort(),
    [notes.data],
  );

  const rows = useMemo(() => {
    let list = (notes.data ?? []).filter((n) => !hiddenNotes.includes(n.id));
    if (clientFilter !== "all") list = list.filter((n) => n.clientId === clientFilter);
    if (tagFilter !== "all") list = list.filter((n) => n.tags.includes(tagFilter));
    if (onlyActions)
      list = list.filter((n) => n.actionItems.map(applyItem).some((a) => !a.done));
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((n) => (n.title + n.summary + n.tags.join(" ")).toLowerCase().includes(needle));
    }
    return [...list].sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "oldest"
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date),
    );
  }, [notes.data, hiddenNotes, clientFilter, tagFilter, onlyActions, q, sort, applyItem]);

  const clientOf = (id: string) => clients.data?.find((c) => c.id === id);

  async function removeSelected() {
    hideNotes(selected);
    await deleteNotes(selected);
    setSelected([]);
    await qc.invalidateQueries({ queryKey: ["notes"] });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title text-3xl font-semibold tracking-tight">All notes</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {rows.length} write-up{rows.length === 1 ? "" : "s"} in your studio archive.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            data-search-input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter notes…  (/)"
            className="h-10 w-full rounded-lg border border-hairline bg-card pl-9 pr-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={clientFilter} onChange={setClientFilter}>
          <option value="all">All clients</option>
          {(clients.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={tagFilter} onChange={setTagFilter}>
          <option value="all">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(v) => setSort(v as Sort)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">By title</option>
        </Select>
        <button
          onClick={() => setOnlyActions((v) => !v)}
          className={cn(
            "h-9 rounded-lg border border-hairline px-3 text-sm transition-colors",
            onlyActions ? "border-ember bg-ember-soft text-ember" : "bg-card hover:bg-accent",
          )}
        >
          Has action items
        </button>
      </div>

      {selected.length > 0 ? (
        <div className="animate-[rise_180ms_ease-out] flex items-center gap-3 rounded-lg border border-ember/40 bg-ember-soft/60 px-4 py-2.5 text-sm">
          <span className="font-medium text-ember">{selected.length} selected</span>
          <button
            onClick={removeSelected}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-ember transition-colors hover:bg-ember/10"
          >
            <Trash2 className="size-3.5" /> Delete
          </button>
          <button
            onClick={() => setSelected([])}
            className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" /> Clear
          </button>
        </div>
      ) : null}

      {notes.isError ? (
        <ErrorState onRetry={() => void notes.refetch()} />
      ) : notes.isLoading ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing matches those filters"
          body="Try clearing a filter, or search across every note instead."
          actionLabel="Go to search"
          actionTo="/search"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-hairline bg-card">
          {rows.map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              client={clientOf(n.clientId)}
              selectMode
              selected={selected.includes(n.id)}
              onSelect={(id, v) =>
                setSelected((s) => (v ? [...s, id] : s.filter((x) => x !== id)))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-hairline bg-card px-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30"
    >
      {children}
    </select>
  );
}

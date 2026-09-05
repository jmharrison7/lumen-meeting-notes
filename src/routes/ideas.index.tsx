import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteIdea, listClients, listIdeas } from "@/lib/api";
import { fullDate, relativeDate } from "@/lib/format";
import { ClientChip, EmptyState, ErrorState, ListSkeleton, SectionTitle } from "@/components/lumen/primitives";
import { QuickCapture } from "@/components/lumen/QuickCapture";

export const Route = createFileRoute("/ideas/")({
  head: () => ({
    meta: [
      { title: "Ideas — capture a thought in Lumen" },
      {
        name: "description",
        content:
          "Say it out loud, upload a voice memo or type it: Lumen keeps every stray studio idea in one calm place.",
      },
      { property: "og:title", content: "Ideas — capture a thought in Lumen" },
      {
        property: "og:description",
        content: "Voice, upload or text capture for ideas that don't belong to a meeting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IdeasPage,
});

function IdeasPage() {
  const qc = useQueryClient();
  const ideas = useQuery({ queryKey: ["ideas"], queryFn: listIdeas });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [q, setQ] = useState("");
  const [client, setClient] = useState("all");
  const [tag, setTag] = useState("all");

  const all = ideas.data ?? [];
  const allTags = useMemo(
    () => Array.from(new Set(all.flatMap((i) => i.tags))).sort(),
    [all],
  );
  const clientOf = (id?: string) => (clients.data ?? []).find((c) => c.id === id);

  const filtered = all.filter((i) => {
    if (client === "personal" ? i.clientId : client !== "all" && i.clientId !== client) return false;
    if (tag !== "all" && !i.tags.includes(tag)) return false;
    const needle = q.trim().toLowerCase();
    if (needle && !`${i.title} ${i.transcript}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  async function remove(id: string) {
    await deleteIdea(id);
    await qc.invalidateQueries({ queryKey: ["ideas"] });
    toast.success("Idea deleted.");
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-title text-3xl font-semibold tracking-tight">Ideas</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Say it before it&apos;s gone — record, upload a voice memo, or type the thought.
        </p>
      </header>

      <QuickCapture />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SectionTitle>Captured</SectionTitle>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ideas"
              aria-label="Search ideas"
              data-search-input
              className="min-h-[38px] rounded-lg border border-hairline bg-card px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
            />
            <select
              value={client}
              onChange={(e) => setClient(e.target.value)}
              aria-label="Filter by client"
              className="min-h-[38px] rounded-lg border border-hairline bg-card px-2.5 text-xs"
            >
              <option value="all">All clients</option>
              <option value="personal">Personal</option>
              {(clients.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              aria-label="Filter by tag"
              className="min-h-[38px] rounded-lg border border-hairline bg-card px-2.5 text-xs"
            >
              <option value="all">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {ideas.isError ? (
          <ErrorState onRetry={() => void ideas.refetch()} />
        ) : ideas.isLoading ? (
          <ListSkeleton rows={3} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={all.length === 0 ? "No ideas yet — say the first one out loud" : "Nothing matches those filters"}
            body={
              all.length === 0
                ? "Tap the mic above, or upload a voice memo from your phone."
                : "Try a different client, tag or search."
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filtered.map((i) => {
              const c = clientOf(i.clientId);
              return (
                <li
                  key={i.id}
                  className="group flex flex-col rounded-xl border border-hairline bg-card p-4 transition-shadow hover:shadow-soft"
                >
                  <div className="flex items-start gap-2">
                    <Link
                      to="/ideas/$ideaId"
                      params={{ ideaId: i.id }}
                      className="text-title min-w-0 flex-1 text-[17px] font-medium leading-snug hover:text-ember"
                    >
                      {i.title}
                    </Link>
                    <button
                      onClick={() => void remove(i.id)}
                      aria-label={`Delete idea ${i.title}`}
                      className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {i.transcript}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {c ? (
                      <ClientChip name={c.name} color={c.tagColor} />
                    ) : (
                      <span className="rounded-full border border-hairline px-2 py-0.5">Personal</span>
                    )}
                    {i.tags.map((t) => (
                      <span key={t} className="rounded-md border border-hairline bg-surface px-1.5 py-0.5">
                        {t}
                      </span>
                    ))}
                    <span className="ml-auto capitalize" title={fullDate(i.createdAtISO)}>
                      {i.source} · {relativeDate(i.createdAtISO)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listClients, listIdeas } from "@/lib/api";
import { EmptyState, ErrorState, ListSkeleton, SectionTitle } from "@/components/lumen/primitives";
import { IdeasGrid } from "@/components/lumen/IdeasGrid";
import { QuickCapture } from "@/components/lumen/QuickCapture";
import { useAccess } from "@/lib/access-store";

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
  const ideas = useQuery({ queryKey: ["ideas"], queryFn: listIdeas });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [q, setQ] = useState("");
  const [client, setClient] = useState("all");
  const [tag, setTag] = useState("all");

  const { canSeeClient, isOwner } = useAccess();
  const all = (ideas.data ?? []).filter((i) =>
    i.clientId ? canSeeClient(i.clientId) : isOwner,
  );
  const allTags = useMemo(
    () => Array.from(new Set(all.flatMap((i) => i.tags))).sort(),
    [all],
  );

  const filtered = all.filter((i) => {
    if (client === "personal" ? i.clientId : client !== "all" && i.clientId !== client) return false;
    if (tag !== "all" && !i.tags.includes(tag)) return false;
    const needle = q.trim().toLowerCase();
    if (needle && !`${i.title} ${i.transcript}`.toLowerCase().includes(needle)) return false;
    return true;
  });

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
          <IdeasGrid ideas={filtered} clients={clients.data ?? []} />
        )}
      </section>
    </div>
  );
}

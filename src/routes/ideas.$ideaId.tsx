import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteIdea, getIdea, listClients, updateIdea } from "@/lib/api";
import { clock, fullDate, relativeDate } from "@/lib/format";
import { ErrorState, ListSkeleton } from "@/components/lumen/primitives";
import { IdeaSuggestion } from "@/components/lumen/IdeaSuggestion";
import { ClientSelect } from "@/components/lumen/ClientSelect";
import { createClient } from "@/lib/api";

export const Route = createFileRoute("/ideas/$ideaId")({
  head: () => ({
    meta: [
      { title: "Idea — Lumen" },
      { name: "description", content: "A captured studio thought: transcript, tags and client." },
      { property: "og:title", content: "Idea — Lumen" },
      { property: "og:description", content: "A captured studio thought with transcript and tags." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IdeaDetail,
});

function IdeaDetail() {
  const { ideaId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const idea = useQuery({ queryKey: ["idea", ideaId], queryFn: () => getIdea(ideaId) });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [clientId, setClientId] = useState("");
  const [newClient, setNewClient] = useState<{ name: string; note?: string } | undefined>(undefined);

  useEffect(() => {
    if (idea.data) {
      setTags(idea.data.tags);
      setClientId(idea.data.clientId ?? "");
    }
  }, [idea.data]);

  async function persist(patch: { tags?: string[]; clientId?: string | undefined }) {
    await updateIdea(ideaId, patch);
    await qc.invalidateQueries({ queryKey: ["ideas"] });
    await qc.invalidateQueries({ queryKey: ["idea", ideaId] });
  }

  if (idea.isError) return <ErrorState onRetry={() => void idea.refetch()} />;
  if (idea.isLoading) return <ListSkeleton rows={3} />;
  if (!idea.data)
    return (
      <div className="rounded-xl border border-hairline bg-card p-8 text-center">
        <p className="text-title text-lg">That idea isn&apos;t here anymore</p>
        <Link to="/ideas" className="mt-3 inline-block text-sm text-ember">
          Back to Ideas
        </Link>
      </div>
    );

  const i = idea.data;

  return (
    <div className="space-y-6">
      <Link
        to="/ideas"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-ember"
      >
        <ArrowLeft className="size-3.5" /> All ideas
      </Link>

      <header className="space-y-2">
        <h1 className="text-title text-3xl font-semibold tracking-tight">{i.title}</h1>
        <p className="text-xs capitalize text-muted-foreground" title={fullDate(i.createdAtISO)}>
          {i.source}
          {i.durationSeconds ? ` · ${clock(i.durationSeconds)}` : ""} · {relativeDate(i.createdAtISO)}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            void navigator.clipboard.writeText(`${i.title}\n\n${i.transcript}`);
            toast.success("Copied.");
          }}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-hairline bg-card px-3 text-sm transition-colors hover:border-ember/40 hover:text-ember"
        >
          <Copy className="size-4" /> Copy text
        </button>
        <button
          onClick={async () => {
            await deleteIdea(i.id);
            await qc.invalidateQueries({ queryKey: ["ideas"] });
            toast.success("Idea deleted.");
            void navigate({ to: "/ideas" });
          }}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-hairline bg-card px-3 text-sm text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 className="size-4" /> Delete
        </button>
      </div>

      <IdeaSuggestion idea={i} />

      <article className="rounded-xl border border-hairline bg-card p-5 text-[15px] leading-relaxed">
        {i.transcript}
      </article>

      <section className="space-y-3 rounded-xl border border-hairline bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => {
                const next = tags.filter((x) => x !== t);
                setTags(next);
                void persist({ tags: next });
              }}
              aria-label={`Remove tag ${t}`}
              className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2 py-1 text-[11px] text-muted-foreground hover:text-ember"
            >
              {t} <X className="size-3" />
            </button>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const t = tagInput.trim().toLowerCase();
              if (!t || tags.includes(t)) return setTagInput("");
              const next = [...tags, t];
              setTags(next);
              setTagInput("");
              void persist({ tags: next });
            }}
            placeholder="Add a tag"
            aria-label="Add a tag"
            className="min-h-[38px] w-32 rounded-lg border border-hairline bg-surface px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
          />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ClientSelect
              value={clientId}
              newClient={newClient}
              onChange={async (choice) => {
                setNewClient(choice.newClient);
                if (choice.newClient) return;
                setClientId(choice.clientId ?? "");
                await persist({ clientId: choice.clientId });
              }}
            />
            {newClient?.name.trim() ? (
              <button
                onClick={async () => {
                  const created = await createClient(newClient);
                  setNewClient(undefined);
                  setClientId(created.id);
                  await persist({ clientId: created.id });
                  await qc.invalidateQueries({ queryKey: ["clients"] });
                  toast.success(`${created.name} added — idea filed there.`);
                }}
                className="min-h-[38px] rounded-lg border border-hairline bg-surface px-2.5 text-xs transition-colors hover:border-ember/40 hover:text-ember"
              >
                Create &amp; attach
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

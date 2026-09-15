import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ExternalLink, Plus, Trash2 } from "lucide-react";
import {
  createSocialDraft,
  deleteSocialDraft,
  listClients,
  listSocialDrafts,
  updateSocialDraft,
} from "@/lib/api";
import { EmptyState, ErrorState, ListSkeleton, SectionTitle } from "@/components/lumen/primitives";
import { cn } from "@/lib/utils";
import type { SocialDraftStatus } from "@/lib/types";

// Where the approved drafts actually get scheduled and published.
const POSTIZ_URL = "https://social.joshandmary.us";

const STATUS_FILTERS: { key: SocialDraftStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "approved", label: "Approved" },
  { key: "scheduled", label: "Scheduled" },
];

const statusStyle: Record<SocialDraftStatus, string> = {
  draft: "border-hairline text-muted-foreground",
  approved: "border-ember/40 text-ember",
  scheduled: "border-hairline bg-ember-soft text-foreground",
  published: "border-hairline text-muted-foreground",
};

export const Route = createFileRoute("/social")({
  head: () => ({
    meta: [
      { title: "Social — Lumen" },
      {
        name: "description",
        content: "Draft posts from your clients and ideas, then schedule them in Postiz.",
      },
      { property: "og:title", content: "Social — Lumen" },
      {
        property: "og:description",
        content: "Post drafts that start from real client work.",
      },
    ],
  }),
  component: SocialPage,
});

function SocialPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SocialDraftStatus | "all">("all");
  const [clientFilter, setClientFilter] = useState("");
  const [body, setBody] = useState("");
  const [draftClient, setDraftClient] = useState("");

  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const drafts = useQuery({
    queryKey: ["socialDrafts", status, clientFilter],
    queryFn: () =>
      listSocialDrafts({
        ...(status === "all" ? {} : { status }),
        ...(clientFilter ? { clientId: clientFilter } : {}),
      }),
  });

  const create = useMutation({
    mutationFn: () =>
      createSocialDraft({ body: body.trim(), ...(draftClient ? { clientId: draftClient } : {}) }),
    onSuccess: () => {
      setBody("");
      void qc.invalidateQueries({ queryKey: ["socialDrafts"] });
    },
  });

  const setDraftStatus = useMutation({
    mutationFn: (v: { id: string; status: SocialDraftStatus }) =>
      updateSocialDraft(v.id, { status: v.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["socialDrafts"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSocialDraft(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["socialDrafts"] }),
  });

  const clientName = (id?: string) => (clients.data ?? []).find((c) => c.id === id)?.name;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title text-3xl font-semibold tracking-tight">Social</h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Draft posts here — they start from your own clients and ideas. Scheduling and
            publishing happen in Postiz.
          </p>
        </div>
        <a
          href={POSTIZ_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-sm transition-colors hover:bg-accent"
        >
          Open Postiz
          <ExternalLink className="size-3.5 opacity-60" />
        </a>
      </header>

      <section className="rounded-xl border border-hairline bg-card p-4">
        <SectionTitle>New draft</SectionTitle>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="A line about the work, the client, the moment…"
          rows={4}
          className="mt-3 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={draftClient}
            onChange={(e) => setDraftClient(e.target.value)}
            className="h-9 rounded-lg border border-hairline bg-card px-2.5 text-sm"
          >
            <option value="">No client</option>
            {(clients.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => create.mutate()}
            disabled={!body.trim() || create.isPending}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-ember px-4 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity disabled:opacity-50"
          >
            <Plus className="size-4" />
            Save draft
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={cn(
              "rounded-full border border-hairline px-2.5 py-1 text-[11px] transition-colors",
              status === f.key ? "bg-ember text-[oklch(0.99_0.005_85)]" : "hover:bg-accent",
            )}
          >
            {f.label}
          </button>
        ))}
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="ml-auto h-9 rounded-lg border border-hairline bg-card px-2.5 text-sm"
        >
          <option value="">All clients</option>
          {(clients.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {drafts.isLoading ? (
        <ListSkeleton rows={3} />
      ) : drafts.isError ? (
        <ErrorState onRetry={() => void drafts.refetch()} />
      ) : (drafts.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Plus className="size-5" />}
          title="No drafts yet"
          body="Start one above — a rough line is enough. You'll add photos and schedule it in Postiz."
        />
      ) : (
        <ul className="space-y-3">
          {(drafts.data ?? []).map((d) => (
            <li key={d.id} className="rounded-xl border border-hairline bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize",
                    statusStyle[d.status],
                  )}
                >
                  {d.status}
                </span>
                {d.clientId ? (
                  <span className="rounded-md border border-hairline bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">
                    {clientName(d.clientId) ?? "Client"}
                  </span>
                ) : null}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {d.createdAtISO ? new Date(d.createdAtISO).toLocaleDateString() : ""}
                </span>
              </div>
              <p className="mt-2.5 whitespace-pre-wrap text-sm">{d.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {d.status === "draft" ? (
                  <button
                    onClick={() => setDraftStatus.mutate({ id: d.id, status: "approved" })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs transition-colors hover:bg-accent"
                  >
                    <Check className="size-3.5" />
                    Approve
                  </button>
                ) : null}
                <button
                  onClick={() => remove.mutate(d.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

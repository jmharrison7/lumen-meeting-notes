import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Camera, Check, ExternalLink, Plus, RefreshCw, Sparkles, Trash2, Upload } from "lucide-react";
import {
  analyzeSocialMedia,
  createSocialDraft,
  deleteSocialDraft,
  deleteSocialMedia,
  generateSocialDrafts,
  listClients,
  listSocialDrafts,
  listSocialMedia,
  listSocialSources,
  refreshSocialSource,
  socialMediaUrl,
  updateSocialDraft,
  updateSocialMedia,
  uploadSocialMedia,
} from "@/lib/api";
import { EmptyState, ErrorState, ListSkeleton, SectionTitle } from "@/components/lumen/primitives";
import { cn } from "@/lib/utils";
import type { SocialDraftStatus } from "@/lib/types";

// Where approved drafts get scheduled and published.
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

const pill = (on: boolean) =>
  cn(
    "rounded-full border border-hairline px-2.5 py-1 text-[11px] transition-colors",
    on ? "bg-ember text-[oklch(0.99_0.005_85)]" : "hover:bg-accent",
  );

const selectCls = "h-9 rounded-lg border border-hairline bg-card px-2.5 text-sm";

export const Route = createFileRoute("/social")({
  head: () => ({
    meta: [
      { title: "Social — Lumen" },
      {
        name: "description",
        content: "Draft posts from your clients, ideas and photos, then schedule them in Postiz.",
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
  const [tab, setTab] = useState<"drafts" | "photos">("drafts");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title text-3xl font-semibold tracking-tight">Social</h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Drafts start from your own clients, notes and photos. Scheduling and publishing
            happen in Postiz.
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

      <div className="flex gap-2">
        <button onClick={() => setTab("drafts")} className={pill(tab === "drafts")}>
          Drafts
        </button>
        <button onClick={() => setTab("photos")} className={pill(tab === "photos")}>
          Photos
        </button>
      </div>

      {tab === "drafts" ? <DraftsTab /> : <PhotosTab />}
    </div>
  );
}

function SourceBar() {
  const qc = useQueryClient();
  const sources = useQuery({ queryKey: ["socialSources"], queryFn: listSocialSources });
  const refresh = useMutation({
    mutationFn: () => refreshSocialSource(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["socialSources"] }),
  });
  const site = (sources.data ?? [])[0];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-hairline px-3 py-2 text-[11px] text-muted-foreground">
      <span>
        Website copy:{" "}
        {site ? (
          <>
            <span className="font-medium text-foreground">{site.chars.toLocaleString()} chars</span> from{" "}
            {site.url.replace(/^https?:\/\//, "")}
          </>
        ) : (
          "not pulled yet"
        )}
      </span>
      <button
        onClick={() => refresh.mutate()}
        disabled={refresh.isPending}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2 py-1 transition-colors hover:bg-accent disabled:opacity-50"
      >
        <RefreshCw className={cn("size-3", refresh.isPending && "animate-spin")} />
        {refresh.isPending ? "Pulling…" : site ? "Refresh" : "Pull website copy"}
      </button>
    </div>
  );
}

function DraftsTab() {
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
  const media = useQuery({ queryKey: ["socialMedia", "all"], queryFn: () => listSocialMedia() });

  const create = useMutation({
    mutationFn: () =>
      createSocialDraft({ body: body.trim(), ...(draftClient ? { clientId: draftClient } : {}) }),
    onSuccess: () => {
      setBody("");
      void qc.invalidateQueries({ queryKey: ["socialDrafts"] });
    },
  });

  const generate = useMutation({
    mutationFn: () => generateSocialDrafts(3),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["socialDrafts"] }),
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
  const photosFor = (draftId: string) => (media.data ?? []).filter((m) => m.draftId === draftId);

  return (
    <div className="space-y-5">
      <SourceBar />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-ember px-4 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity disabled:opacity-50"
        >
          <Sparkles className={cn("size-4", generate.isPending && "animate-pulse")} />
          {generate.isPending ? "Writing drafts…" : "Generate drafts"}
        </button>
        <span className="text-[11px] text-muted-foreground">
          {generate.isPending
            ? "Reading your clients, notes and website…"
            : "Uses your clients, recent notes and website copy. Nothing is published."}
        </span>
      </div>

      {generate.isError ? (
        <p className="text-[11px] text-muted-foreground">
          Generation failed — the local model returned nothing usable. Try again.
        </p>
      ) : null}

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
          <select value={draftClient} onChange={(e) => setDraftClient(e.target.value)} className={selectCls}>
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
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-hairline px-4 text-sm transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Plus className="size-4" />
            Save draft
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button key={f.key} onClick={() => setStatus(f.key)} className={pill(status === f.key)}>
            {f.label}
          </button>
        ))}
        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={cn(selectCls, "ml-auto")}>
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
          body="Generate a few, or write one above. Add photos from the Photos tab."
        />
      ) : (
        <ul className="space-y-3">
          {(drafts.data ?? []).map((d) => {
            const shots = photosFor(d.id);
            return (
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
                  {d.source === "generated" ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">
                      <Sparkles className="size-3" /> generated
                    </span>
                  ) : null}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {d.createdAtISO ? new Date(d.createdAtISO).toLocaleDateString() : ""}
                  </span>
                </div>
                <p className="mt-2.5 whitespace-pre-wrap text-sm">{d.body}</p>
                {shots.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {shots.map((m) => (
                      <img
                        key={m.id}
                        src={socialMediaUrl(m.id)}
                        alt={m.caption || m.name}
                        className="size-16 rounded-lg border border-hairline object-cover"
                      />
                    ))}
                  </div>
                ) : null}
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
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PhotosTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadClient, setUploadClient] = useState("");
  const [busy, setBusy] = useState(false);

  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const media = useQuery({ queryKey: ["socialMedia", "all"], queryFn: () => listSocialMedia() });
  const drafts = useQuery({ queryKey: ["socialDrafts", "all", ""], queryFn: () => listSocialDrafts() });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["socialMedia"] });
  };

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        await uploadSocialMedia(f, uploadClient || undefined);
      }
      invalidate();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const attach = useMutation({
    mutationFn: (v: { id: string; draftId: string }) =>
      updateSocialMedia(v.id, { draftId: v.draftId }),
    onSuccess: invalidate,
  });
  const reanalyze = useMutation({
    mutationFn: (id: string) => analyzeSocialMedia(id),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteSocialMedia(id),
    onSuccess: invalidate,
  });

  const clientName = (id?: string) => (clients.data ?? []).find((c) => c.id === id)?.name;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-dashed border-hairline p-4">
        <SectionTitle>Drop photos</SectionTitle>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Dump project photos here — they get catalogued automatically and can be attached to a
          draft.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={uploadClient} onChange={(e) => setUploadClient(e.target.value)} className={selectCls}>
            <option value="">No client</option>
            {(clients.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => void onFiles(e.target.files)}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-hairline bg-surface px-4 text-sm transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Upload className="size-4" />
            {busy ? "Uploading…" : "Choose photos"}
          </button>
        </div>
      </section>

      {media.isLoading ? (
        <ListSkeleton rows={2} />
      ) : media.isError ? (
        <ErrorState onRetry={() => void media.refetch()} />
      ) : (media.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Camera className="size-5" />}
          title="No photos yet"
          body="Add a few from a recent project — they'll be catalogued and ready to attach to a draft."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(media.data ?? []).map((m) => (
            <li key={m.id} className="overflow-hidden rounded-xl border border-hairline bg-card">
              <img
                src={socialMediaUrl(m.id)}
                alt={m.caption || m.name}
                className="h-36 w-full object-cover"
                loading="lazy"
              />
              <div className="space-y-2 p-3">
                <p className="line-clamp-2 text-[12px]">
                  {m.caption || <span className="text-muted-foreground">Not catalogued yet…</span>}
                </p>
                {m.tags.length ? (
                  <div className="flex flex-wrap gap-1">
                    {m.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-hairline bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
                {m.clientId && clientName(m.clientId) ? (
                  <p className="text-[10px] text-muted-foreground">{clientName(m.clientId)}</p>
                ) : null}
                <select
                  value={m.draftId ?? ""}
                  onChange={(e) => {
                    if (e.target.value) attach.mutate({ id: m.id, draftId: e.target.value });
                  }}
                  className="h-8 w-full rounded-lg border border-hairline bg-card px-2 text-[11px]"
                >
                  <option value="">Attach to draft…</option>
                  {(drafts.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.body.slice(0, 34)}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => reanalyze.mutate(m.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-[10px] transition-colors hover:bg-accent"
                  >
                    <RefreshCw className="size-3" /> Re-read
                  </button>
                  <button
                    onClick={() => remove.mutate(m.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent"
                  >
                    <Trash2 className="size-3" /> Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Camera, Check, Clock, Copy, ExternalLink, Link2, Mic, Plus, RefreshCw, Repeat, Send, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  analyzeSocialMedia,
  approveDraftsBulk,
  createHashtagSet,
  createSocialDraft,
  createSocialSlot,
  deleteHashtagSet,
  deleteSocialDraft,
  deleteSocialMedia,
  deleteSocialSlot,
  generateSocialDrafts,
  getPostizStatus,
  listClients,
  listHashtagSets,
  listSocialDrafts,
  listSocialMedia,
  listSocialSlots,
  listSocialSources,
  makeDraftVariant,
  queueSocialDraft,
  recycleDraft,
  refreshSocialSource,
  sendDraftToPostiz,
  setDraftEvergreen,
  shareSocialDraft,
  socialMediaUrl,
  suggestSocialMedia,
  transcribeAudio,
  updateSocialDraft,
  updateSocialMedia,
  uploadSocialMedia,
} from "@/lib/api";
import { EmptyState, ErrorState, ListSkeleton, SectionTitle } from "@/components/lumen/primitives";
import { cn } from "@/lib/utils";
import type { HashtagSet, SocialDraft, SocialDraftStatus, SocialSlot } from "@/lib/types";

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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Is Postiz reachable, and what can it post to? Until the API key is on the NAS this
 * states plainly what is missing rather than failing on every action.
 */
function PostizBar() {
  const status = useQuery({ queryKey: ["postiz"], queryFn: getPostizStatus });
  const s = status.data;
  if (!s) return null;
  if (!s.configured) {
    return (
      <div className="rounded-xl border border-dashed border-hairline bg-surface p-4 text-sm">
        <p className="font-medium">Postiz is not connected yet</p>
        <p className="mt-1 text-muted-foreground">
          Drafts are saved here either way. To let Lumen schedule them, add <code>POSTIZ_URL</code> and{" "}
          <code>POSTIZ_API_KEY</code> to the NAS <code>.env</code> and restart <code>lumen-api</code>.
        </p>
      </div>
    );
  }
  if (!s.reachable) {
    return (
      <div className="rounded-xl border border-dashed border-hairline bg-surface p-4 text-sm">
        <p className="font-medium">Postiz is configured but not answering</p>
        <p className="mt-1 text-muted-foreground">
          {s.error || "Check the API key, and that Postiz is running."}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4 text-sm">
      <p className="font-medium">
        Postiz connected · {s.channels.length} channel{s.channels.length === 1 ? "" : "s"}
      </p>
      <p className="mt-1 text-muted-foreground">
        {s.channels.length
          ? s.channels.map((c) => c.provider || c.name).join(" · ")
          : "No channels connected yet — connect Instagram inside Postiz."}
      </p>
    </div>
  );
}

/** The weekly rhythm. Queueing fills the next free slot, so no post needs a date picked. */
function RhythmPanel() {
  const qc = useQueryClient();
  const slots = useQuery({ queryKey: ["socialSlots"], queryFn: listSocialSlots });
  const [day, setDay] = useState(2);
  const [time, setTime] = useState("09:00");
  const add = useMutation({
    mutationFn: () => createSocialSlot({ dayOfWeek: day, time }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["socialSlots"] });
      toast.success("Slot added.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not add that slot."),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteSocialSlot(id),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["socialSlots"] }),
  });
  const list = slots.data ?? [];
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Posting rhythm</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Set the slots you want filled each week. Then <span className="font-medium text-foreground">Queue</span>{" "}
        drops a post into the next free one — no date picking.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          className="h-9 rounded-lg border border-hairline bg-card px-2.5 text-sm"
        >
          {DAY_LABELS.map((l, i) => (
            <option key={l} value={i}>
              {l}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="h-9 rounded-lg border border-hairline bg-surface px-2.5 text-sm"
        />
        <button
          onClick={() => add.mutate()}
          disabled={add.isPending}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-hairline px-3 text-sm transition-colors hover:bg-accent disabled:opacity-60"
        >
          <Plus className="size-3.5" /> Add slot
        </button>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {list.map((s: SocialSlot) => (
          <li key={s.id} className="inline-flex items-center gap-2 rounded-lg border border-hairline px-2.5 py-1 text-[12px]">
            <Clock className="size-3 opacity-60" />
            {DAY_LABELS[s.dayOfWeek] || "?"} {s.time}
            <button onClick={() => del.mutate(s.id)} aria-label="Remove slot" className="text-muted-foreground hover:text-foreground">
              <Trash2 className="size-3" />
            </button>
          </li>
        ))}
        {!list.length ? <li className="text-[12px] text-muted-foreground">No slots yet.</li> : null}
      </ul>
    </div>
  );
}

/** Saved hashtag sets — retyping the same tags on every post is wasted time. */
function HashtagPanel() {
  const qc = useQueryClient();
  const sets = useQuery({ queryKey: ["hashtagSets"], queryFn: listHashtagSets });
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const add = useMutation({
    mutationFn: () => createHashtagSet({ setName: name, tags }),
    onSuccess: async () => {
      setName("");
      setTags("");
      await qc.invalidateQueries({ queryKey: ["hashtagSets"] });
      toast.success("Set saved.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save that set."),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteHashtagSet(id),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["hashtagSets"] }),
  });
  const list = sets.data ?? [];
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Hashtag sets</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Weddings)"
          className="h-9 rounded-lg border border-hairline bg-surface px-2.5 text-sm"
        />
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="#seattlewedding #pnwbride"
          className="h-9 min-w-[14rem] flex-1 rounded-lg border border-hairline bg-surface px-2.5 text-sm"
        />
        <button
          onClick={() => add.mutate()}
          disabled={add.isPending || !name.trim() || !tags.trim()}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-hairline px-3 text-sm transition-colors hover:bg-accent disabled:opacity-60"
        >
          <Plus className="size-3.5" /> Save set
        </button>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {list.map((h: HashtagSet) => (
          <li key={h.id} className="inline-flex items-center gap-2 rounded-lg border border-hairline px-2.5 py-1 text-[12px]">
            <span className="font-medium">{h.setName}</span>
            <span className="max-w-[16rem] truncate text-muted-foreground">{h.tags}</span>
            <button
              onClick={() => void navigator.clipboard.writeText(h.tags).then(() => toast.success("Copied."))}
              aria-label={`Copy ${h.setName}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <Copy className="size-3" />
            </button>
            <button onClick={() => del.mutate(h.id)} aria-label={`Delete ${h.setName}`} className="text-muted-foreground hover:text-foreground">
              <Trash2 className="size-3" />
            </button>
          </li>
        ))}
        {!list.length ? <li className="text-[12px] text-muted-foreground">No sets yet.</li> : null}
      </ul>
    </div>
  );
}

/**
 * Everything that hands a draft onward: into Postiz, into the weekly queue, to the client
 * for approval, or back around again as evergreen. Self-contained so the draft list only
 * has to render one element.
 */
function DraftPostizActions({ d }: { d: SocialDraft }) {
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["socialDrafts"] });
    await qc.invalidateQueries({ queryKey: ["postiz"] });
  };
  const send = useMutation({
    mutationFn: () => sendDraftToPostiz(d.id, { mode: "schedule" }),
    onSuccess: async () => {
      await refresh();
      toast.success("Sent to Postiz.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't send it."),
  });
  const queue = useMutation({
    mutationFn: () => queueSocialDraft(d.id),
    onSuccess: async (r: { queued: string; postiz: boolean; note?: string }) => {
      await refresh();
      toast.success(`Queued for ${new Date(r.queued).toLocaleString()}`, { description: r.postiz ? undefined : r.note });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't queue it."),
  });
  const share = useMutation({
    mutationFn: () => shareSocialDraft(d.id),
    onSuccess: async (r: { url: string }) => {
      await refresh();
      try {
        await navigator.clipboard.writeText(r.url);
        toast.success("Approval link copied — send it to the client.");
      } catch {
        toast.success(r.url);
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't make a link."),
  });
  const evergreen = useMutation({
    mutationFn: () => setDraftEvergreen(d.id, !d.evergreen, d.recycleDays || 30),
    onSuccess: async () => {
      await refresh();
      toast.success(d.evergreen ? "Evergreen off." : "Marked evergreen — re-queue it whenever you like.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't change that."),
  });
  const recycle = useMutation({
    mutationFn: () => recycleDraft(d.id),
    onSuccess: async () => {
      await refresh();
      toast.success("Copied back into the queue as a fresh draft.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't recycle it."),
  });
  const variant = useMutation({
    mutationFn: (platform: string) => makeDraftVariant(d.id, platform),
    onSuccess: async () => {
      await refresh();
      toast.success("Cloned for the other platform.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't clone it."),
  });
  const btn =
    "inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-60";
  const other = String(d.platform).toLowerCase() === "instagram" ? "linkedin" : "instagram";
  return (
    <>
      <button onClick={() => send.mutate()} disabled={send.isPending} className={btn} title="Create this post in Postiz">
        <Send className="size-3.5" /> Send to Postiz
      </button>
      <button onClick={() => queue.mutate()} disabled={queue.isPending} className={btn} title="Take the next free slot in your rhythm">
        <Clock className="size-3.5" /> Queue
      </button>
      <button onClick={() => share.mutate()} disabled={share.isPending} className={btn} title="Public link the client can approve">
        <Link2 className="size-3.5" /> {d.hasApprovalLink ? "Copy link" : "Ask client"}
      </button>
      <button onClick={() => variant.mutate(other)} disabled={variant.isPending} className={btn} title={`Clone this text for ${other}`}>
        <Copy className="size-3.5" /> Clone {other === "linkedin" ? "LinkedIn" : "Instagram"}
      </button>
      <button
        onClick={() => evergreen.mutate()}
        disabled={evergreen.isPending}
        className={cn(btn, d.evergreen && "border-ember/40 text-ember")}
        title="Reuse this post later"
      >
        <Repeat className="size-3.5" /> {d.evergreen ? "Evergreen" : "Make evergreen"}
      </button>
      {d.evergreen ? (
        <button onClick={() => recycle.mutate()} disabled={recycle.isPending} className={btn} title="Copy it back into the queue">
          <RefreshCw className="size-3.5" /> Re-queue
        </button>
      ) : null}
      {d.postizState ? (
        <span className="inline-flex items-center rounded-full border border-hairline px-2 py-0.5 text-[11px] text-muted-foreground">
          Postiz: {d.postizState}
        </span>
      ) : null}
      {d.approvalState ? (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
            d.approvalState === "approved" ? "border-ember/40 text-ember" : "border-hairline text-muted-foreground",
          )}
        >
          client: {d.approvalState}
        </span>
      ) : null}
    </>
  );
}

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

      <SocialSettings />

      {tab === "drafts" ? <DraftsTab /> : <PhotosTab />}
    </div>
  );
}

/** Wrapper so the connected-state bar and the rhythm/hashtag panels sit together. */
function SocialSettings() {
  return (
    <div className="space-y-3">
      <PostizBar />
      <div className="grid gap-3 md:grid-cols-2">
        <RhythmPanel />
        <HashtagPanel />
      </div>
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
  // Mary explains her work out loud far more easily than she types it: record, transcribe, and
  // the transcript becomes the draft - and raw material for generation.
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recChunks = useRef<Blob[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);

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

  const draftIdList = (drafts.data ?? []).map((d) => d.id);
  const suggestions = useQuery({
    queryKey: ["socialSuggestions", draftIdList.join(",")],
    queryFn: () => suggestSocialMedia(draftIdList, 6),
    enabled: draftIdList.length > 0,
  });

  const attachPhoto = useMutation({
    mutationFn: (v: { id: string; draftId: string }) => updateSocialMedia(v.id, { draftId: v.draftId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["socialMedia"] });
      void qc.invalidateQueries({ queryKey: ["socialSuggestions"] });
    },
  });
  const detachPhoto = useMutation({
    mutationFn: (id: string) => updateSocialMedia(id, { draftId: "" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["socialMedia"] });
      void qc.invalidateQueries({ queryKey: ["socialSuggestions"] });
    },
  });

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

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recChunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) recChunks.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recChunks.current, { type: rec.mimeType || "audio/webm" });
        setTranscribing(true);
        try {
          const out = await transcribeAudio(blob, []);
          const text = (out.transcript || "").trim();
          if (text) {
            await createSocialDraft({
              body: text,
              source: "voice",
              ...(draftClient ? { clientId: draftClient } : {}),
            });
            void qc.invalidateQueries({ queryKey: ["socialDrafts"] });
          }
        } catch {
          // transcription failed - nothing saved; the mic is already released
        } finally {
          setTranscribing(false);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      // microphone refused
    }
  }

  function stopRecording() {
    recRef.current?.stop();
    setRecording(false);
  }

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
        <p className="mt-1.5 text-sm text-muted-foreground">
          Talk it through instead of typing — record your explanation of the project and we'll
          transcribe it into a draft, then write posts from it.
        </p>
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
            onClick={recording ? stopRecording : () => void startRecording()}
            disabled={transcribing}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-4 text-sm transition-colors disabled:opacity-50",
              recording ? "border-ember bg-ember-soft text-foreground" : "border-hairline hover:bg-accent",
            )}
          >
            <Mic className="size-4" />
            {recording ? "Stop" : transcribing ? "Transcribing…" : "Record"}
          </button>
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
            const cand = (suggestions.data?.[d.id] ?? []).filter((m) => !m.draftId);
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
                {shots.length || cand.length ? (
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Photos for this post
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {shots.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => detachPhoto.mutate(m.id)}
                          title="Remove from this post"
                          className="overflow-hidden rounded-lg border-2 border-ember"
                        >
                          <img src={socialMediaUrl(m.id)} alt={m.caption || m.name} className="size-16 object-cover" />
                        </button>
                      ))}
                      {cand.slice(0, 5).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => attachPhoto.mutate({ id: m.id, draftId: d.id })}
                          title={m.why && m.why.length ? m.why.join(", ") : "Use on this post"}
                          className="overflow-hidden rounded-lg border border-hairline opacity-75 transition-opacity hover:opacity-100"
                        >
                          <img src={socialMediaUrl(m.id)} alt={m.caption || m.name} className="size-16 object-cover" />
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {cand.length ? "Tap a photo to use it on this post." : "No other photos match this post yet."}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    No photos yet — add some in the Photos tab and they'll be matched to posts here.
                  </p>
                )}
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
                  <DraftPostizActions d={d} />
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

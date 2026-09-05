import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileDown,
  Mail,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { deleteNotes, getNote, listClients, updateActionItem } from "@/lib/api";
import {
  ClientChip,
  DueBadge,
  ErrorState,
  PlatformBadge,
  PriorityDot,
  SectionTitle,
} from "@/components/lumen/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  download,
  formatDuration,
  formatTime,
  fullDate,
  noteToMarkdown,
  relativeDate,
} from "@/lib/format";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import type { ActionItem } from "@/lib/types";
import { FollowUpDialog } from "@/components/lumen/FollowUpDialog";

export const Route = createFileRoute("/notes/$noteId")({
  head: () => ({
    meta: [
      { title: "Meeting note — Lumen" },
      {
        name: "description",
        content:
          "A structured write-up: summary, decisions, action items, open questions, and the full transcript.",
      },
      { property: "og:title", content: "Meeting note — Lumen" },
      {
        property: "og:description",
        content: "Summary, decisions, action items, open questions, and the full transcript.",
      },
    ],
  }),
  component: NoteDetail,
});

function NoteDetail() {
  const { noteId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { applyItem, patchItem, reviewed, setReviewed, hideNotes } = useUi();
  const [showTranscript, setShowTranscript] = useState(false);
  const [editing, setEditing] = useState(false);
  const [mdOpen, setMdOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  const note = useQuery({ queryKey: ["note", noteId], queryFn: () => getNote(noteId) });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });

  if (note.isError) return <ErrorState onRetry={() => void note.refetch()} />;

  if (note.isLoading)
    return (
      <div className="space-y-6">
        <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    );

  const n = note.data;
  if (!n)
    return (
      <div className="rounded-xl border border-hairline bg-card px-6 py-14 text-center">
        <p className="text-title text-xl">This note isn't here</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          It may have been deleted. Your other notes are safe.
        </p>
        <Link
          to="/notes"
          className="mt-5 inline-block rounded-lg border border-border px-3.5 py-2 text-sm hover:bg-accent"
        >
          Back to all notes
        </Link>
      </div>
    );

  const client = clients.data?.find((c) => c.id === n.clientId);
  const isReviewed = reviewed[n.id] ?? n.reviewed;
  const items = n.actionItems.map(applyItem);

  async function toggleItem(item: ActionItem) {
    patchItem(item.id, { done: !item.done });
    await updateActionItem(item.id, { done: !item.done });
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  async function remove() {
    hideNotes([noteId]);
    await deleteNotes([noteId]);
    await qc.invalidateQueries({ queryKey: ["notes"] });
    toast.success("Note deleted");
    void navigate({ to: "/notes" });
  }

  const md = noteToMarkdown(n, client?.name ?? "Client");

  return (
    <article className="animate-[rise_200ms_ease-out] space-y-10 pb-16 md:pb-0">
      <Link
        to="/notes"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-ember"
      >
        <ArrowLeft className="size-3.5" /> All notes
      </Link>

      <header className="space-y-4">
        <h1 className="text-title text-3xl font-semibold leading-tight tracking-tight md:text-[40px]">
          {n.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {client ? <ClientChip name={client.name} color={client.tagColor} /> : null}
          <span title={fullDate(n.date)}>
            {relativeDate(n.date)} · {formatTime(n.date)} · {formatDuration(n.durationMinutes)}
          </span>
          <PlatformBadge platform={n.platform} />
          <span className="inline-flex items-center gap-1 rounded-md bg-ember-soft px-2 py-0.5 font-medium text-ember">
            AI transcribed
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{n.attendees.join(" · ")}</p>

        <div className="hidden flex-wrap gap-2 pt-1 md:flex">
          <Action onClick={() => setReviewed(n.id, !isReviewed)} active={isReviewed}>
            <Check className="size-3.5" /> {isReviewed ? "Reviewed" : "Mark reviewed"}
          </Action>
          <Action onClick={() => setEditing((v) => !v)} active={editing}>
            {editing ? "Done editing" : "Edit inline"}
          </Action>
          <Action onClick={() => setMdOpen(true)}>
            <Copy className="size-3.5" /> Copy markdown
          </Action>
          <Action onClick={() => setFollowUpOpen(true)}>
            <Mail className="size-3.5" /> Draft follow-up
          </Action>
          <Action onClick={() => download(`${n.id}.md`, md)}>
            <FileDown className="size-3.5" /> Export
          </Action>
          <Action onClick={() => download(`${n.id}-transcript.txt`, n.transcript)}>
            <Download className="size-3.5" /> Transcript
          </Action>
          <Action onClick={() => void remove()} danger>
            <Trash2 className="size-3.5" /> Delete
          </Action>
        </div>
      </header>

      <Section title="Summary">
        <p
          contentEditable={editing}
          suppressContentEditableWarning
          className={cn(
            "text-[15px] leading-relaxed text-foreground/90 outline-none",
            editing && "rounded-md bg-accent/60 px-2 py-1 ring-1 ring-ring/25",
          )}
        >
          {n.summary}
        </p>
      </Section>

      <Section title="Decisions">
        <ul className="space-y-2">
          {n.decisions.map((d) => (
            <li key={d} className="flex gap-2.5 text-[15px] leading-relaxed">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ember" />
              <span contentEditable={editing} suppressContentEditableWarning className="outline-none">
                {d}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Action items · ${items.filter((a) => !a.done).length} open`}>
        <div className="grid gap-2">
          {items.map((a) => (
            <div
              key={a.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border border-hairline bg-card px-3.5 py-3 transition-opacity duration-200",
                a.done && "opacity-55",
              )}
            >
              <input
                type="checkbox"
                checked={a.done}
                onChange={() => void toggleItem(a)}
                aria-label={`Mark "${a.text}" ${a.done ? "not done" : "done"}`}
                className="mt-0.5 size-4 accent-[oklch(0.53_0.145_42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm leading-snug", a.done && "line-through")}>{a.text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <PriorityDot priority={a.priority} />
                  <DueBadge iso={a.dueDate} done={a.done} />
                  <input
                    value={a.owner}
                    aria-label={`Owner for "${a.text}"`}
                    onChange={(e) => patchItem(a.id, { owner: e.target.value })}
                    className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 outline-none hover:border-hairline focus:border-hairline"
                  />
                  <input
                    type="date"
                    aria-label={`Due date for "${a.text}"`}
                    value={a.dueDate ? a.dueDate.slice(0, 10) : ""}
                    onChange={(e) =>
                      patchItem(a.id, {
                        dueDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                      })
                    }
                    className="rounded border border-transparent bg-transparent px-1 py-0.5 outline-none hover:border-hairline focus:border-hairline"
                  />
                  <button
                    aria-pressed={!!a.syncedToTeamwork}
                    aria-label={`Toggle Teamwork sync for "${a.text}"`}
                    onClick={() => patchItem(a.id, { syncedToTeamwork: !a.syncedToTeamwork })}
                    className={cn(
                      "ml-auto rounded-md border px-1.5 py-0.5 transition-colors",
                      a.syncedToTeamwork
                        ? "border-ember/40 bg-ember-soft text-ember"
                        : "border-hairline hover:bg-accent",
                    )}
                  >
                    → Teamwork
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {n.openQuestions.length ? (
        <Section title="Open questions">
          <ul className="space-y-2">
            {n.openQuestions.map((q) => (
              <li key={q} className="flex gap-2.5 text-[15px] leading-relaxed text-foreground/90">
                <span className="text-ember">?</span>
                {q}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTranscript((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-200", showTranscript && "rotate-180")}
            />
            Transcript
          </button>
          <button
            onClick={() => void copy(n.transcript, "Transcript")}
            className="text-[11px] text-muted-foreground hover:text-ember"
          >
            Copy
          </button>
        </div>
        {showTranscript ? (
          <pre className="animate-[fade-in_180ms_ease-out] whitespace-pre-wrap rounded-xl border border-hairline bg-surface p-5 text-[13px] leading-relaxed text-muted-foreground">
            {n.transcript}
          </pre>
        ) : null}
      </section>

      <FollowUpDialog note={n} open={followUpOpen} onOpenChange={setFollowUpOpen} />

      <Dialog open={mdOpen} onOpenChange={setMdOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-title text-xl">Markdown preview</DialogTitle>
            <DialogDescription>
              Exactly what lands on your clipboard — paste it anywhere that speaks markdown.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border border-hairline bg-surface p-4 text-[13px] leading-relaxed text-muted-foreground">
            {md}
          </pre>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setMdOpen(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              Close
            </button>
            <button
              onClick={() => {
                void copy(md, "Markdown");
                setMdOpen(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ember px-3 py-1.5 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <Copy className="size-3.5" /> Copy markdown
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Mobile sticky action bar, sits above the tab bar */}
      <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 border-t border-hairline bg-background/95 px-3 py-2 backdrop-blur md:hidden">
        <button
          onClick={() => setMdOpen(true)}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-ember px-3 text-sm font-medium text-[oklch(0.99_0.005_85)]"
        >
          <Copy className="size-4" /> Copy markdown
        </button>
        <button
          onClick={() => setReviewed(n.id, !isReviewed)}
          aria-label={isReviewed ? "Mark not reviewed" : "Mark reviewed"}
          className={cn(
            "grid size-11 place-items-center rounded-lg border border-border",
            isReviewed && "border-ember text-ember",
          )}
        >
          <Check className="size-4" />
        </button>
        <button
          onClick={() => download(`${n.id}.md`, md)}
          aria-label="Export note"
          className="grid size-11 place-items-center rounded-lg border border-border"
        >
          <FileDown className="size-4" />
        </button>
        <button
          onClick={() => download(`${n.id}-transcript.txt`, n.transcript)}
          aria-label="Download transcript"
          className="grid size-11 place-items-center rounded-lg border border-border"
        >
          <Download className="size-4" />
        </button>
        <button
          onClick={() => void remove()}
          aria-label="Delete note"
          className="grid size-11 place-items-center rounded-lg border border-border text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  );
}

function Action({
  children,
  onClick,
  active,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-xs transition-colors hover:bg-accent",
        active && "border-ember/40 bg-ember-soft text-ember hover:bg-ember-soft",
        danger && "text-destructive hover:bg-destructive/10",
      )}
    >
      {children}
    </button>
  );
}

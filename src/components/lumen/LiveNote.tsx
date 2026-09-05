import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, PanelRightClose, PanelRightOpen, Square } from "lucide-react";
import { toast } from "sonner";
import { endLiveSession, getLiveSession, getLiveUpdates, listClients } from "@/lib/api";
import type { LiveSegment, LiveSession } from "@/lib/types";
import {
  ClientChip,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PlatformBadge,
  SectionTitle,
} from "./primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function LiveNote() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const session = useQuery({ queryKey: ["live"], queryFn: getLiveSession });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });

  const [segments, setSegments] = useState<LiveSegment[]>([]);
  const [paused, setPaused] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [freshIds, setFreshIds] = useState<string[]>([]);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const data: LiveSession | null | undefined = session.data;

  useEffect(() => {
    if (data?.segments?.length && segments.length === 0) setSegments(data.segments);
  }, [data, segments.length]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paused]);

  useEffect(() => {
    if (!data || paused || data.status === "ended") return;
    let cancelled = false;
    const tick = async () => {
      const last = segments[segments.length - 1]?.id;
      const next = await getLiveUpdates(data.id, last);
      if (cancelled || next.length === 0) return;
      setSegments((prev) => [...prev, ...next]);
      const ids = next.filter((s) => s.kind === "action").map((s) => s.id);
      if (ids.length) {
        setFreshIds((p) => [...p, ...ids]);
        setTimeout(() => setFreshIds((p) => p.filter((i) => !ids.includes(i))), 2400);
      }
    };
    const t = setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [data, paused, segments]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [segments, showTranscript]);

  const notes = segments.filter((s) => s.kind === "note");
  const decisions = segments.filter((s) => s.kind === "decision");
  const actions = segments.filter((s) => s.kind === "action");
  const speech = segments.filter((s) => s.kind === "speech");

  const elapsed = useMemo(() => {
    if (!data) return 0;
    const start = new Date(data.startedAtISO).getTime();
    return (pausedAt ?? now) - start;
  }, [data, now, pausedAt]);

  if (session.isLoading) return <ListSkeleton rows={5} />;
  if (session.isError) return <ErrorState onRetry={() => void session.refetch()} />;
  if (!data)
    return (
      <EmptyState
        title="No active meeting"
        body="When your Mac starts capturing a Meet or Zoom call, the live note opens here and fills itself in."
        actionLabel="Browse all notes"
        actionTo="/notes"
      />
    );

  const client = clients.data?.find((c) => c.id === data.clientId);

  async function end() {
    setCompiling(true);
    try {
      const note = await endLiveSession(data!.id);
      await new Promise((r) => setTimeout(r, 900));
      await qc.invalidateQueries({ queryKey: ["notes"] });
      await qc.invalidateQueries({ queryKey: ["actionItems"] });
      qc.setQueryData(["live"], null);
      setConfirmOpen(false);
      void navigate({ to: "/notes/$noteId", params: { noteId: note.id } });
    } catch {
      toast.error("Couldn't compile the note. Try again.");
    } finally {
      setCompiling(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3 animate-[rise_200ms_ease-out]">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium",
              paused ? "border border-border" : "bg-ember-soft text-ember",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                paused
                  ? "border border-current"
                  : "animate-pulse bg-[oklch(0.55_0.2_25)]",
              )}
            />
            {paused ? "Paused" : "Recording"}
          </span>
          <span className="tabular-nums">{clock(elapsed)}</span>
          <PlatformBadge platform={data.platform} />
          {client ? <ClientChip name={client.name} color={client.tagColor} /> : null}
        </div>
        <h1 className="text-title text-3xl font-semibold tracking-tight md:text-4xl">
          {data.title}
        </h1>
        <p className="text-xs text-muted-foreground">{data.attendees.join(" · ")}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => {
              setPaused((p) => {
                const next = !p;
                setPausedAt(next ? Date.now() : null);
                return next;
              });
            }}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-ember px-3 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Square className="size-3.5" /> End meeting
          </button>
          <button
            onClick={() => setShowTranscript((v) => !v)}
            aria-label={showTranscript ? "Hide live transcript" : "Show live transcript"}
            className="ml-auto inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {showTranscript ? (
              <PanelRightClose className="size-3.5" />
            ) : (
              <PanelRightOpen className="size-3.5" />
            )}
            Transcript
          </button>
        </div>
      </header>

      <div className={cn("grid gap-8", showTranscript && "lg:grid-cols-[1fr_20rem]")}>
        <div className="min-w-0 space-y-8">
          <section className="space-y-3">
            <SectionTitle>Summary</SectionTitle>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Listening. The summary starts writing itself once the conversation settles.
              </p>
            ) : (
              <p className="text-[15px] leading-relaxed text-foreground/90">
                {notes.map((n) => n.text).join(" ")}
              </p>
            )}
          </section>

          <section className="space-y-3">
            <SectionTitle>Decisions</SectionTitle>
            {decisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing decided yet.</p>
            ) : (
              <ul className="space-y-2">
                {decisions.map((d) => (
                  <li
                    key={d.id}
                    className="flex animate-[rise_150ms_ease-out] gap-2.5 text-[15px] leading-relaxed"
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ember" />
                    {d.text}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <SectionTitle>Action items</SectionTitle>
            {actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No actions captured yet.</p>
            ) : (
              <ul className="overflow-hidden rounded-xl border border-hairline bg-card">
                {actions.map((a) => (
                  <li
                    key={a.id}
                    className={cn(
                      "flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3 text-sm transition-colors duration-500 last:border-0",
                      freshIds.includes(a.id) && "bg-[oklch(0.96_0.06_95)] dark:bg-[oklch(0.32_0.05_95)]",
                    )}
                  >
                    <span className="size-4 shrink-0 rounded border border-border" aria-hidden />
                    <span className="min-w-0 flex-1">{a.text}</span>
                    {a.actionOwner ? (
                      <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] text-muted-foreground">
                        {a.actionOwner}
                      </span>
                    ) : null}
                    {a.actionDue ? (
                      <span className="rounded-md border border-hairline px-2 py-0.5 text-[11px] text-muted-foreground">
                        {a.actionDue}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {showTranscript ? (
          <aside className="min-w-0">
            <SectionTitle>Live transcript</SectionTitle>
            <div
              ref={transcriptRef}
              className="mt-3 max-h-[26rem] space-y-3 overflow-auto rounded-xl border border-hairline bg-surface p-4"
            >
              {speech.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Waiting for the first words…</p>
              ) : (
                speech.map((s) => (
                  <p key={s.id} className="animate-[fade-in_150ms_ease-out] text-[13px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground/70">{s.speaker}: </span>
                    {s.text}
                  </p>
                ))
              )}
            </div>
          </aside>
        ) : null}
      </div>

      <Dialog open={confirmOpen} onOpenChange={(o) => !compiling && setConfirmOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-title text-xl">End this meeting?</DialogTitle>
            <DialogDescription>
              Lumen compiles everything captured so far into a finished note.
            </DialogDescription>
          </DialogHeader>
          {compiling ? (
            <div className="space-y-2 py-2">
              <p className="text-sm text-muted-foreground">Compiling…</p>
              <div className="h-2 animate-pulse rounded-full bg-accent" />
              <div className="h-2 w-2/3 animate-pulse rounded-full bg-accent" />
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                Keep recording
              </button>
              <button
                onClick={() => void end()}
                className="rounded-lg bg-ember px-3 py-1.5 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90"
              >
                End &amp; compile
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

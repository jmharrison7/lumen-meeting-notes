import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, ChevronDown, Clock, ExternalLink, Mic } from "lucide-react";
import { listActionItems, listClients, listIdeas, listNotes, listTodayEvents, listUpcomingEvents } from "@/lib/api";
import { dueBucket, formatTime, relativeDate } from "@/lib/format";
import type { CalendarEvent, Client } from "@/lib/types";
import { ClientChip, EmptyState, ListSkeleton, PlatformBadge, SectionTitle } from "@/components/lumen/primitives";
import { NoteRow } from "@/components/lumen/NoteRow";
import { InstallHint } from "@/components/lumen/InstallHint";
import { LiveCard } from "@/components/lumen/LiveCard";
import { MoneyCard } from "@/components/lumen/MoneyCard";

import { useUi } from "@/lib/ui-store";
import { useAccess } from "@/lib/access-store";
import { useScope } from "@/lib/scope-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — Lumen meeting notes" },
      {
        name: "description",
        content:
          "Your day at a glance: today's calls, the latest AI meeting notes, and every action item still open.",
      },
      { property: "og:title", content: "Today — Lumen meeting notes" },
      {
        property: "og:description",
        content: "Today's calls, the latest AI meeting notes, and every open action item.",
      },
    ],
  }),
  component: TodayPage,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function MeetingRow({
  event,
  clientOf,
  canContribute,
}: {
  event: CalendarEvent;
  clientOf: (id?: string) => Client | undefined;
  canContribute: boolean;
}) {
  const [open, setOpen] = useState(false);
  const client = clientOf(event.clientId);
  const attendeeNames = (event.attendees ?? [])
    .filter((a) => !a.email.toLowerCase().startsWith("mary@embrcreative"))
    .map((a) => a.name || a.email.split("@")[0]);

  const startRecording = () => {
    window.dispatchEvent(
      new CustomEvent("lumen:start-meeting-recording", {
        detail: { clientId: event.clientId, title: event.title, platform: event.platform },
      }),
    );
  };

  return (
    <div className="border-b border-hairline last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-surface/40"
      >
        <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
          <Clock className="size-3.5" />
          {formatTime(event.start)}
        </span>
        <span className="text-title text-[15px] font-medium">{event.title}</span>
        {client ? <ClientChip name={client.name} color={client.tagColor} /> : null}
        <span className="ml-auto inline-flex items-center gap-2">
          <PlatformBadge platform={event.platform} />
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-hairline bg-surface/40 px-5 py-4">
          {attendeeNames.length ? (
            <p className="text-xs text-muted-foreground">
              With <span className="font-medium text-foreground">{attendeeNames.join(", ")}</span>
            </p>
          ) : null}
          {event.description ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{event.description}</p>
          ) : null}
          {event.location ? (
            <p className="text-xs text-muted-foreground">
              📍 {event.location}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {event.joinUrl ? (
              <a
                href={event.joinUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-ember px-3 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90"
              >
                <ExternalLink className="size-3.5" />
                {event.platform === "zoom" ? "Join Zoom" : "Join Google Meet"}
              </a>
            ) : null}
            {canContribute ? (
              <button
                type="button"
                onClick={startRecording}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-hairline bg-card px-3 text-sm font-medium transition-colors hover:bg-ember-soft/60"
              >
                <Mic className="size-3.5" />
                Start recording
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UpcomingList({
  events,
  clientOf,
  canContribute,
}: {
  events: CalendarEvent[];
  clientOf: (id?: string) => Client | undefined;
  canContribute: boolean;
}) {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = e.dayKey || e.start.slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }
  const days = [...byDay.keys()];
  return (
    <div className="space-y-4">
      {days.map((key) => (
        <div key={key} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {upcomingDayLabel(key)}
          </p>
          <div className="overflow-hidden rounded-xl border border-hairline bg-card">
            {(byDay.get(key) ?? []).map((e) => (
              <MeetingRow key={e.id} event={e} clientOf={clientOf} canContribute={canContribute} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function upcomingDayLabel(dayKey: string) {
  const d = new Date(dayKey + "T12:00:00");
  const t = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const diff = Math.round((a - b) / 86400000);
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function TodayPage() {
  const { applyItem, hiddenNotes } = useUi();
  const { canSeeClient, canContribute } = useAccess();
  const { scope } = useScope();
  const events = useQuery({ queryKey: ["events"], queryFn: listTodayEvents });
  const upcoming = useQuery({ queryKey: ["eventsUpcoming"], queryFn: () => listUpcomingEvents(3) });
  const notes = useQuery({ queryKey: ["notes"], queryFn: listNotes });
  const ideas = useQuery({ queryKey: ["ideas"], queryFn: listIdeas });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const items = useQuery({ queryKey: ["actionItems"], queryFn: listActionItems });

  const scopedClientIds = new Set((clients.data ?? []).filter((c) => (c.scope ?? "work") === scope).map((c) => c.id));
  const clientOf = (id: string) => clients.data?.find((c) => c.id === id);
  const open = (items.data ?? [])
    .map(applyItem)
    .filter((a) => !a.done && canSeeClient(a.clientId) && scopedClientIds.has(a.clientId));
  const counts = {
    overdue: open.filter((a) => dueBucket(a.dueDate) === "overdue").length,
    today: open.filter((a) => dueBucket(a.dueDate) === "today").length,
    upcoming: open.filter((a) => ["week", "later"].includes(dueBucket(a.dueDate))).length,
  };

  const recentIdeas = (ideas.data ?? [])
    .filter((i) => (i.status ?? "accepted") !== "pending")
    .filter((i) => (i.clientId ? canSeeClient(i.clientId) && scopedClientIds.has(i.clientId) : scope === "work"))
    .slice(0, 3);
  const latest = (notes.data ?? [])
    .filter((n) => !hiddenNotes.includes(n.id) && canSeeClient(n.clientId) && scopedClientIds.has(n.clientId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <div className="space-y-12">
      <header className="animate-[rise_200ms_ease-out]">
        <h1 className="text-title text-3xl font-semibold tracking-tight md:text-4xl">
          {greeting()}, Mary.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {scope === "personal"
            ? "Personal events, home projects and family coordination in one place."
            : "Three calls on the calendar today. Everything else is already written up."}
        </p>
      </header>

      <InstallHint className="md:hidden" />

      <LiveCard />

      <section className="space-y-3">
        <SectionTitle>{scope === "personal" ? "Today's personal calendar" : "Today's meetings"}</SectionTitle>
        {events.isLoading ? (
          <ListSkeleton rows={3} />
        ) : (events.data ?? []).length === 0 ? (
          <EmptyState
            title="Nothing on the calendar"
            body={
              scope === "personal"
                ? "A quiet day. Family events and home-project check-ins will land here."
                : "A quiet day. When a Meet or Zoom call starts, Lumen records and writes it up for you."
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-hairline bg-card">
            {(events.data ?? []).map((e) => (
              <MeetingRow
                key={e.id}
                event={e}
                clientOf={clientOf}
                canContribute={canContribute}
              />
            ))}
          </div>
        )}
      </section>

      {scope !== "personal" && (upcoming.data ?? []).length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>Coming up</SectionTitle>
          <UpcomingList events={upcoming.data ?? []} clientOf={clientOf} canContribute={canContribute} />
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionTitle>{scope === "personal" ? "Open next steps" : "Open action items"}</SectionTitle>
        <Link
          to="/actions"
          className="group flex flex-wrap items-center gap-6 rounded-xl border border-hairline bg-card px-5 py-4 transition-shadow hover:shadow-soft"
        >
          <Stat label="Overdue" value={counts.overdue} accent />
          <Stat label="Due today" value={counts.today} />
          <Stat label="Upcoming" value={counts.upcoming} />
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-ember">
            Open list <ArrowRight className="size-3.5" />
          </span>
        </Link>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <SectionTitle>{scope === "personal" ? "Recent personal ideas" : "Recent ideas"}</SectionTitle>
          <Link to="/ideas" className="text-xs text-muted-foreground hover:text-ember">
            {scope === "personal" ? "Capture a plan" : "Capture a thought"}
          </Link>
        </div>
        {recentIdeas.length === 0 ? (
          <EmptyState
            title={scope === "personal" ? "No plans captured yet" : "No ideas yet — say the first one out loud"}
            body={
              scope === "personal"
                ? "Record a party idea, home-project thought or family planning note."
                : "Record a thought or upload a voice memo from your phone."
            }
            actionLabel="Open Ideas"
            actionTo="/ideas"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {recentIdeas.map((i) => (
              <Link
                key={i.id}
                to="/ideas/$ideaId"
                params={{ ideaId: i.id }}
                className="rounded-xl border border-hairline bg-card p-4 transition-shadow hover:shadow-soft"
              >
                <p className="text-title line-clamp-2 text-[15px] font-medium leading-snug">{i.title}</p>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {i.transcript}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">{relativeDate(i.createdAtISO)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <SectionTitle>{scope === "personal" ? "Latest personal notes" : "Latest notes"}</SectionTitle>
          <Link to="/notes" className="text-xs text-muted-foreground hover:text-ember">
            {scope === "personal" ? "All personal notes" : "All notes"}
          </Link>
        </div>
        {notes.isLoading ? (
          <ListSkeleton rows={3} />
        ) : latest.length === 0 ? (
          <EmptyState
            title="No notes yet"
            body={
              scope === "personal"
                ? "Record an in-person planning session and the recap will land here."
                : "Once your Mac captures a call, the write-up lands here within a minute."
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-hairline bg-card">
            {latest.map((n) => (
              <NoteRow key={n.id} note={n} client={clientOf(n.clientId)} />
            ))}
          </div>
        )}
      </section>

      {scope === "work" ? <MoneyCard /> : null}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <p
        className={`text-title text-2xl font-semibold tabular-nums ${accent && value > 0 ? "text-ember" : ""}`}
      >
        {value}
      </p>
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
    </div>
  );
}

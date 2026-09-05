import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock } from "lucide-react";
import { listActionItems, listClients, listIdeas, listNotes, listTodayEvents } from "@/lib/api";
import { dueBucket, formatTime, relativeDate } from "@/lib/format";
import { ClientChip, EmptyState, ListSkeleton, PlatformBadge, SectionTitle } from "@/components/lumen/primitives";
import { NoteRow } from "@/components/lumen/NoteRow";
import { InstallHint } from "@/components/lumen/InstallHint";
import { LiveCard } from "@/components/lumen/LiveCard";

import { useUi } from "@/lib/ui-store";

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

function TodayPage() {
  const { applyItem, hiddenNotes } = useUi();
  const events = useQuery({ queryKey: ["events"], queryFn: listTodayEvents });
  const notes = useQuery({ queryKey: ["notes"], queryFn: listNotes });
  const ideas = useQuery({ queryKey: ["ideas"], queryFn: listIdeas });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const items = useQuery({ queryKey: ["actionItems"], queryFn: listActionItems });

  const clientOf = (id: string) => clients.data?.find((c) => c.id === id);
  const open = (items.data ?? []).map(applyItem).filter((a) => !a.done);
  const counts = {
    overdue: open.filter((a) => dueBucket(a.dueDate) === "overdue").length,
    today: open.filter((a) => dueBucket(a.dueDate) === "today").length,
    upcoming: open.filter((a) => ["week", "later"].includes(dueBucket(a.dueDate))).length,
  };

  const latest = (notes.data ?? [])
    .filter((n) => !hiddenNotes.includes(n.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <div className="space-y-12">
      <header className="animate-[rise_200ms_ease-out]">
        <h1 className="text-title text-3xl font-semibold tracking-tight md:text-4xl">
          {greeting()}, Mary.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Three calls on the calendar today. Everything else is already written up.
        </p>
      </header>

      <InstallHint className="md:hidden" />

      <LiveCard />


      <section className="space-y-3">
        <SectionTitle>Today's meetings</SectionTitle>
        {events.isLoading ? (
          <ListSkeleton rows={3} />
        ) : (events.data ?? []).length === 0 ? (
          <EmptyState
            title="Nothing on the calendar"
            body="A quiet day. When a Meet or Zoom call starts, Lumen records and writes it up for you."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-hairline bg-card">
            {(events.data ?? []).map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline px-5 py-4 last:border-0"
              >
                <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                  <Clock className="size-3.5" />
                  {formatTime(e.start)}
                </span>
                <span className="text-title text-[15px] font-medium">{e.title}</span>
                {e.clientId && clientOf(e.clientId) ? (
                  <ClientChip
                    name={clientOf(e.clientId)!.name}
                    color={clientOf(e.clientId)!.tagColor}
                  />
                ) : null}
                <span className="ml-auto">
                  <PlatformBadge platform={e.platform} />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Open action items</SectionTitle>
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
          <SectionTitle>Recent ideas</SectionTitle>
          <Link to="/ideas" className="text-xs text-muted-foreground hover:text-ember">
            Capture a thought
          </Link>
        </div>
        {recentIdeas.length === 0 ? (
          <EmptyState
            title="No ideas yet — say the first one out loud"
            body="Record a thought or upload a voice memo from your phone."
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
          <SectionTitle>Latest notes</SectionTitle>
          <Link to="/notes" className="text-xs text-muted-foreground hover:text-ember">
            All notes
          </Link>
        </div>
        {notes.isLoading ? (
          <ListSkeleton rows={3} />
        ) : latest.length === 0 ? (
          <EmptyState
            title="No notes yet"
            body="Once your Mac captures a call, the write-up lands here within a minute."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-hairline bg-card">
            {latest.map((n) => (
              <NoteRow key={n.id} note={n} client={clientOf(n.clientId)} />
            ))}
          </div>
        )}
      </section>
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

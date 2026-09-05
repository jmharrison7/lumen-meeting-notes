import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listActionItems, listClients, updateActionItem } from "@/lib/api";
import { dueBucket, formatDate } from "@/lib/format";
import {
  ClientChip,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PriorityDot,
  SectionTitle,
} from "@/components/lumen/primitives";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import type { ActionItem } from "@/lib/types";

export const Route = createFileRoute("/actions")({
  head: () => ({
    meta: [
      { title: "Action items — Lumen" },
      {
        name: "description",
        content:
          "Every commitment made on a call, grouped by what's overdue, due today, this week, and later.",
      },
      { property: "og:title", content: "Action items — Lumen" },
      {
        property: "og:description",
        content: "Every commitment made on a call, grouped by when it's due.",
      },
    ],
  }),
  component: ActionsPage,
});

const groups = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
] as const;

function ActionsPage() {
  const { applyItem, patchItem } = useUi();
  const items = useQuery({ queryKey: ["actionItems"], queryFn: listActionItems });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [clientFilter, setClientFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");

  const all = useMemo(() => (items.data ?? []).map(applyItem), [items.data, applyItem]);
  const owners = useMemo(() => [...new Set(all.map((a) => a.owner))].sort(), [all]);

  const filtered = all.filter(
    (a) =>
      (clientFilter === "all" || a.clientId === clientFilter) &&
      (ownerFilter === "all" || a.owner === ownerFilter),
  );

  const clientOf = (id: string) => clients.data?.find((c) => c.id === id);

  async function toggle(item: ActionItem) {
    patchItem(item.id, { done: !item.done });
    await updateActionItem(item.id, { done: !item.done });
  }

  const done = filtered.filter((a) => a.done);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-title text-3xl font-semibold tracking-tight">Action items</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {filtered.filter((a) => !a.done).length} open across your clients.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="h-9 rounded-lg border border-hairline bg-card px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="all">All clients</option>
          {(clients.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="h-9 rounded-lg border border-hairline bg-card px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="all">Everyone</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {items.isError ? (
        <ErrorState onRetry={() => void items.refetch()} />
      ) : items.isLoading ? (
        <ListSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No action items here"
          body="Nothing was committed to on these calls — or you've already cleared them all."
          actionLabel="Browse notes"
          actionTo="/notes"
        />
      ) : (
        <div className="space-y-8">
          {groups.map((g) => {
            const list = filtered.filter((a) => !a.done && dueBucket(a.dueDate) === g.key);
            if (!list.length) return null;
            return (
              <section key={g.key} className="space-y-3">
                <SectionTitle>
                  {g.label} · {list.length}
                </SectionTitle>
                <div className="grid gap-2.5">
                  {list.map((a) => (
                    <Card
                      key={a.id}
                      item={a}
                      clientName={clientOf(a.clientId)?.name}
                      color={clientOf(a.clientId)?.tagColor}
                      onToggle={() => void toggle(a)}
                      overdue={g.key === "overdue"}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {done.length ? (
            <section className="space-y-3">
              <SectionTitle>Done · {done.length}</SectionTitle>
              <div className="grid gap-2.5">
                {done.map((a) => (
                  <Card
                    key={a.id}
                    item={a}
                    clientName={clientOf(a.clientId)?.name}
                    color={clientOf(a.clientId)?.tagColor}
                    onToggle={() => void toggle(a)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Card({
  item,
  clientName,
  color,
  onToggle,
  overdue,
}: {
  item: ActionItem;
  clientName?: string | undefined;
  color?: import("@/lib/types").TagColor | undefined;
  onToggle: () => void;
  overdue?: boolean | undefined;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-hairline bg-card px-4 py-3.5 transition-all duration-200",
        item.done && "opacity-55",
      )}
    >
      <input
        type="checkbox"
        checked={item.done}
        onChange={onToggle}
        aria-label={item.text}
        className="mt-0.5 size-4 accent-[oklch(0.53_0.145_42)]"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-snug", item.done && "line-through")}>{item.text}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <PriorityDot priority={item.priority} />
          <span>{item.owner}</span>
          {clientName && color ? <ClientChip name={clientName} color={color} /> : null}
          {item.dueDate ? (
            <span className={cn(overdue && !item.done && "font-medium text-ember")}>
              {formatDate(item.dueDate)}
            </span>
          ) : null}
          <Link
            to="/notes/$noteId"
            params={{ noteId: item.noteId }}
            className="truncate hover:text-ember"
          >
            {item.noteTitle}
          </Link>
        </div>
      </div>
    </div>
  );
}

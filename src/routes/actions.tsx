import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  createActionItem,
  deleteActionItem,
  listActionItems,
  listClients,
  updateActionItem,
} from "@/lib/api";
import { dueBucket } from "@/lib/format";
import {
  ClientChip,
  DueBadge,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PriorityDot,
  SectionTitle,
} from "@/components/lumen/primitives";
import { useUi } from "@/lib/ui-store";
import { useAccess } from "@/lib/access-store";
import { useScope } from "@/lib/scope-store";
import { cn } from "@/lib/utils";
import type { ActionItem } from "@/lib/types";

export const Route = createFileRoute("/actions")({
  head: () => ({
    meta: [
      { title: "To-do list — Lumen" },
      {
        name: "description",
        content:
          "Everything on your plate, grouped by what's overdue, due today, this week, and later.",
      },
      { property: "og:title", content: "To-do list — Lumen" },
      {
        property: "og:description",
        content: "Every commitment and to-do, grouped by when it's due.",
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
  const { canSeeClient, canEdit } = useAccess();
  const { scope } = useScope();
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ["actionItems"], queryFn: listActionItems });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [clientFilter, setClientFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [newText, setNewText] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newDue, setNewDue] = useState("");
  const [adding, setAdding] = useState(false);

  const scopedClients = useMemo(
    () => (clients.data ?? []).filter((c) => (c.scope ?? "work") === scope),
    [clients.data, scope],
  );

  const all = useMemo(
    () => {
      const scopedClientIds = new Set(scopedClients.map((c) => c.id));
      return (items.data ?? [])
        .map(applyItem)
        // Unassigned to-dos (no client yet) belong on the list too — they get their own column.
        .filter((a) => (!a.clientId ? true : canSeeClient(a.clientId) && scopedClientIds.has(a.clientId)));
    },
    [items.data, scopedClients, applyItem, canSeeClient],
  );
  const owners = useMemo(() => [...new Set(all.map((a) => a.owner))].sort(), [all]);

  const filtered = all.filter(
    (a) =>
      (clientFilter === "all" || a.clientId === clientFilter) &&
      (ownerFilter === "all" || a.owner === ownerFilter),
  );

  const clientOf = (id?: string) => (id ? clients.data?.find((c) => c.id === id) : undefined);

  // Top-level to-dos only — subtasks render nested under their parent, not as their own rows.
  const top = filtered.filter((a) => !a.parentId);
  const subsOf = (id: string) => filtered.filter((a) => a.parentId === id);
  const unassigned = filtered.filter((a) => !a.clientId && !a.done);
  const done = filtered.filter((a) => a.done);
  const openCount = filtered.filter((a) => !a.done).length;

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["actionItems"] });
  }

  async function toggle(item: ActionItem) {
    if (!canEdit) return;
    patchItem(item.id, { done: !item.done });
    await updateActionItem(item.id, { done: !item.done });
    await refresh();
  }

  async function addTodo() {
    const text = newText.trim();
    if (!text || adding) return;
    setAdding(true);
    try {
      await createActionItem({
        text,
        clientId: newClient || undefined,
        dueDate: newDue || undefined,
      });
      setNewText("");
      setNewDue("");
      await refresh();
    } finally {
      setAdding(false);
    }
  }

  async function removeTodo(item: ActionItem) {
    if (!canEdit) return;
    await deleteActionItem(item.id);
    await refresh();
  }

  /** File an unassigned to-do onto a client (Mary: drag it into place). */
  async function assignTodo(item: ActionItem, clientId: string) {
    if (!canEdit) return;
    await updateActionItem(item.id, { clientId });
    await refresh();
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-title text-3xl font-semibold tracking-tight">To-do list</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {openCount} open across {scope === "personal" ? "personal areas" : "your clients"}.
        </p>
      </header>

      {canEdit ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void addTodo();
          }}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-card p-3 shadow-soft"
        >
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Add a to-do…"
            aria-label="New to-do"
            className="min-h-[44px] min-w-[12rem] flex-1 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
          />
          <select
            value={newClient}
            onChange={(e) => setNewClient(e.target.value)}
            aria-label="Assign to"
            className="h-11 rounded-lg border border-hairline bg-card px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          >
            <option value="">Unassigned</option>
            {scopedClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            aria-label="Due date (optional)"
            className="h-11 rounded-lg border border-hairline bg-card px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="submit"
            disabled={!newText.trim() || adding}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-ember px-3.5 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="size-4" /> Add
          </button>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="h-9 rounded-lg border border-hairline bg-card px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="all">{scope === "personal" ? "All areas" : "All clients"}</option>
          {scopedClients.map((c) => (
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
      ) : (
        <div className="grid gap-8 lg:grid-cols-4">
          <div className="space-y-8 lg:col-span-3">
            {openCount === 0 && !done.length ? (
              <EmptyState
                title="Nothing on the list"
                body="Add a to-do above, or record a meeting and Lumen will pull the commitments out for you."
              />
            ) : null}

            {groups.map((g) => {
              const list = top.filter((a) => !a.done && dueBucket(a.dueDate) === g.key);
              if (!list.length) return null;
              return (
                <section key={g.key} className="space-y-3">
                  <SectionTitle>
                    {g.label} · {list.length}
                  </SectionTitle>
                  <div className="grid gap-2.5">
                    {list.map((a) => (
                      <TodoRow
                        key={a.id}
                        item={a}
                        subtasks={subsOf(a.id)}
                        clientName={clientOf(a.clientId)?.name}
                        color={clientOf(a.clientId)?.tagColor}
                        onToggle={(it) => void toggle(it)}
                        onDelete={(it) => void removeTodo(it)}
                        readOnly={!canEdit}
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
                    <TodoRow
                      key={a.id}
                      item={a}
                      subtasks={subsOf(a.id)}
                      clientName={clientOf(a.clientId)?.name}
                      color={clientOf(a.clientId)?.tagColor}
                      onToggle={(it) => void toggle(it)}
                      onDelete={(it) => void removeTodo(it)}
                      readOnly={!canEdit}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-3 lg:col-span-1">
            <SectionTitle>Unassigned · {unassigned.length}</SectionTitle>
            {unassigned.length === 0 ? (
              <p className="rounded-xl border border-dashed border-hairline px-3 py-4 text-xs text-muted-foreground">
                Nothing unassigned. Lumen drops anything it can’t file here so you can place it.
              </p>
            ) : (
              <div className="grid gap-2.5">
                {unassigned.map((a) => (
                  <div
                    key={a.id}
                    className="space-y-2 rounded-xl border border-hairline bg-card px-3 py-3 shadow-soft"
                  >
                    <p className="text-sm leading-snug">{a.text}</p>
                    {canEdit ? (
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) void assignTodo(a, e.target.value);
                        }}
                        aria-label={`File "${a.text}" under a client`}
                        className="h-9 w-full rounded-lg border border-hairline bg-surface px-2 text-xs outline-none focus:ring-2 focus:ring-ring/30"
                      >
                        <option value="">File under…</option>
                        {scopedClients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function TodoRow({
  item,
  subtasks,
  clientName,
  color,
  onToggle,
  onDelete,
  readOnly,
  overdue,
}: {
  item: ActionItem;
  subtasks?: ActionItem[] | undefined;
  clientName?: string | undefined;
  color?: import("@/lib/types").TagColor | undefined;
  onToggle: (item: ActionItem) => void;
  onDelete: (item: ActionItem) => void;
  readOnly?: boolean;
  overdue?: boolean | undefined;
}) {
  const subs = subtasks ?? [];
  return (
    <div className="space-y-2">
      <div
        className={cn(
          "group flex items-start gap-3 rounded-xl border border-hairline bg-card px-4 py-3.5 transition-all duration-200 hover:border-border hover:shadow-soft",
          item.done && "opacity-55",
          overdue && !item.done && "border-destructive/25 bg-destructive/[0.035]",
        )}
      >
        <input
          type="checkbox"
          checked={item.done}
          onChange={() => onToggle(item)}
          disabled={readOnly}
          aria-label={`Mark "${item.text}" ${item.done ? "not done" : "done"}`}
          className="mt-0.5 size-4 accent-[oklch(0.53_0.145_42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <div className="min-w-0 flex-1">
          {/* Done items stay put — struck through, never removed (Mary's ask). */}
          <p className={cn("text-sm leading-snug", item.done && "line-through")}>{item.text}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <PriorityDot priority={item.priority} />
            {item.owner ? <span>{item.owner}</span> : null}
            {clientName && color ? <ClientChip name={clientName} color={color} /> : null}
            <DueBadge iso={item.dueDate} done={item.done} />
            {item.noteId && item.noteTitle ? (
              <Link
                to="/notes/$noteId"
                params={{ noteId: item.noteId }}
                className="truncate rounded hover:text-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {item.noteTitle}
              </Link>
            ) : null}
          </div>
        </div>
        {!readOnly ? (
          <button
            onClick={() => onDelete(item)}
            aria-label={`Delete "${item.text}"`}
            className="mt-0.5 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 group-hover:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* Subtasks sit under their parent, indented, each with its own due date. */}
      {subs.length ? (
        <div className="ml-6 grid gap-2 border-l border-hairline pl-3">
          {subs.map((s) => (
            <TodoRow
              key={s.id}
              item={s}
              onToggle={onToggle}
              onDelete={onDelete}
              readOnly={readOnly}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

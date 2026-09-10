import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { dueBucket } from "@/lib/format";
import {
  ClientChip,
  DueBadge,
  EmptyState,
  PriorityDot,
  SectionTitle,
} from "@/components/lumen/primitives";
import { cn } from "@/lib/utils";
import type { ActionItem, Client, TagColor } from "@/lib/types";

const groups = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
] as const;

/**
 * Renders a to-do list. One source of truth for both the standalone To-do list page and the
 * per-client To-do tab (Mary's "dual placement" — same items, two places to find them).
 */
export function TodoList({
  items,
  clients,
  canEdit,
  onToggle,
  onDelete,
  onAssign,
  showUnassigned = false,
  emptyTitle = "Nothing on the list",
  emptyBody = "Add a to-do above, or record a meeting and Lumen will pull the commitments out for you.",
}: {
  items: ActionItem[];
  clients: Client[];
  canEdit: boolean;
  onToggle: (item: ActionItem) => void;
  onDelete: (item: ActionItem) => void;
  onAssign?: ((item: ActionItem, clientId: string) => void) | undefined;
  /** Show the Unassigned column (standalone page only — a client tab is already scoped). */
  showUnassigned?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const clientOf = (id?: string) => (id ? clients.find((c) => c.id === id) : undefined);

  // Top-level to-dos only — subtasks render nested under their parent, not as their own rows.
  const top = items.filter((a) => !a.parentId);
  const subsOf = (id: string) => items.filter((a) => a.parentId === id);
  const unassigned = items.filter((a) => !a.clientId && !a.done);
  const done = items.filter((a) => a.done);
  const openCount = items.filter((a) => !a.done).length;

  return (
    <div className={cn("grid gap-8", showUnassigned && "lg:grid-cols-4")}>
      <div className={cn("space-y-8", showUnassigned && "lg:col-span-3")}>
        {openCount === 0 && !done.length ? (
          <EmptyState title={emptyTitle} body={emptyBody} />
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
                    onToggle={onToggle}
                    onDelete={onDelete}
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
                  onToggle={onToggle}
                  onDelete={onDelete}
                  readOnly={!canEdit}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {showUnassigned ? (
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
                  {canEdit && onAssign ? (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) onAssign(a, e.target.value);
                      }}
                      aria-label={`File "${a.text}" under a client`}
                      className="h-9 w-full rounded-lg border border-hairline bg-surface px-2 text-xs outline-none focus:ring-2 focus:ring-ring/30"
                    >
                      <option value="">File under…</option>
                      {clients.map((c) => (
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
      ) : null}
    </div>
  );
}

export function TodoRow({
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
  color?: TagColor | undefined;
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

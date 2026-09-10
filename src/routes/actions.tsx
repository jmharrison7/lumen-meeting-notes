import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  createActionItem,
  deleteActionItem,
  listActionItems,
  listClients,
  updateActionItem,
} from "@/lib/api";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/lumen/primitives";
import { TodoList } from "@/components/lumen/TodoList";
import { useUi } from "@/lib/ui-store";
import { useAccess } from "@/lib/access-store";
import { useScope } from "@/lib/scope-store";
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

  /** File an unassigned to-do onto a client. */
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
        <TodoList
          items={filtered}
          clients={scopedClients}
          canEdit={canEdit}
          onToggle={(a) => void toggle(a)}
          onDelete={(a) => void removeTodo(a)}
          onAssign={(a, cid) => void assignTodo(a, cid)}
          showUnassigned
        />
      )}
    </div>
  );
}

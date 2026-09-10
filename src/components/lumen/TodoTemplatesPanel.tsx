import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  applyActionTemplate,
  createActionTemplate,
  deleteActionTemplate,
  listActionTemplates,
  listClients,
} from "@/lib/api";
import { relativeDate } from "@/lib/format";
import { EmptyState, ErrorState, SectionTitle } from "./primitives";

/**
 * To-do templates — "reusable to-do blocks for typical processes" (Josh, 2026-09-09).
 * Each task can carry `| N` to set its due date N days after the start date, so applying a
 * template schedules the whole process at once.
 */
function parseItems(raw: string): { text: string; offsetDays?: number }[] {
  const out: { text: string; offsetDays?: number }[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^(.*?)\s*\|\s*(\d+)\s*$/);
    if (m && m[1].trim()) out.push({ text: m[1].trim(), offsetDays: parseInt(m[2], 10) });
    else out.push({ text: t });
  }
  return out;
}

export function TodoTemplatesPanel() {
  const qc = useQueryClient();
  const templates = useQuery({ queryKey: ["actionTemplates"], queryFn: listActionTemplates });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [name, setName] = useState("");
  const [items, setItems] = useState("");
  const [pick, setPick] = useState<Record<string, { clientId: string; startDate: string }>>({});

  const refresh = () => void qc.invalidateQueries({ queryKey: ["actionTemplates"] });
  const parsed = parseItems(items);

  const create = useMutation({
    mutationFn: () => createActionTemplate({ name: name.trim(), items: parseItems(items) }),
    onSuccess: () => {
      setName("");
      setItems("");
      refresh();
      toast.success("Template saved");
    },
    onError: () => toast.error("Couldn't save that template"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteActionTemplate(id),
    onSuccess: () => {
      refresh();
      toast.success("Template deleted");
    },
    onError: () => toast.error("Couldn't delete that template"),
  });

  const apply = useMutation({
    mutationFn: (v: { id: string; clientId: string; startDate?: string | undefined }) =>
      applyActionTemplate(v.id, { clientId: v.clientId, startDate: v.startDate }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["actionItems"] });
      refresh();
      toast.success(`Added ${r.created} to-do${r.created === 1 ? "" : "s"}`);
    },
    onError: () => toast.error("Couldn't apply that template"),
  });

  const list = templates.data ?? [];

  return (
    <section className="space-y-4">
      <div>
        <SectionTitle>To-do templates</SectionTitle>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          A block of tasks you repeat. Applying one loads every task into a client's to-do list —
          add <span className="font-medium">| 3</span> to a task to set its due date 3 days in.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && parsed.length) create.mutate();
        }}
        className="space-y-3 rounded-xl border border-hairline bg-card p-4 shadow-soft"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name (e.g. Brand identity design)"
          aria-label="Template name"
          className="min-h-[44px] w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
        />
        <textarea
          value={items}
          onChange={(e) => setItems(e.target.value)}
          rows={4}
          placeholder={"Discovery call | 0\nMoodboard + direction | 3\nFinal brand system | 10"}
          aria-label="Template tasks, one per line"
          className="w-full rounded-lg border border-hairline bg-surface p-3 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!name.trim() || !parsed.length || create.isPending}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-ember px-3.5 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Save template
          </button>
          {parsed.length ? (
            <span className="text-xs text-muted-foreground">
              {parsed.length} task{parsed.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </form>

      {templates.isError ? (
        <ErrorState onRetry={() => void templates.refetch()} />
      ) : !list.length ? (
        <EmptyState
          title="No to-do templates yet"
          body="Save a set of tasks you repeat and Lumen will schedule the whole block for a client in one go."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((t) => {
            const sel = pick[t.id] ?? { clientId: "", startDate: "" };
            return (
              <div
                key={t.id}
                className="flex flex-col rounded-xl border border-hairline bg-card p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-title text-base font-semibold leading-snug">{t.name}</h3>
                  <button
                    onClick={() => remove.mutate(t.id)}
                    aria-label={`Delete ${t.name}`}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {t.items.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{i.text}</span>
                      {i.offsetDays !== undefined ? (
                        <span className="shrink-0 tabular-nums">+{i.offsetDays}d</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
                  <select
                    value={sel.clientId}
                    aria-label={`Client for ${t.name}`}
                    onChange={(e) =>
                      setPick((p) => ({ ...p, [t.id]: { ...sel, clientId: e.target.value } }))
                    }
                    className="h-9 min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-2 text-xs outline-none focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">Client…</option>
                    {(clients.data ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={sel.startDate}
                    aria-label={`Start date for ${t.name}`}
                    onChange={(e) =>
                      setPick((p) => ({ ...p, [t.id]: { ...sel, startDate: e.target.value } }))
                    }
                    className="h-9 rounded-lg border border-hairline bg-surface px-2 text-xs outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  <button
                    onClick={() => {
                      if (sel.clientId)
                        apply.mutate({
                          id: t.id,
                          clientId: sel.clientId,
                          startDate: sel.startDate || undefined,
                        });
                    }}
                    disabled={!sel.clientId || apply.isPending}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-hairline px-2.5 text-xs font-medium transition-colors hover:border-ember/40 hover:text-ember disabled:opacity-40"
                  >
                    <CalendarPlus className="size-3.5" /> Apply
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Saved {relativeDate(t.createdAtISO)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

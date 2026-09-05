import { actionItems, calendar, clientsWithStats, notes } from "./mock-data";
import type { ActionItem, CalendarEvent, Client, Note } from "./types";

/**
 * Thin client layer. When VITE_API_URL is set, every function talks HTTP.
 * Otherwise it resolves from mock data after a short simulated delay so the
 * loading skeletons stay honest. Swapping to the real backend is a one-file change.
 */
const BASE = import.meta.env["VITE_API_URL"] as string | undefined;

const delay = (ms = 320 + Math.random() * 160) => new Promise((r) => setTimeout(r, ms));

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as T;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export async function listNotes(): Promise<Note[]> {
  if (BASE) return http<Note[]>("/notes");
  await delay();
  return clone(notes);
}

export async function getNote(id: string): Promise<Note | null> {
  if (BASE) return http<Note | null>(`/notes/${id}`);
  await delay();
  return clone(notes.find((n) => n.id === id) ?? null);
}

export async function listClients(): Promise<Client[]> {
  if (BASE) return http<Client[]>("/clients");
  await delay(240);
  return clone(clientsWithStats());
}

export async function listActionItems(): Promise<ActionItem[]> {
  if (BASE) return http<ActionItem[]>("/action-items");
  await delay();
  return clone(actionItems);
}

export async function listTodayEvents(): Promise<CalendarEvent[]> {
  if (BASE) return http<CalendarEvent[]>("/calendar/today");
  await delay(260);
  return clone(calendar);
}

export async function searchNotes(q: string): Promise<Note[]> {
  if (BASE) return http<Note[]>(`/search?q=${encodeURIComponent(q)}`);
  await delay(200);
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const terms = needle.split(/\s+/);
  return clone(
    notes.filter((n) => {
      const hay = [
        n.title,
        n.summary,
        ...n.decisions,
        ...n.openQuestions,
        ...n.tags,
        ...n.actionItems.map((a) => a.text),
      ]
        .join(" ")
        .toLowerCase();
      return terms.every((t) => hay.includes(t));
    }),
  );
}

export async function updateActionItem(
  id: string,
  patch: Partial<Pick<ActionItem, "done" | "owner" | "dueDate" | "priority" | "syncedToTeamwork">>,
): Promise<ActionItem> {
  if (BASE)
    return http<ActionItem>(`/action-items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  await delay(160);
  const item = actionItems.find((a) => a.id === id);
  if (!item) throw new Error("Action item not found");
  Object.assign(item, patch);
  return clone(item);
}

export async function deleteNotes(ids: string[]): Promise<void> {
  if (BASE) {
    await http<void>("/notes/delete", { method: "POST", body: JSON.stringify({ ids }) });
    return;
  }
  await delay(200);
  for (const id of ids) {
    const i = notes.findIndex((n) => n.id === id);
    if (i >= 0) notes.splice(i, 1);
  }
}

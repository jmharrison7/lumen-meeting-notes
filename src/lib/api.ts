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

/* ---------------------------------- Live ---------------------------------- */

import { compileSegments, liveScript, liveSession } from "./live-mock";
import type {
  FollowUpDraft,
  FollowUpOptions,
  LiveSegment,
  LiveSession,
} from "./types";

let emitted: LiveSegment[] = [];
let lastEmit = 0;

function pump() {
  const now = Date.now();
  if (!lastEmit) lastEmit = now - 2600;
  while (emitted.length < liveScript.length && now - lastEmit >= 2500) {
    const item = liveScript[emitted.length]!;
    emitted.push({ ...item, id: `seg-${emitted.length + 1}`, atISO: new Date().toISOString() });
    lastEmit += 2500;
  }
}

function dueFrom(label?: string): string | undefined {
  if (!label) return undefined;
  const m = /in (\d+) day/.exec(label);
  const d = new Date();
  d.setDate(d.getDate() + (m ? Number(m[1]) : 3));
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

export async function getLiveSession(): Promise<LiveSession | null> {
  if (BASE) return http<LiveSession | null>("/live");
  await delay(220);
  if (liveSession.status === "ended") return null;
  pump();
  return clone({ ...liveSession, segments: emitted });
}

export async function getLiveUpdates(sessionId: string, sinceId?: string): Promise<LiveSegment[]> {
  if (BASE)
    return http<LiveSegment[]>(
      `/live/${sessionId}/updates${sinceId ? `?since=${encodeURIComponent(sinceId)}` : ""}`,
    );
  pump();
  const i = sinceId ? emitted.findIndex((s) => s.id === sinceId) : -1;
  return clone(emitted.slice(i + 1));
}

export async function endLiveSession(sessionId: string): Promise<Note> {
  if (BASE) return http<Note>(`/live/${sessionId}/end`, { method: "POST" });
  await delay(700);
  pump();
  const { summary, decisions, actions, transcript, openQuestions } = compileSegments(emitted);
  const noteId = `n-live-${Date.now()}`;
  const started = new Date(liveSession.startedAtISO);
  const note: Note = {
    id: noteId,
    title: liveSession.title,
    clientId: liveSession.clientId ?? "c-internal",
    date: liveSession.startedAtISO,
    durationMinutes: Math.max(1, Math.round((Date.now() - started.getTime()) / 60000)),
    attendees: liveSession.attendees,
    platform: liveSession.platform,
    summary,
    decisions,
    openQuestions,
    tags: ["campaign", "live capture"],
    transcript: transcript || "Transcript unavailable for this session.",
    reviewed: false,
    actionItems: actions.map((a, i) => ({
      id: `${noteId}-a${i + 1}`,
      noteId,
      noteTitle: liveSession.title,
      clientId: liveSession.clientId ?? "c-internal",
      text: a.text,
      owner: a.actionOwner ?? "Mary",
      dueDate: dueFrom(a.actionDue),
      priority: i === 0 ? "high" : "medium",
      done: false,
    })),
  };
  notes.unshift(note);
  actionItems.push(...note.actionItems);
  liveSession.status = "ended";
  return clone(note);
}

/* ------------------------------- Follow-up -------------------------------- */

const greetingFor = (n: Note) => {
  const guest = n.attendees.find((a) => !a.toLowerCase().includes("mary"));
  const first = guest?.split(" ")[0];
  return first ? `Hi ${first},` : "Hi team,";
};

function fmtDue(iso?: string) {
  return iso
    ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";
}

export async function draftFollowUp(
  noteId: string,
  options: FollowUpOptions,
): Promise<FollowUpDraft> {
  if (BASE)
    return http<FollowUpDraft>(`/notes/${noteId}/follow-up`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  await delay(420);
  const note = notes.find((n) => n.id === noteId);
  if (!note) throw new Error("Note not found");

  const openItems = note.actionItems.filter((a) => !a.done);
  const subject =
    options.tone === "concise"
      ? `Recap: ${note.title}`
      : `${note.title} — recap and next steps`;

  const opener =
    options.tone === "warm"
      ? `Thank you for the time today — a genuinely useful conversation. Here's a short recap so we're all holding the same picture.`
      : options.tone === "professional"
        ? `Thank you for your time today. Below is a summary of what we covered and the next steps we agreed.`
        : `Quick recap of today's call and what happens next.`;

  const md: string[] = [greetingFor(note), "", opener, "", note.summary];

  if (note.decisions.length) {
    md.push("", "**What we decided**", ...note.decisions.map((d) => `- ${d}`));
  }
  if (options.includeActionItems && openItems.length) {
    md.push(
      "",
      "**Next steps**",
      ...openItems.map(
        (a) => `- ${a.text} — ${a.owner}${a.dueDate ? ` (by ${fmtDue(a.dueDate)})` : ""}`,
      ),
    );
  }
  if (options.includeQuestions && note.openQuestions.length) {
    md.push(
      "",
      "**A couple of open questions**",
      ...note.openQuestions.map((q) => `- ${q}`),
    );
  }
  md.push(
    "",
    options.tone === "concise"
      ? "Shout if anything looks off."
      : "If anything above reads differently to how you remember it, tell me and I'll correct the record.",
    "",
    "Best,",
    "Mary",
  );

  const bodyMarkdown = md.join("\n");
  const bodyText = bodyMarkdown.replace(/\*\*/g, "").replace(/^- /gm, "• ");
  return { subject, bodyMarkdown, bodyText };
}

/* ------------------------------ Files & templates ------------------------------ */

import { clientFiles, templates } from "./files-mock";
import type { ClientFile, DocKind, Template, TemplateKind } from "./types";

function kindFromUrl(url: string): DocKind {
  if (url.includes("/presentation/")) return "slides";
  if (url.includes("/spreadsheets/")) return "sheets";
  if (url.includes("/document/")) return "docs";
  return "file";
}

export async function listClientFiles(clientId: string): Promise<ClientFile[]> {
  if (BASE) return http<ClientFile[]>(`/clients/${clientId}/files`);
  await delay(280);
  return clone(
    clientFiles
      .filter((f) => f.clientId === clientId)
      .sort((a, b) => (b.modifiedAtISO ?? b.createdAtISO).localeCompare(a.modifiedAtISO ?? a.createdAtISO)),
  );
}

export async function addDriveLink(
  clientId: string,
  input: { url: string; label: string },
): Promise<ClientFile> {
  if (BASE)
    return http<ClientFile>(`/clients/${clientId}/files/drive`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  await delay(240);
  const file: ClientFile = {
    id: `f-${Date.now()}`,
    clientId,
    kind: kindFromUrl(input.url),
    name: input.label || "Untitled Drive doc",
    source: "drive",
    url: input.url,
    tags: [],
    createdAtISO: new Date().toISOString(),
    modifiedAtISO: new Date().toISOString(),
  };
  clientFiles.unshift(file);
  return clone(file);
}

export async function registerUpload(
  clientId: string,
  input: { name: string; size: number; mime: string },
): Promise<ClientFile> {
  if (BASE)
    return http<ClientFile>(`/clients/${clientId}/files/upload`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  await delay(500);
  const file: ClientFile = {
    id: `f-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    clientId,
    kind: "file",
    name: input.name,
    source: "upload",
    mime: input.mime,
    sizeBytes: input.size,
    tags: [],
    createdAtISO: new Date().toISOString(),
  };
  clientFiles.unshift(file);
  return clone(file);
}

export async function updateClientFile(
  id: string,
  patch: Partial<Pick<ClientFile, "label" | "tags" | "name">>,
): Promise<ClientFile> {
  if (BASE)
    return http<ClientFile>(`/files/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  await delay(140);
  const file = clientFiles.find((f) => f.id === id);
  if (!file) throw new Error("File not found");
  Object.assign(file, patch);
  return clone(file);
}

export async function deleteClientFile(id: string): Promise<void> {
  if (BASE) {
    await http<void>(`/files/${id}`, { method: "DELETE" });
    return;
  }
  await delay(180);
  const i = clientFiles.findIndex((f) => f.id === id);
  if (i >= 0) clientFiles.splice(i, 1);
}

export async function listTemplates(clientId?: string): Promise<Template[]> {
  if (BASE)
    return http<Template[]>(`/templates${clientId ? `?client=${encodeURIComponent(clientId)}` : ""}`);
  await delay(260);
  const rows = clientId ? templates.filter((t) => t.clientId === clientId) : templates;
  return clone([...rows].sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO)));
}

export async function registerTemplate(input: {
  name: string;
  kind: TemplateKind;
  source: "upload" | "drive";
  clientId?: string | undefined;
  url?: string | undefined;
  sizeBytes?: number | undefined;
}): Promise<Template> {
  if (BASE) return http<Template>("/templates", { method: "POST", body: JSON.stringify(input) });
  await delay(380);
  const t: Template = {
    id: `t-${Date.now()}`,
    name: input.name,
    kind: input.kind,
    source: input.source,
    clientId: input.clientId,
    url: input.url,
    sizeBytes: input.sizeBytes,
    createdAtISO: new Date().toISOString(),
  };
  templates.unshift(t);
  return clone(t);
}

export async function deleteTemplate(id: string): Promise<void> {
  if (BASE) {
    await http<void>(`/templates/${id}`, { method: "DELETE" });
    return;
  }
  await delay(180);
  const i = templates.findIndex((t) => t.id === id);
  if (i >= 0) templates.splice(i, 1);
}

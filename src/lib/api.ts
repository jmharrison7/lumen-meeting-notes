import { actionItems, calendar, clientsWithStats, notes } from "./mock-data";
import type { ActionItem, CalendarEvent, Client, Note, TagColor } from "./types";

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
  return clone([...clientsWithStats(), ...ensureCustomClients()]);
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

/* --------------------------------- Alerts -------------------------------- */

import {
  clientConfigs,
  defaultGlobalConfig,
  globalConfig,
  setGlobalConfig,
  TOPIC_PHRASES,
} from "./alerts-mock";
import type { ClientAlertConfig, GlobalAlertConfig, MentionHit } from "./types";

const ALERT_KEY = "lumen.alerts.v1";

function loadAlerts() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(ALERT_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      global?: GlobalAlertConfig;
      clients?: Record<string, ClientAlertConfig>;
    };
    if (parsed.global) setGlobalConfig(parsed.global);
    if (parsed.clients) Object.assign(clientConfigs, parsed.clients);
  } catch {
    /* ignore malformed storage */
  }
}

function persistAlerts() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    ALERT_KEY,
    JSON.stringify({ global: globalConfig, clients: clientConfigs }),
  );
}

let alertsLoaded = false;
function ensureAlerts() {
  if (!alertsLoaded) {
    loadAlerts();
    alertsLoaded = true;
  }
}

export async function getAlertConfig(): Promise<GlobalAlertConfig> {
  if (BASE) return http<GlobalAlertConfig>("/alerts");
  await delay(200);
  ensureAlerts();
  return clone(globalConfig);
}

export async function saveAlertConfig(cfg: GlobalAlertConfig): Promise<GlobalAlertConfig> {
  if (BASE) return http<GlobalAlertConfig>("/alerts", { method: "PUT", body: JSON.stringify(cfg) });
  await delay(140);
  setGlobalConfig(clone(cfg));
  persistAlerts();
  return clone(cfg);
}

export async function resetAlertConfig(): Promise<GlobalAlertConfig> {
  return saveAlertConfig(defaultGlobalConfig());
}

export async function getClientAlertConfig(clientId: string): Promise<ClientAlertConfig> {
  if (BASE) return http<ClientAlertConfig>(`/alerts/clients/${clientId}`);
  await delay(180);
  ensureAlerts();
  return clone(clientConfigs[clientId] ?? { clientId, inheritGlobal: true, rules: [] });
}

export async function saveClientAlertConfig(
  clientId: string,
  cfg: ClientAlertConfig,
): Promise<ClientAlertConfig> {
  if (BASE)
    return http<ClientAlertConfig>(`/alerts/clients/${clientId}`, {
      method: "PUT",
      body: JSON.stringify(cfg),
    });
  await delay(140);
  clientConfigs[clientId] = clone(cfg);
  persistAlerts();
  return clone(cfg);
}

function snippetAround(text: string, index: number, len: number) {
  const start = Math.max(0, index - 70);
  const end = Math.min(text.length, index + len + 70);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function timestampNear(text: string, index: number): number | undefined {
  const before = text.slice(Math.max(0, index - 400), index);
  const matches = [...before.matchAll(/\((\d{1,2}):(\d{2})\)/g)];
  const last = matches[matches.length - 1];
  if (!last) return undefined;
  return Number(last[1]) * 60 + Number(last[2]);
}

export async function getMentionHits(noteId: string): Promise<MentionHit[]> {
  if (BASE) return http<MentionHit[]>(`/notes/${noteId}/mentions`);
  ensureAlerts();
  const note = notes.find((n) => n.id === noteId);
  if (!note) return [];
  const client = clientConfigs[note.clientId];
  const rules = [
    ...(client && !client.inheritGlobal ? [] : globalConfig.rules),
    ...(client?.rules ?? []),
  ].filter((r) => r.enabled);

  const haystack = [note.summary, ...note.decisions, ...note.openQuestions, note.transcript].join(
    "\n",
  );
  const lower = haystack.toLowerCase();
  const hits: MentionHit[] = [];

  for (const rule of rules) {
    const i = lower.indexOf(rule.term.toLowerCase());
    if (i >= 0)
      hits.push({
        term: rule.term,
        snippet: snippetAround(haystack, i, rule.term.length),
        atSeconds: timestampNear(haystack, i),
      });
  }

  if (globalConfig.topics.enabled) {
    for (const topic of globalConfig.topics.topics.filter((t) => t.enabled)) {
      for (const phrase of TOPIC_PHRASES[topic.key] ?? []) {
        const i = lower.indexOf(phrase);
        if (i >= 0) {
          hits.push({
            term: topic.label,
            topic: topic.key,
            snippet: snippetAround(haystack, i, phrase.length),
            atSeconds: timestampNear(haystack, i),
          });
          break;
        }
      }
    }
  }
  return hits;
}

import { clients as allClients } from "./mock-data";
import { clock, formatDate, parseTranscriptLines } from "./format";
import type { AskReply, AskSource, ShareChannel, ShareResult } from "./types";

/* ------------------------------------------------------------------ *
 * Timestamped playback
 * ------------------------------------------------------------------ */

export async function getPlaybackUrl(
  noteId: string,
  atSeconds: number,
): Promise<{ url: string; durationSeconds: number }> {
  if (BASE)
    return http<{ url: string; durationSeconds: number }>(
      `/notes/${noteId}/audio?t=${Math.round(atSeconds)}`,
    );
  await delay(180);
  const note = notes.find((n) => n.id === noteId);
  return { url: "", durationSeconds: note?.audio?.durationSeconds ?? 2700 };
}

/* ------------------------------------------------------------------ *
 * Ask Lumen — scripted, grounded answers over real mock content
 * ------------------------------------------------------------------ */

function noteSource(note: Note, snippet: string): AskSource {
  return {
    kind: "note",
    label: `Notes · ${formatDate(note.date)}`,
    snippet,
    link: note.id,
  };
}

function transcriptSource(note: Note, atSeconds: number, snippet: string): AskSource {
  return {
    kind: "transcript",
    label: `Transcript @ ${clock(atSeconds)}`,
    snippet,
    link: `note:${note.id}@t=${Math.round(atSeconds)}`,
  };
}

export async function askLumen(
  scope: { clientId?: string | undefined; noteId?: string | undefined },
  question: string,
): Promise<AskReply> {
  if (BASE)
    return http<AskReply>("/ask", {
      method: "POST",
      body: JSON.stringify({ ...scope, question }),
    });

  await delay(800 + Math.random() * 700);

  const scoped = scope.noteId
    ? notes.filter((n) => n.id === scope.noteId)
    : scope.clientId
      ? notes.filter((n) => n.clientId === scope.clientId)
      : notes;
  const sorted = [...scoped].sort((a, b) => b.date.localeCompare(a.date));
  const files = scope.clientId ? clientFiles.filter((f) => f.clientId === scope.clientId) : [];
  const clientName =
    allClients.find((c) => c.id === (scope.clientId ?? sorted[0]?.clientId))?.name ?? "this account";

  if (sorted.length === 0)
    return {
      answer: `I don't have any captured meetings for ${clientName} yet, so there's nothing for me to read. Once Lumen records a call — or you add files to the client's Files tab — I can answer properly.`,
      sources: [],
    };

  const q = question.toLowerCase();
  const sources: AskSource[] = [];
  let answer = "";

  const money = /pric|cost|budget|quote|rate|fee|spend|estimate/.test(q);
  const open = /open|outstanding|owe|owed|pending|todo|to do|next|action/.test(q);
  const brand = /brand|guideline|deck|file|document|template/.test(q);
  const decided = /decide|decision|agree|agreed|sign(ed)? off/.test(q);
  const summarise = /summar|recap|catch me up|overview|what happened/.test(q);

  if (money) {
    const hit = sorted.find((n) =>
      [n.summary, ...n.decisions, ...n.openQuestions].some((t) => /cost|price|budget|cent|spend|rate/i.test(t)),
    );
    if (hit) {
      const line =
        [...hit.decisions, ...hit.openQuestions, hit.summary].find((t) =>
          /cost|price|budget|cent|spend|rate/i.test(t),
        ) ?? hit.summary;
      answer = `On money, the clearest thing in the notes is from ${hit.title} (${formatDate(hit.date)}): "${line}" Nothing in the record suggests a final number was signed off beyond that — I'd treat it as agreed in principle, not contracted.`;
      sources.push(noteSource(hit, line));
      const tline = parseTranscriptLines(hit.transcript).find((l) => /cost|cent|price|budget/i.test(l.text));
      if (tline) sources.push(transcriptSource(hit, tline.atSeconds, `${tline.speaker}: ${tline.text}`));
    } else {
      answer = `I don't see a pricing conversation for ${clientName} in the notes I have. If it happened over email, it never reached Lumen.`;
    }
  } else if (open) {
    const items = sorted.flatMap((n) => n.actionItems.filter((a) => !a.done).map((a) => ({ n, a })));
    if (items.length) {
      const top = items.slice(0, 4);
      answer = `${top.length} thing${top.length === 1 ? "" : "s"} still open for ${clientName}:\n\n${top
        .map((t) => `• ${t.a.text} — ${t.a.owner}${t.a.dueDate ? `, due ${formatDate(t.a.dueDate)}` : ""}`)
        .join("\n")}`;
      for (const t of top.slice(0, 2)) sources.push(noteSource(t.n, t.a.text));
    } else {
      answer = `Nothing is open for ${clientName} — every action item from the captured meetings is ticked off.`;
    }
  } else if (brand && files.length) {
    const f = files[0]!;
    answer = `${clientName} has ${files.length} document${files.length === 1 ? "" : "s"} on file. The one I'd start with is "${f.name}"${f.label ? ` — ${f.label}` : ""}. I can't read inside linked Drive docs yet, so treat this as a pointer rather than a summary.`;
    sources.push({
      kind: "file",
      label: f.name,
      snippet: f.label ?? `${f.source === "drive" ? "Linked Drive document" : "Uploaded file"} · ${f.tags.join(", ") || "no tags"}`,
      link: f.id,
    });
  } else if (decided) {
    const withDecisions = sorted.filter((n) => n.decisions.length).slice(0, 2);
    if (withDecisions.length) {
      answer = `Decisions on record for ${clientName}:\n\n${withDecisions
        .map((n) => `${formatDate(n.date)} — ${n.decisions.map((d) => `• ${d}`).join("\n")}`)
        .join("\n\n")}`;
      for (const n of withDecisions) sources.push(noteSource(n, n.decisions[0] as string));
    } else {
      answer = `No firm decisions are recorded for ${clientName} yet.`;
    }
  } else if (summarise) {
    const latest = sorted[0]!;
    answer = `Most recent was ${latest.title} on ${formatDate(latest.date)}. ${latest.summary}`;
    sources.push(noteSource(latest, latest.summary));
  } else {
    const terms = q.split(/\s+/).filter((t) => t.length > 3);
    let found: { note: Note; line: string } | null = null;
    for (const n of sorted) {
      const line = [n.summary, ...n.decisions, ...n.openQuestions, ...n.actionItems.map((a) => a.text)].find(
        (t) => terms.some((term) => t.toLowerCase().includes(term)),
      );
      if (line) {
        found = { note: n, line };
        break;
      }
    }
    if (found) {
      answer = `Closest thing I can find is in ${found.note.title} (${formatDate(found.note.date)}): "${found.line}" That's what the notes actually say — anything beyond it would be me guessing.`;
      sources.push(noteSource(found.note, found.line));
    } else {
      answer = `I don't see that in the notes for ${clientName}. The last ${Math.min(sorted.length, 3)} meetings covered ${sorted
        .slice(0, 3)
        .map((n) => n.title.split("—").pop()?.trim())
        .join(", ")} — happy to dig into any of those.`;
      const latest = sorted[0]!;
      sources.push(noteSource(latest, latest.summary));
    }
  }

  return { answer, sources: sources.slice(0, 3) };
}

export function suggestedQuestions(scope: { clientId?: string | undefined; noteId?: string | undefined }): string[] {
  if (scope.noteId)
    return [
      "What did we decide in this meeting?",
      "What's still open from this call?",
      "Was pricing discussed?",
      "Summarize this meeting in two lines",
    ];
  return [
    "What did we agree on pricing?",
    "What's open from our last meeting?",
    "What decisions have we made?",
    "What files do we have for them?",
  ];
}

/* ------------------------------------------------------------------ *
 * Share recap
 * ------------------------------------------------------------------ */

export function buildRecap(note: Note, clientName: string): { subject: string; body: string } {
  const openItems = note.actionItems.filter((a) => !a.done);
  const parts: string[] = [];
  parts.push(`Hi all,`);
  parts.push(`Quick record of ${note.title.split("—").pop()?.trim() ?? note.title} on ${formatDate(note.date)}.`);
  parts.push(note.summary);
  if (note.decisions.length)
    parts.push(`What we decided:\n${note.decisions.map((d) => `• ${d}`).join("\n")}`);
  if (openItems.length)
    parts.push(
      `Who owns what:\n${openItems
        .map((a) => `• ${a.text} — ${a.owner}${a.dueDate ? ` (${formatDate(a.dueDate)})` : ""}`)
        .join("\n")}`,
    );
  parts.push(`Questions? Happy to go deeper.\n\nMary`);
  return {
    subject: `Recap: ${note.title.replace(/\s*—\s*/, " ").trim()} — ${formatDate(note.date)}`,
    body: parts.join("\n\n"),
  };
}

export async function shareRecap(
  noteId: string,
  opts: { recipients: string[]; includeTeam: boolean; channel: ShareChannel },
): Promise<ShareResult> {
  if (BASE)
    return http<ShareResult>(`/notes/${noteId}/recap`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
  await delay(900);
  const note = notes.find((n) => n.id === noteId);
  if (!note) throw new Error("Note not found");
  const clientName = allClients.find((c) => c.id === note.clientId)?.name ?? "Client";
  const recap = buildRecap(note, clientName);
  const to = [...opts.recipients, ...(opts.includeTeam ? ["studio@lumen.work"] : [])];
  if (opts.channel === "link")
    return { channel: "link", link: `/shared/${noteId.replace(/\W/g, "")}${Date.now().toString(36).slice(-5)}` };
  if (opts.channel === "text") return { channel: "text", text: `${recap.subject}\n\n${recap.body}` };
  return { channel: "email", sentTo: to };
}

/* ------------------------------ Ideas & DNA ------------------------------ */

import { nextMockTranscript, seedBrandDna, seedIdeas, suggestTitle } from "./ideas-mock";
import type { BrandDNA, Idea } from "./types";

const IDEAS_KEY = "lumen.ideas.v1";
const DNA_KEY = "lumen.branddna.v1";

let ideasStore: Idea[] | null = null;
let dnaStore: Record<string, BrandDNA> | null = null;

function ensureIdeas(): Idea[] {
  if (ideasStore) return ideasStore;
  ideasStore = clone(seedIdeas);
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(IDEAS_KEY);
      if (raw) ideasStore = JSON.parse(raw) as Idea[];
    } catch {
      /* ignore malformed storage */
    }
  }
  return ideasStore;
}

function persistIdeas() {
  if (typeof window === "undefined" || !ideasStore) return;
  window.localStorage.setItem(IDEAS_KEY, JSON.stringify(ideasStore));
}

function ensureDna(): Record<string, BrandDNA> {
  if (dnaStore) return dnaStore;
  dnaStore = clone(seedBrandDna);
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(DNA_KEY);
      if (raw) dnaStore = { ...dnaStore, ...(JSON.parse(raw) as Record<string, BrandDNA>) };
    } catch {
      /* ignore malformed storage */
    }
  }
  return dnaStore;
}

function persistDna() {
  if (typeof window === "undefined" || !dnaStore) return;
  window.localStorage.setItem(DNA_KEY, JSON.stringify(dnaStore));
}

export async function listIdeas(): Promise<Idea[]> {
  if (BASE) return http<Idea[]>("/ideas");
  await delay(260);
  return clone(ensureIdeas()).sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO));
}

export async function getIdea(id: string): Promise<Idea | null> {
  if (BASE) return http<Idea | null>(`/ideas/${id}`);
  await delay(220);
  return clone(ensureIdeas().find((i) => i.id === id) ?? null);
}

export async function createIdea(
  input: Omit<Idea, "id" | "createdAtISO"> & {
    createdAtISO?: string;
    createClient?: { name: string; note?: string };
  },
): Promise<Idea> {
  if (BASE) return http<Idea>("/ideas", { method: "POST", body: JSON.stringify(input) });
  await delay(320);
  const { createClient: newClient, ...rest } = input;
  let clientId = rest.clientId;
  if (newClient?.name.trim()) {
    const created = await createClient(newClient);
    clientId = created.id;
  }
  const idea: Idea = {
    ...rest,
    clientId,
    id: `i-${Date.now().toString(36)}`,
    createdAtISO: input.createdAtISO ?? new Date().toISOString(),
  };
  ensureIdeas().unshift(idea);
  persistIdeas();
  return clone(idea);
}

export async function updateIdea(id: string, patch: Partial<Idea>): Promise<Idea> {
  if (BASE) return http<Idea>(`/ideas/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  await delay(200);
  const list = ensureIdeas();
  const idx = list.findIndex((i) => i.id === id);
  if (idx < 0) throw new Error("Idea not found");
  list[idx] = { ...list[idx]!, ...patch };
  persistIdeas();
  return clone(list[idx]!);
}

export async function deleteIdea(id: string): Promise<void> {
  if (BASE) {
    await http<void>(`/ideas/${id}`, { method: "DELETE" });
    return;
  }
  await delay(180);
  ideasStore = ensureIdeas().filter((i) => i.id !== id);
  persistIdeas();
}

export async function transcribeAudio(
  file: File | Blob,
): Promise<{ transcript: string; durationSeconds?: number }> {
  if (BASE) {
    const form = new FormData();
    form.append("audio", file, file instanceof File ? file.name : "recording.webm");
    const res = await fetch(`${BASE}/transcribe`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Transcription failed: ${res.status}`);
    return (await res.json()) as { transcript: string; durationSeconds?: number };
  }
  await delay(1200);
  return nextMockTranscript();
}

export function titleFromTranscript(transcript: string) {
  return suggestTitle(transcript);
}

export async function getBrandDNA(clientId: string): Promise<BrandDNA> {
  if (BASE) return http<BrandDNA>(`/clients/${clientId}/brand-dna`);
  await delay(240);
  const store = ensureDna();
  return clone(
    store[clientId] ?? {
      clientId,
      voice: [],
      always: [],
      never: [],
      tone: "",
      updatedAtISO: new Date().toISOString(),
    },
  );
}

export async function saveBrandDNA(clientId: string, dna: BrandDNA): Promise<BrandDNA> {
  if (BASE)
    return http<BrandDNA>(`/clients/${clientId}/brand-dna`, {
      method: "PUT",
      body: JSON.stringify(dna),
    });
  await delay(280);
  const next: BrandDNA = { ...clone(dna), clientId, updatedAtISO: new Date().toISOString() };
  ensureDna()[clientId] = next;
  persistDna();
  return clone(next);
}

/* --------------------- Client creation & idea routing -------------------- */

const CUSTOM_CLIENTS_KEY = "lumen.clients.v1";
const palette: TagColor[] = ["ember", "forest", "plum", "ocean", "sand", "slate"];

let customClients: Client[] | null = null;

function ensureCustomClients(): Client[] {
  if (customClients) return customClients;
  customClients = [];
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(CUSTOM_CLIENTS_KEY);
      if (raw) customClients = JSON.parse(raw) as Client[];
    } catch {
      /* ignore malformed storage */
    }
  }
  return customClients;
}

function persistCustomClients() {
  if (typeof window === "undefined" || !customClients) return;
  window.localStorage.setItem(CUSTOM_CLIENTS_KEY, JSON.stringify(customClients));
}

export async function createClient(input: { name: string; note?: string }): Promise<Client> {
  if (BASE) return http<Client>("/clients", { method: "POST", body: JSON.stringify(input) });
  await delay(280);
  const list = ensureCustomClients();
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
  const client: Client = {
    id: `c-${slug}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim(),
    tagColor: palette[(clientsWithStats().length + list.length) % palette.length] as TagColor,
    meetingsThisMonth: 0,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
  list.push(client);
  persistCustomClients();
  return clone(client);
}

const projectWords = ["launch", "brand", "pitch", "site for", "campaign", "rebrand", "identity"];

function tokens(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

export async function suggestClientForIdea(
  ideaId: string,
): Promise<{ clientId?: string; reason: string } | null> {
  if (BASE) return http<{ clientId?: string; reason: string } | null>(`/ideas/${ideaId}/suggest-client`);
  await delay(420);
  const idea = ensureIdeas().find((i) => i.id === ideaId);
  if (!idea || idea.clientId) return null;

  const haystack = tokens(`${idea.title} ${idea.transcript} ${idea.tags.join(" ")}`);
  const dna = ensureDna();
  let best: { clientId: string; score: number; hit: string; name: string } | null = null;

  for (const c of [...clientsWithStats(), ...ensureCustomClients()]) {
    const candidate = [...tokens(c.name), ...(dna[c.id]?.voice ?? []).flatMap((v) => [...tokens(v)])];
    let score = 0;
    let hit = "";
    for (const word of candidate) {
      if (haystack.has(word)) {
        score += 1;
        if (!hit) hit = word;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { clientId: c.id, score, hit, name: c.name };
    }
  }

  if (best && best.score >= 1) {
    return { clientId: best.clientId, reason: `mentions “${best.hit}”` };
  }

  const lower = `${idea.title} ${idea.transcript}`.toLowerCase();
  const projectWord = projectWords.find((w) => lower.includes(w));
  if (projectWord) {
    return { reason: `it mentions “${projectWord}”` };
  }
  return null;
}

import { seedCollaborators, seedShareLinks } from "./access-mock";
import type { Collaborator, CollaboratorRole, ShareLink, ShareTarget } from "./types";

/* ------------------------------ Sharing & access ----------------------------- */

const COLLAB_KEY = "lumen.collaborators.v1";
const LINKS_KEY = "lumen.sharelinks.v1";

let collabs: Collaborator[] | null = null;
let links: ShareLink[] | null = null;

function ensureCollabs(): Collaborator[] {
  if (collabs) return collabs;
  collabs = clone(seedCollaborators);
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(COLLAB_KEY);
      if (raw) collabs = JSON.parse(raw) as Collaborator[];
    } catch {
      /* ignore malformed storage */
    }
  }
  return collabs;
}

function persistCollabs() {
  if (typeof window === "undefined" || !collabs) return;
  window.localStorage.setItem(COLLAB_KEY, JSON.stringify(collabs));
}

function ensureLinks(): ShareLink[] {
  if (links) return links;
  links = clone(seedShareLinks);
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(LINKS_KEY);
      if (raw) links = JSON.parse(raw) as ShareLink[];
    } catch {
      /* ignore malformed storage */
    }
  }
  return links;
}

function persistLinks() {
  if (typeof window === "undefined" || !links) return;
  window.localStorage.setItem(LINKS_KEY, JSON.stringify(links));
}

export async function listCollaborators(): Promise<Collaborator[]> {
  if (BASE) return http<Collaborator[]>("/collaborators");
  await delay(240);
  return clone(ensureCollabs());
}

export async function inviteCollaborator(input: {
  email: string;
  name?: string;
  role: CollaboratorRole;
  clientIds: string[];
}): Promise<Collaborator> {
  if (BASE)
    return http<Collaborator>("/collaborators", { method: "POST", body: JSON.stringify(input) });
  await delay(320);
  const list = ensureCollabs();
  const email = input.email.trim().toLowerCase();
  const existing = list.find((c) => c.email.toLowerCase() === email);
  if (existing) {
    existing.clientIds = [...new Set([...existing.clientIds, ...input.clientIds])];
    existing.role = input.role;
    persistCollabs();
    return clone(existing);
  }
  const person: Collaborator = {
    id: `col-${Math.random().toString(36).slice(2, 8)}`,
    email,
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    role: input.role,
    clientIds: [...input.clientIds],
    status: "invited",
    invitedAtISO: new Date().toISOString(),
  };
  list.push(person);
  persistCollabs();
  return clone(person);
}

export async function updateCollaboratorAccess(
  collabId: string,
  patch: { role?: CollaboratorRole; clientIds?: string[] },
): Promise<Collaborator | null> {
  if (BASE)
    return http<Collaborator>(`/collaborators/${collabId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  await delay(240);
  const person = ensureCollabs().find((c) => c.id === collabId);
  if (!person) return null;
  if (patch.role) person.role = patch.role;
  if (patch.clientIds) person.clientIds = [...patch.clientIds];
  persistCollabs();
  return clone(person);
}

export async function removeCollaboratorFromClient(
  collabId: string,
  clientId: string,
): Promise<Collaborator | null> {
  if (BASE)
    return http<Collaborator>(`/collaborators/${collabId}/clients/${clientId}`, {
      method: "DELETE",
    });
  await delay(220);
  const person = ensureCollabs().find((c) => c.id === collabId);
  if (!person) return null;
  person.clientIds = person.clientIds.filter((id) => id !== clientId);
  persistCollabs();
  return clone(person);
}

export async function removeCollaborator(collabId: string): Promise<void> {
  if (BASE) {
    await http<void>(`/collaborators/${collabId}`, { method: "DELETE" });
    return;
  }
  await delay(220);
  collabs = ensureCollabs().filter((c) => c.id !== collabId);
  persistCollabs();
}

export async function listShareLinks(): Promise<ShareLink[]> {
  if (BASE) return http<ShareLink[]>("/share-links");
  await delay(240);
  return clone(ensureLinks());
}

export async function createShareLink(input: {
  target: ShareTarget;
  label: string;
  permission: "view" | "edit";
  expiresInDays?: number | undefined;
}): Promise<ShareLink> {
  if (BASE)
    return http<ShareLink>("/share-links", { method: "POST", body: JSON.stringify(input) });
  await delay(340);
  const link: ShareLink = {
    id: `sl-${Math.random().toString(36).slice(2, 8)}`,
    target: input.target,
    label: input.label,
    permission: input.permission,
    token: Math.random().toString(36).slice(2, 10),
    ...(input.expiresInDays
      ? { expiresAtISO: new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString() }
      : {}),
    revoked: false,
    createdAtISO: new Date().toISOString(),
  };
  ensureLinks().unshift(link);
  persistLinks();
  return clone(link);
}

export async function revokeShareLink(linkId: string): Promise<ShareLink | null> {
  if (BASE) return http<ShareLink>(`/share-links/${linkId}/revoke`, { method: "POST" });
  await delay(220);
  const link = ensureLinks().find((l) => l.id === linkId);
  if (!link) return null;
  link.revoked = true;
  persistLinks();
  return clone(link);
}

/* --------------------------------- Contacts --------------------------------- */

import { seedContacts } from "./contacts-mock";
import type { Contact, ContactRole } from "./types";

const CONTACTS_KEY = "lumen.contacts.v1";
const DISMISSED_KEY = "lumen.contacts.dismissed.v1";

let contacts: Contact[] | null = null;

function ensureContacts(): Contact[] {
  if (contacts) return contacts;
  contacts = clone(seedContacts);
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(CONTACTS_KEY);
      if (raw) contacts = JSON.parse(raw) as Contact[];
    } catch {
      /* ignore malformed storage */
    }
  }
  return contacts;
}

function persistContacts() {
  if (typeof window === "undefined" || !contacts) return;
  window.localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

export function dismissedSuggestions(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function dismissSuggestion(name: string) {
  if (typeof window === "undefined") return;
  const next = [...new Set([...dismissedSuggestions(), name])];
  window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
}

export async function listContacts(clientId?: string): Promise<Contact[]> {
  if (BASE)
    return http<Contact[]>(`/contacts${clientId ? `?client=${encodeURIComponent(clientId)}` : ""}`);
  await delay(150);
  const rows = ensureContacts();
  const filtered = clientId ? rows.filter((c) => c.clientId === clientId) : rows;
  return clone([...filtered].sort((a, b) => a.name.localeCompare(b.name)));
}

export async function searchContacts(q: string, clientId?: string): Promise<Contact[]> {
  if (BASE)
    return http<Contact[]>(
      `/contacts/search?q=${encodeURIComponent(q)}${clientId ? `&client=${encodeURIComponent(clientId)}` : ""}`,
    );
  await delay(150);
  const needle = q.trim().toLowerCase();
  const rows = ensureContacts().filter(
    (c) =>
      !needle ||
      c.name.toLowerCase().includes(needle) ||
      c.email.toLowerCase().includes(needle),
  );
  const rank = (c: Contact) => (clientId && c.clientId === clientId ? 0 : 1);
  return clone([...rows].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)));
}

export async function createContact(input: {
  name: string;
  email: string;
  company?: string | undefined;
  clientId?: string | undefined;
  role?: ContactRole | undefined;
  source?: Contact["source"] | undefined;
}): Promise<Contact> {
  if (BASE) return http<Contact>("/contacts", { method: "POST", body: JSON.stringify(input) });
  await delay(150);
  const list = ensureContacts();
  const email = input.email.trim().toLowerCase();
  const existing = list.find((c) => c.email.toLowerCase() === email);
  if (existing) return clone(existing);
  const contact: Contact = {
    id: `ct-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim() || email.split("@")[0]!,
    email,
    company: input.company?.trim() || undefined,
    clientId: input.clientId,
    role: input.role,
    source: input.source ?? "manual",
    createdAtISO: new Date().toISOString(),
  };
  list.unshift(contact);
  persistContacts();
  return clone(contact);
}

export async function updateContact(
  id: string,
  patch: Partial<Pick<Contact, "name" | "email" | "company" | "clientId" | "role">>,
): Promise<Contact> {
  if (BASE)
    return http<Contact>(`/contacts/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  await delay(150);
  const contact = ensureContacts().find((c) => c.id === id);
  if (!contact) throw new Error("Contact not found");
  Object.assign(contact, patch);
  persistContacts();
  return clone(contact);
}

export async function deleteContact(id: string): Promise<void> {
  if (BASE) {
    await http<void>(`/contacts/${id}`, { method: "DELETE" });
    return;
  }
  await delay(150);
  const list = ensureContacts();
  const i = list.findIndex((c) => c.id === id);
  if (i >= 0) list.splice(i, 1);
  persistContacts();
}

/** Mock: guess a contact record for a loose name/email pair. */
export async function suggestContactFromEmail(
  name: string,
  email: string,
): Promise<Contact | null> {
  if (BASE)
    return http<Contact | null>(
      `/contacts/suggest?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`,
    );
  await delay(150);
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const match = ensureContacts().find((c) => c.email.toLowerCase().endsWith(`@${domain}`));
  if (!match) return null;
  return clone({
    ...match,
    id: `ct-suggested-${domain}`,
    name: name || match.name,
    email,
    source: "sent",
  });
}

/** Meeting attendees / collaborators who aren't in the book yet. */
export async function suggestedContacts(): Promise<
  { name: string; clientId?: string | undefined; reason: string }[]
> {
  if (BASE) return http("/contacts/suggestions");
  await delay(150);
  const known = new Set(ensureContacts().map((c) => c.name.toLowerCase()));
  const dismissed = new Set(dismissedSuggestions().map((d) => d.toLowerCase()));
  const out = new Map<string, { name: string; clientId?: string | undefined; reason: string }>();
  for (const n of notes) {
    for (const a of n.attendees) {
      if (a === "Mary Alcott") continue;
      const key = a.toLowerCase();
      if (known.has(key) || dismissed.has(key) || out.has(key)) continue;
      out.set(key, { name: a, clientId: n.clientId, reason: `Met on “${n.title}”` });
    }
  }
  return [...out.values()].slice(0, 6);
}

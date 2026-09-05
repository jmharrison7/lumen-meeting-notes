export type TagColor = "ember" | "forest" | "plum" | "ocean" | "sand" | "slate";

export interface Client {
  id: string;
  name: string;
  tagColor: TagColor;
  meetingsThisMonth?: number | undefined;
  note?: string | undefined;
  lastMeetingAt?: string | undefined;
}

export type Priority = "low" | "medium" | "high";

export interface ActionItem {
  id: string;
  noteId: string;
  noteTitle: string;
  clientId: string;
  text: string;
  owner: string;
  dueDate?: string | undefined;
  priority: Priority;
  done: boolean;
  atSeconds?: number | undefined;
  syncedToTeamwork?: boolean | undefined;
}

export type Platform = "google-meet" | "zoom" | "in-person";

export interface Note {
  id: string;
  title: string;
  clientId: string;
  date: string;
  durationMinutes: number;
  attendees: string[];
  platform: Platform;
  summary: string;
  decisions: string[];
  openQuestions: string[];
  tags: string[];
  transcript: string;
  reviewed: boolean;
  actionItems: ActionItem[];
  audio?: NoteAudio | undefined;
  /** Optional per-index playback offsets, aligned with `decisions` / `openQuestions`. */
  decisionTimes?: (number | undefined)[] | undefined;
  questionTimes?: (number | undefined)[] | undefined;
}

export interface NoteAudio {
  durationSeconds: number;
  url?: string | undefined;
}

export interface TranscriptLine {
  atSeconds: number;
  speaker: string;
  text: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  clientId?: string | undefined;
  start: string;
  end: string;
  platform: Platform;
}

export interface LiveSegment {
  id: string;
  atISO: string;
  kind: "speech" | "note" | "decision" | "action";
  speaker?: string | undefined;
  text: string;
  actionOwner?: string | undefined;
  actionDue?: string | undefined;
}

export interface LiveSession {
  id: string;
  title: string;
  clientId?: string | undefined;
  platform: Platform;
  startedAtISO: string;
  attendees: string[];
  segments: LiveSegment[];
  status: "capturing" | "paused" | "ended";
}

export type FollowUpTone = "warm" | "professional" | "concise";

export interface FollowUpOptions {
  tone: FollowUpTone;
  includeQuestions: boolean;
  includeActionItems: boolean;
}

export interface FollowUpDraft {
  subject: string;
  bodyMarkdown: string;
  bodyText: string;
}

export type DocKind = "slides" | "docs" | "sheets" | "file";

export interface ClientFile {
  id: string;
  clientId: string;
  kind: DocKind;
  name: string;
  source: "drive" | "upload";
  url?: string | undefined;
  mime?: string | undefined;
  sizeBytes?: number | undefined;
  label?: string | undefined;
  tags: string[];
  createdAtISO: string;
  modifiedAtISO?: string | undefined;
}

export type TemplateKind = "estimate" | "brand" | "proposal" | "agenda" | "other";

export interface Template {
  id: string;
  clientId?: string | undefined;
  name: string;
  kind: TemplateKind;
  source: "upload" | "drive";
  url?: string | undefined;
  sizeBytes?: number | undefined;
  createdAtISO: string;
}

export interface AlertRule {
  id: string;
  term: string;
  enabled: boolean;
  notify: boolean;
}

export interface TopicAlertConfig {
  enabled: boolean;
  topics: { key: string; label: string; enabled: boolean }[];
}

export interface GlobalAlertConfig {
  rules: AlertRule[];
  topics: TopicAlertConfig;
}

export interface ClientAlertConfig {
  clientId: string;
  inheritGlobal: boolean;
  rules: AlertRule[];
}

export interface MentionHit {
  term: string;
  snippet: string;
  atSeconds?: number | undefined;
  topic?: string | undefined;
}

export interface AskSource {
  kind: "note" | "file" | "transcript";
  label: string;
  snippet: string;
  link: string;
}

export interface AskReply {
  answer: string;
  sources: AskSource[];
}

export interface AskMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: AskSource[] | undefined;
  attachment?: string | undefined;
}

export type ShareChannel = "email" | "link" | "text";

export interface ShareResult {
  channel: ShareChannel;
  sentTo?: string[] | undefined;
  link?: string | undefined;
  text?: string | undefined;
}

export type IdeaSource = "recorded" | "uploaded" | "typed";

export interface Idea {
  id: string;
  title: string;
  transcript: string;
  clientId?: string | undefined;
  tags: string[];
  source: IdeaSource;
  durationSeconds?: number | undefined;
  createdAtISO: string;
  convertedToNoteId?: string | undefined;
  suggestionDismissed?: boolean | undefined;
}

export interface BrandDNA {
  clientId: string;
  voice: string[];
  always: string[];
  never: string[];
  tone: string;
  updatedAtISO: string;
}

/* ------------------------------ Sharing & access ------------------------------ */

export type CollaboratorRole = "viewer" | "editor";

export interface Collaborator {
  id: string;
  email: string;
  name?: string | undefined;
  role: CollaboratorRole;
  /** Clients this person has been granted. */
  clientIds: string[];
  status: "invited" | "active";
  lastActiveAt?: string | undefined;
  invitedAtISO: string;
}

export type ShareTarget = { type: "note" | "client" | "file"; id: string };

export interface ShareLink {
  id: string;
  target: ShareTarget;
  label: string;
  permission: "view" | "edit";
  token: string;
  expiresAtISO?: string | undefined;
  revoked: boolean;
  createdAtISO: string;
}

/* --------------------------------- Contacts --------------------------------- */

export type ContactRole = "client" | "team" | "freelancer" | "other";

export interface Contact {
  id: string;
  name: string;
  email: string;
  company?: string | undefined;
  /** Client contact when known. */
  clientId?: string | undefined;
  role?: ContactRole | undefined;
  source: "manual" | "attendee" | "collaborator" | "sent" | "google";
  createdAtISO: string;
}

/* ----------------------------------- Money ----------------------------------- */

export type ExpenseCategory =
  | "Advertising"
  | "Software & Subscriptions"
  | "Contractors"
  | "Office Supplies"
  | "Travel"
  | "Meals (50%)"
  | "Equipment"
  | "Professional Services"
  | "Insurance"
  | "Utilities"
  | "Home Office"
  | "Other";

export interface MoneyExpense {
  id: string;
  /** Derived from dateISO — a row belongs to exactly one tax year. */
  taxYear: number;
  dateISO: string;
  vendor: string;
  category: ExpenseCategory;
  amount: number;
  payment?: string | undefined;
  notes?: string | undefined;
  clientId?: string | undefined;
  receiptName?: string | undefined;
  receiptPreview?: string | undefined;
  source: "manual" | "email-auto";
  createdAtISO: string;
}

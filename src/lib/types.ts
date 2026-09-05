export type TagColor = "ember" | "forest" | "plum" | "ocean" | "sand" | "slate";

export interface Client {
  id: string;
  name: string;
  tagColor: TagColor;
  meetingsThisMonth?: number | undefined;
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

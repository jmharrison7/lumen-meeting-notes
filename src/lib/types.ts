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

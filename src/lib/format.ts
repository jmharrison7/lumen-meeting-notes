import type { Note, TagColor } from "./types";

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function relativeDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = Math.round((a - b) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `in ${diff} days`;
}

export function dueBucket(iso?: string): "overdue" | "today" | "week" | "later" {
  if (!iso) return "later";
  const d = new Date(iso);
  const today = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = Math.round((a - b) / 86400000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "week";
  return "later";
}

export const tagStyles: Record<TagColor, string> = {
  ember: "bg-[oklch(0.93_0.05_45)] text-[oklch(0.38_0.13_40)] dark:bg-[oklch(0.32_0.06_42)] dark:text-[oklch(0.85_0.07_50)]",
  forest:
    "bg-[oklch(0.93_0.04_150)] text-[oklch(0.37_0.08_150)] dark:bg-[oklch(0.3_0.05_150)] dark:text-[oklch(0.85_0.06_150)]",
  plum: "bg-[oklch(0.93_0.04_330)] text-[oklch(0.38_0.09_330)] dark:bg-[oklch(0.31_0.05_330)] dark:text-[oklch(0.86_0.05_330)]",
  ocean:
    "bg-[oklch(0.93_0.04_235)] text-[oklch(0.38_0.08_240)] dark:bg-[oklch(0.31_0.05_240)] dark:text-[oklch(0.86_0.05_240)]",
  sand: "bg-[oklch(0.93_0.035_85)] text-[oklch(0.39_0.06_75)] dark:bg-[oklch(0.31_0.04_80)] dark:text-[oklch(0.86_0.05_85)]",
  slate:
    "bg-[oklch(0.93_0.01_260)] text-[oklch(0.4_0.02_260)] dark:bg-[oklch(0.31_0.01_260)] dark:text-[oklch(0.86_0.01_260)]",
};

export function noteToMarkdown(note: Note, clientName: string) {
  const lines = [
    `# ${note.title}`,
    "",
    `**Client:** ${clientName}  `,
    `**Date:** ${formatDate(note.date)} at ${formatTime(note.date)}  `,
    `**Duration:** ${formatDuration(note.durationMinutes)}  `,
    `**Attendees:** ${note.attendees.join(", ")}`,
    "",
    "## Summary",
    note.summary,
    "",
    "## Decisions",
    ...note.decisions.map((d) => `- ${d}`),
    "",
    "## Action items",
    ...note.actionItems.map(
      (a) =>
        `- [${a.done ? "x" : " "}] ${a.text} — ${a.owner}${a.dueDate ? ` (due ${formatDate(a.dueDate)})` : ""}`,
    ),
  ];
  if (note.openQuestions.length) {
    lines.push("", "## Open questions", ...note.openQuestions.map((q) => `- ${q}`));
  }
  return lines.join("\n");
}

export function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

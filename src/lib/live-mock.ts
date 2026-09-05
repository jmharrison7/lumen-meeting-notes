import type { LiveSegment, LiveSession } from "./types";

/** The one session the Mac helper is currently streaming. */
export const liveSession: LiveSession = {
  id: "live-1",
  title: "Harbor Coffee Co. — Spring campaign sprint",
  clientId: "c-harbor",
  platform: "google-meet",
  startedAtISO: new Date(Date.now() - 90_000).toISOString(),
  attendees: ["Mary Cassidy", "Dev Patel", "Nora Lindqvist", "Sam Okoye"],
  segments: [],
  status: "capturing",
};

type ScriptItem = Omit<LiveSegment, "id" | "atISO">;

/** Scripted, decision-dense content so the demo reads like a real call. */
export const liveScript: ScriptItem[] = [
  { kind: "speech", speaker: "Nora", text: "Thanks for making room today — we want the spring campaign locked before the roasting schedule changes in April." },
  { kind: "note", text: "Harbor Coffee wants the spring campaign creative locked before their April roasting change, with launch weight behind the single-origin subscription." },
  { kind: "speech", speaker: "Dev", text: "Our read is that the subscription is the only line with margin room, so the campaign should sell the ritual, not the bag." },
  { kind: "decision", text: "Campaign hero message centres the morning ritual, with the single-origin subscription as the primary conversion." },
  { kind: "speech", speaker: "Mary", text: "Then we cut the third product story. Two stories, shot in one day, keeps photography inside the number we quoted." },
  { kind: "decision", text: "Scope trimmed to two product stories shot in a single studio day; the third story moves to a summer refresh." },
  { kind: "action", text: "Rebuild the shot list around two stories and share for approval", actionOwner: "Dev", actionDue: "in 2 days" },
  { kind: "speech", speaker: "Sam", text: "Media is holding two weeks of paid social in late March. We'd need final assets ten days ahead of that." },
  { kind: "note", text: "Paid social runs the last two weeks of March, so final assets are due ten days before flight — that sets the studio day for the first week of March." },
  { kind: "decision", text: "Studio day booked for the first week of March to clear the ten-day asset deadline before paid social." },
  { kind: "action", text: "Hold the studio and confirm the photographer for the first week of March", actionOwner: "Mary", actionDue: "in 4 days" },
  { kind: "speech", speaker: "Nora", text: "One caveat — the packaging refresh might not print in time, so we may be shooting current packs." },
  { kind: "note", text: "Packaging timing is the main risk: if the refresh misses print, the shoot uses current packs and retouching covers the label change." },
  { kind: "speech", speaker: "Dev", text: "We can retouch labels if it comes to that, but we'd need the dielines by the end of next week." },
  { kind: "action", text: "Send final dielines so labels can be retouched if the refresh slips", actionOwner: "Nora", actionDue: "in 7 days" },
  { kind: "decision", text: "If the packaging refresh misses print, the shoot proceeds with current packs and labels are handled in retouching." },
  { kind: "speech", speaker: "Sam", text: "Budget-wise we're comfortable, assuming no additional talent day." },
  { kind: "note", text: "Budget holds at the quoted figure provided there is no additional talent day; any added day comes back for approval." },
  { kind: "speech", speaker: "Mary", text: "Good. I'll write this up and send the recap this afternoon." },
  { kind: "decision", text: "Any additional talent day is treated as a change order and re-approved before booking." },
];

const openQuestionPool = [
  "Will the packaging refresh clear print before the studio day?",
  "Does the subscription offer need a founding-member discount for launch?",
  "Who signs off on paid social copy — Nora or the wider Harbor team?",
];

export function compileSegments(segments: LiveSegment[]) {
  const notes = segments.filter((s) => s.kind === "note").map((s) => s.text);
  const decisions = segments.filter((s) => s.kind === "decision").map((s) => s.text);
  const actions = segments.filter((s) => s.kind === "action");
  const summary =
    notes.slice(0, 3).join(" ") ||
    "A working session captured live; the write-up covers the ground the team walked through.";
  const transcript = segments
    .filter((s) => s.kind === "speech")
    .map((s) => `${s.speaker ?? "Speaker"}: ${s.text}`)
    .join("\n\n");
  return { summary, decisions, actions, transcript, openQuestions: openQuestionPool };
}

import type { ActionItem, CalendarEvent, Client, Note } from "./types";

const DAY = 86400000;

function iso(daysFromNow: number, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const clients: Client[] = [
  { id: "c-northwind", name: "Northwind Coffee", tagColor: "ember", meetingsThisMonth: 6 },
  { id: "c-atlas", name: "Atlas Ventures", tagColor: "forest", meetingsThisMonth: 4 },
  { id: "c-marigold", name: "Marigold Studio", tagColor: "plum", meetingsThisMonth: 3 },
  { id: "c-harbor", name: "Harbor Health", tagColor: "ocean", meetingsThisMonth: 2 },
  { id: "c-internal", name: "Internal", tagColor: "sand", meetingsThisMonth: 5 },
];

function transcriptFor(title: string, people: string[]) {
  return people
    .flatMap((p, i) => [
      `${p} (00:0${i + 1}): Thanks everyone for joining — quick context on ${title.toLowerCase()}.`,
      `${p} (00:1${i + 2}): The main thing I want to land today is scope and the next checkpoint.`,
    ])
    .join("\n\n");
}

function ai(
  noteId: string,
  clientId: string,
  noteTitle: string,
  n: number,
  text: string,
  owner: string,
  dueDate: string | undefined,
  priority: ActionItem["priority"],
  done = false,
  synced = false,
): ActionItem {
  return {
    id: `${noteId}-a${n}`,
    noteId,
    noteTitle,
    clientId,
    text,
    owner,
    dueDate,
    priority,
    done,
    syncedToTeamwork: synced,
  };
}

type Seed = Omit<Note, "actionItems"> & { actionItems: ActionItem[] };

function makeNote(
  id: string,
  title: string,
  clientId: string,
  date: string,
  durationMinutes: number,
  attendees: string[],
  platform: Note["platform"],
  summary: string,
  decisions: string[],
  openQuestions: string[],
  tags: string[],
  items: Array<
    [string, string, string | undefined, ActionItem["priority"]] | [string, string, string | undefined, ActionItem["priority"], boolean]
  >,
  reviewed = false,
): Seed {
  return {
    id,
    title,
    clientId,
    date,
    durationMinutes,
    attendees,
    platform,
    summary,
    decisions,
    openQuestions,
    tags,
    transcript: transcriptFor(title, attendees),
    reviewed,
    actionItems: items.map((it, i) =>
      ai(id, clientId, title, i + 1, it[0], it[1], it[2], it[3], it[4] ?? false, i % 3 === 0),
    ),
  };
}

export const notes: Note[] = [
  makeNote(
    "n-1",
    "Northwind rebrand — packaging direction review",
    "c-northwind",
    iso(0, 9, 30),
    47,
    ["Mary Alcott", "Dev Patel", "Sara Lin"],
    "meet",
    "The team reviewed three packaging directions for the Northwind rebrand. Direction B (warm kraft with embossed mark) tested strongest with the retail buyers. Mary agreed to refine B and drop A entirely before the buyer presentation.",
    [
      "Move forward with Direction B as the primary packaging system.",
      "Drop Direction A; keep C as a stretch concept for seasonal editions.",
      "Buyer presentation moves to the last week of the month.",
    ],
    ["Do we need FSC certification artwork on the bag by launch?", "Who owns the die-line handoff?"],
    ["rebrand", "packaging", "presentation"],
    [
      ["Refine Direction B with embossed mark variants", "Mary", iso(2, 17), "high"],
      ["Send die-line specs to the printer", "Dev", iso(4, 17), "medium"],
      ["Book the buyer presentation room", "Sara", iso(-1, 17), "low"],
    ],
  ),
  makeNote(
    "n-2",
    "Atlas Ventures — Q3 site performance readout",
    "c-atlas",
    iso(0, 14, 0),
    32,
    ["Mary Alcott", "Jonah Reid"],
    "zoom",
    "Quarterly readout on the Atlas marketing site. Organic traffic is up 22% but the pricing page converts below target. Agreed to run a focused pricing page test next sprint rather than a full redesign.",
    ["Run an A/B test on pricing page hierarchy before any redesign.", "Hold the blog refresh until Q4."],
    ["What is the minimum sample size for a two-week test?"],
    ["analytics", "conversion"],
    [
      ["Draft pricing page test variants", "Mary", iso(3, 17), "high"],
      ["Pull 90-day funnel data", "Jonah", iso(1, 17), "medium"],
    ],
  ),
  makeNote(
    "n-3",
    "Marigold Studio — partnership kickoff",
    "c-marigold",
    iso(-1, 11, 0),
    58,
    ["Mary Alcott", "Elena Cruz", "Tom Bright"],
    "meet",
    "Kickoff for the co-branded motion series with Marigold. Scope covers six short films over two quarters, with Lumen leading art direction and Marigold handling production. Budget envelope agreed verbally, contract to follow.",
    ["Six films, two quarters, Lumen leads art direction.", "Marigold owns production and post."],
    ["Is music licensing inside or outside the agreed budget?"],
    ["kickoff", "partnership", "motion"],
    [
      ["Send scope memo and rate card", "Mary", iso(0, 17), "high"],
      ["Share reference reel folder", "Elena", iso(2, 17), "low"],
      ["Confirm licensing budget line", "Tom", iso(6, 17), "medium"],
    ],
    true,
  ),
  makeNote(
    "n-4",
    "Harbor Health — accessibility audit findings",
    "c-harbor",
    iso(-3, 15, 30),
    41,
    ["Mary Alcott", "Priya Nair", "Dev Patel"],
    "zoom",
    "Walked through the accessibility audit for the patient portal. Twelve blocking issues, mostly contrast and focus order. Remediation is scheduled ahead of the compliance deadline with no impact on the visual system.",
    ["Fix all twelve blocking issues before the compliance deadline.", "Keep the existing color system; adjust tokens only."],
    ["Do we need a third-party VPAT statement?"],
    ["accessibility", "audit", "healthcare"],
    [
      ["Adjust contrast tokens across the portal", "Dev", iso(5, 17), "high"],
      ["Write remediation summary for the client", "Priya", iso(-2, 17), "medium", true],
    ],
    true,
  ),
  makeNote(
    "n-5",
    "Studio weekly — capacity and hiring",
    "c-internal",
    iso(-4, 9, 0),
    28,
    ["Mary Alcott", "Sara Lin", "Dev Patel", "Priya Nair"],
    "meet",
    "Studio is at 88% capacity through the next six weeks. Agreed to open a contract motion designer role rather than turning down the Marigold series. Friday demos move to Thursday afternoons.",
    ["Open a contract motion designer role.", "Move studio demos to Thursday 3pm."],
    ["Should we cap new pitches until the role is filled?"],
    ["internal", "hiring", "capacity"],
    [
      ["Post the contract motion role", "Sara", iso(1, 17), "medium"],
      ["Update the capacity board", "Priya", iso(-3, 17), "low", true],
    ],
  ),
  makeNote(
    "n-6",
    "Northwind — retail rollout logistics",
    "c-northwind",
    iso(-6, 13, 0),
    36,
    ["Mary Alcott", "Dev Patel"],
    "zoom",
    "Covered store rollout sequencing for the rebrand. Flagship goes first with full signage; the remaining eleven stores receive a lighter kit. Printer lead times are the main risk.",
    ["Flagship first, then a lighter kit for the other eleven stores."],
    ["Can the printer commit to a three-week turnaround?"],
    ["rollout", "retail"],
    [["Confirm printer lead times", "Dev", iso(8, 17), "medium"]],
    true,
  ),
  makeNote(
    "n-7",
    "Atlas Ventures — brand voice workshop",
    "c-atlas",
    iso(-9, 10, 30),
    75,
    ["Mary Alcott", "Jonah Reid", "Elena Cruz"],
    "meet",
    "Working session to define the Atlas voice. Landed on three principles: plain, precise, and generous. Wrote sample copy for the homepage and one investor update to test the tone in the wild.",
    ["Voice principles: plain, precise, generous.", "No jargon in top-of-funnel copy."],
    [],
    ["workshop", "brand voice"],
    [["Write the voice guidelines page", "Mary", iso(12, 17), "low"]],
  ),
  makeNote(
    "n-8",
    "Marigold Studio — film one storyboard review",
    "c-marigold",
    iso(-12, 16, 0),
    52,
    ["Mary Alcott", "Elena Cruz"],
    "zoom",
    "Reviewed the storyboard for the first film. Opening sequence is too slow; agreed to cut the establishing shots and start on the product detail. Everything after the midpoint holds.",
    ["Cut the first three establishing frames.", "Start the film on a product macro."],
    ["Do we shoot practical or render the macro?"],
    ["storyboard", "motion"],
    [["Re-cut the opening sequence", "Elena", iso(-5, 17), "high"]],
    true,
  ),
];

export const actionItems: ActionItem[] = notes.flatMap((n) => n.actionItems);

export const calendar: CalendarEvent[] = [
  {
    id: "e-1",
    title: "Northwind rebrand — packaging direction review",
    clientId: "c-northwind",
    start: iso(0, 9, 30),
    end: iso(0, 10, 15),
    platform: "meet",
  },
  {
    id: "e-2",
    title: "Atlas Ventures — Q3 site performance readout",
    clientId: "c-atlas",
    start: iso(0, 14, 0),
    end: iso(0, 14, 45),
    platform: "zoom",
  },
  {
    id: "e-3",
    title: "Studio demos",
    clientId: "c-internal",
    start: iso(0, 15, 0),
    end: iso(0, 16, 0),
    platform: "meet",
  },
];

export function clientsWithStats(): Client[] {
  return clients.map((c) => {
    const cn = notes.filter((n) => n.clientId === c.id);
    const last = cn.map((n) => n.date).sort().at(-1);
    return {
      ...c,
      meetingsThisMonth: cn.filter((n) => Date.now() - new Date(n.date).getTime() < 30 * DAY).length,
      lastMeetingAt: last,
    };
  });
}

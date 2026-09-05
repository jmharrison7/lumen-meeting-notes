import type { ActionItem, CalendarEvent, Client, Note } from "./types";

const DAY = 86400000;

function iso(daysFromNow: number, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const clients: Client[] = [
  { id: "c-willow", name: "Willow & Vine", tagColor: "plum" },
  { id: "c-harbor", name: "Harbor Coffee Co.", tagColor: "ember" },
  { id: "c-brightline", name: "Brightline Fitness", tagColor: "ocean" },
  { id: "c-northwind", name: "Northwind Outdoors", tagColor: "forest" },
  { id: "c-fern", name: "Fern & Field", tagColor: "sand" },
  { id: "c-atlas", name: "Atlas Media", tagColor: "slate" },
  { id: "c-internal", name: "Studio (Internal)", tagColor: "ember" },
];

function transcriptFor(title: string, people: string[]) {
  return people
    .flatMap((p, i) => [
      `${p} (00:0${i + 1}): Quick context before we dig in — this is the ${title.toLowerCase()} session.`,
      `${p} (00:1${i + 2}): The thing I want to land today is scope, owner, and the next checkpoint.`,
    ])
    .join("\n\n");
}

const longTranscript = [
  "Mary Alcott (00:00): Morning everyone. This is the packaging direction review for Willow & Vine — we've got about fifty minutes and three directions to get through.",
  "Nadia Okafor (00:34): Before we start, one constraint from our side: the shelf we're going into at Sundry is glossier than we planned for. Whatever we pick has to hold up next to very loud neighbours.",
  "Mary Alcott (01:12): Good, that's useful. Dev, take us through A.",
  "Dev Patel (01:20): Direction A is the high-contrast typographic one. Big serif lockup, white stock, everything riding on the wordmark. It photographs beautifully but it's the quietest of the three on shelf.",
  "Nadia Okafor (02:41): I love it in isolation. I don't believe it survives Sundry.",
  "Dev Patel (03:05): Agreed, and that's the honest read. Direction B is the warm kraft with the embossed mark. It has physical presence — the emboss catches store lighting, which does a lot of the work the print can't.",
  "Sara Lin (04:18): We tested B with six retail buyers last week. Five picked it unprompted. The comment that came up repeatedly was 'this feels like it costs more than it does'.",
  "Nadia Okafor (05:02): That's exactly the position we want. What's the cost delta on the emboss?",
  "Dev Patel (05:30): Roughly eleven cents a unit at our current run size, dropping to about seven if we commit to a twelve-month print schedule.",
  "Nadia Okafor (06:15): Seven is fine. Eleven is fine, honestly, if the shelf test holds.",
  "Mary Alcott (06:48): Then let's talk about C so we're not deciding in a vacuum.",
  "Dev Patel (07:10): C is the illustrated botanical system — a different illustration per SKU. It's charming, it's the most ownable, and it's the most expensive to maintain. Every new SKU is a new commission.",
  "Sara Lin (08:22): Buyers liked C but described it as seasonal. Nobody read it as the permanent identity.",
  "Nadia Okafor (09:04): Which is actually a use for it. Could C become our limited edition system?",
  "Mary Alcott (09:31): That's the right home for it. B as the permanent system, C reserved for seasonal releases, A retired.",
  "Nadia Okafor (10:02): Agreed. Kill A.",
  "Dev Patel (10:15): Happily. It frees up a week.",
  "Mary Alcott (10:40): Next question is the die-line handoff. Who owns it on your side?",
  "Nadia Okafor (11:05): Our ops lead, Theo. He's back Monday. I'll loop him in with the specs.",
  "Dev Patel (11:33): I'll have printer-ready die-lines by end of week. I need final SKU count to do that properly.",
  "Nadia Okafor (12:01): Fourteen at launch. Two more in the spring, but don't design for those yet.",
  "Sara Lin (12:44): One more thing — FSC certification. Are we putting the mark on the bag at launch?",
  "Nadia Okafor (13:20): We're certified but the paperwork lags. I'd rather not print a mark we can't defend on day one.",
  "Mary Alcott (13:52): Then we leave space in the layout for it and add it at the second print run. Dev, can you keep that area clean?",
  "Dev Patel (14:10): Yes — I'll reserve a 20mm block on the back panel and document it in the spec.",
  "Mary Alcott (14:38): Last item: the buyer presentation. We had it mid-month, but with the emboss samples in the loop that's tight.",
  "Sara Lin (15:02): The sample house needs nine working days from artwork lock.",
  "Nadia Okafor (15:29): Push it to the last week of the month. I'd rather show physical samples than renders.",
  "Mary Alcott (15:55): Done. I'll move the invite and confirm the room. Recapping: B is the system, C is seasonal, A is dead, die-lines by Friday, FSC space reserved, presentation moves to the last week.",
  "Nadia Okafor (16:30): That's my understanding too. Thanks all — this was the clearest one of these we've had.",
].join("\n\n");

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

type Item =
  | [string, string, string | undefined, ActionItem["priority"]]
  | [string, string, string | undefined, ActionItem["priority"], boolean];

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
  items: Item[],
  reviewed = false,
  transcript?: string,
): Note {
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
    transcript: transcript ?? transcriptFor(title, attendees),
    audio: { durationSeconds: durationMinutes * 60 },
    reviewed,
    actionItems: items.map((it, i) =>
      ai(id, clientId, title, i + 1, it[0], it[1], it[2], it[3], it[4] ?? false, i % 3 === 0),
    ),
  };
}

export const notes: Note[] = [
  makeNote(
    "n-1",
    "Willow & Vine — packaging direction review",
    "c-willow",
    iso(0, 9, 30),
    47,
    ["Mary Alcott", "Nadia Okafor", "Dev Patel", "Sara Lin"],
    "google-meet",
    "Three packaging directions went head to head against the Sundry shelf. Direction B (warm kraft, embossed mark) won with five of six retail buyers and reads as more expensive than it is. Direction A is retired and C becomes the seasonal limited-edition system.",
    [
      "Direction B is the permanent packaging system.",
      "Direction C is reserved for seasonal limited editions; Direction A is retired.",
      "Leave a 20mm reserved block for the FSC mark, added at the second print run.",
      "Buyer presentation moves to the last week of the month so physical samples are ready.",
    ],
    [
      "Does the emboss cost hold at seven cents if we commit to a twelve-month print schedule?",
      "Who signs off the die-line on Willow & Vine's side while Theo is out?",
    ],
    ["packaging", "retail", "presentation"],
    [
      ["Deliver printer-ready die-lines for all 14 launch SKUs", "Dev", iso(2, 17), "high"],
      ["Move the buyer presentation and confirm the sample house slot", "Sara", iso(0, 17), "high"],
      ["Send the emboss cost breakdown at both run sizes", "Mary", iso(-1, 17), "medium"],
      ["Loop Theo in on die-line specs when he's back", "Nadia", iso(4, 17), "low"],
    ],
    false,
    longTranscript,
  ),
  makeNote(
    "n-2",
    "Harbor Coffee Co. — campaign sprint planning",
    "c-harbor",
    iso(0, 14, 0),
    38,
    ["Mary Alcott", "Jonah Reid", "Priya Nair"],
    "zoom",
    "Locked the two-week sprint for the cold brew summer campaign. Hero film slips to a static-first launch because the shoot window collapsed; social cutdowns carry the first week. Media spend stays flat and shifts from display to paid social.",
    [
      "Launch static-first; hero film lands in week two.",
      "Shift 40% of display budget to paid social.",
      "One round of client feedback per asset, not two.",
    ],
    ["Can we reuse last summer's shoot footage for the week-one cutdowns?"],
    ["campaign", "sprint", "social"],
    [
      ["Build the week-one static set (6 formats)", "Priya", iso(1, 17), "high"],
      ["Rework the media plan with the display-to-social shift", "Jonah", iso(3, 17), "medium"],
      ["Confirm footage licensing for reuse", "Mary", iso(0, 17), "medium"],
    ],
  ),
  makeNote(
    "n-3",
    "Brightline Fitness — brand strategy kickoff",
    "c-brightline",
    iso(-1, 11, 0),
    62,
    ["Mary Alcott", "Elena Cruz", "Marcus Bell"],
    "google-meet",
    "Kickoff for the Brightline repositioning. The current brand speaks to competitive athletes while 70% of memberships come from people returning to exercise after a break. Agreed the strategy work targets the returner, not the athlete.",
    [
      "Reposition around the returning member, not the competitive athlete.",
      "Six-week strategy phase before any visual work starts.",
      "Research includes 12 member interviews across three locations.",
    ],
    ["Do we interview lapsed members as well as active ones?", "Who owns tone of voice after handoff?"],
    ["kickoff", "strategy", "research"],
    [
      ["Write the research discussion guide", "Elena", iso(2, 17), "high"],
      ["Recruit 12 members across three locations", "Marcus", iso(6, 17), "medium"],
      ["Share the phase-one timeline and rate card", "Mary", iso(-2, 17), "high"],
    ],
    true,
  ),
  makeNote(
    "n-4",
    "Northwind Outdoors — logo review, round two",
    "c-northwind",
    iso(-2, 15, 30),
    44,
    ["Mary Alcott", "Dev Patel", "Anna Whitfield"],
    "zoom",
    "Second round on the Northwind mark. The ridge-line monogram reads well at large sizes but collapses below 24px, which matters for embroidery and app icons. Agreed to develop a simplified secondary mark rather than compromise the primary.",
    [
      "Keep the detailed ridge-line mark as primary.",
      "Develop a simplified secondary mark for small sizes and embroidery.",
      "No further exploration of the wordmark-only route.",
    ],
    ["What is the minimum embroidery size the supplier can hold?"],
    ["identity", "logo", "review"],
    [
      ["Draw three simplified secondary mark options", "Dev", iso(3, 17), "high"],
      ["Get minimum stitch size from the embroidery supplier", "Anna", iso(1, 17), "medium"],
    ],
  ),
  makeNote(
    "n-5",
    "Fern & Field — pricing and scope negotiation",
    "c-fern",
    iso(-3, 10, 0),
    55,
    ["Mary Alcott", "Rebecca Voss"],
    "in-person",
    "Fern & Field asked for the full identity plus web build inside the identity-only budget. Held the rate and reduced scope instead: identity and a five-page site, with the shop build moved to a separate phase in the autumn.",
    [
      "Hold the day rate; reduce scope rather than discount.",
      "Phase one is identity plus a five-page marketing site.",
      "Shop build becomes phase two, quoted separately in autumn.",
    ],
    ["Does phase two pricing get locked now or re-quoted?"],
    ["pricing", "scope", "negotiation"],
    [
      ["Issue the revised two-phase proposal", "Mary", iso(-1, 17), "high"],
      ["Draft the phase-two scope outline", "Rebecca", iso(7, 17), "low"],
    ],
  ),
  makeNote(
    "n-6",
    "Atlas Media — Q3 site performance readout",
    "c-atlas",
    iso(-4, 14, 0),
    33,
    ["Mary Alcott", "Jonah Reid"],
    "zoom",
    "Organic traffic is up 22% quarter over quarter but the pricing page converts a third below target. Agreed to run a focused hierarchy test before entertaining a redesign, and to hold the blog refresh until Q4.",
    [
      "A/B test pricing page hierarchy before any redesign.",
      "Hold the blog refresh until Q4.",
    ],
    ["What is the minimum sample size for a two-week test?"],
    ["analytics", "conversion"],
    [
      ["Draft two pricing page test variants", "Mary", iso(2, 17), "high"],
      ["Pull the 90-day funnel data", "Jonah", iso(-2, 17), "medium"],
    ],
  ),
  makeNote(
    "n-7",
    "Studio weekly — capacity and hiring",
    "c-internal",
    iso(-5, 9, 0),
    28,
    ["Mary Alcott", "Sara Lin", "Dev Patel", "Priya Nair"],
    "in-person",
    "The studio is at 88% capacity for the next six weeks. Rather than turn down the Atlas motion series, we open a contract motion designer role. Friday demos move to Thursday afternoons so Fridays stay unbooked.",
    [
      "Open a contract motion designer role at the standard contract rate.",
      "Move studio demos to Thursday 3pm.",
      "No new pitches accepted until the contractor starts.",
    ],
    ["Do we cap the contract at eight weeks or leave it open?"],
    ["internal", "hiring", "capacity"],
    [
      ["Post the contract motion designer role", "Sara", iso(1, 17), "medium"],
      ["Update the capacity board with the pitch freeze", "Priya", iso(-3, 17), "low", true],
    ],
  ),
  makeNote(
    "n-8",
    "Harbor Coffee Co. — client retro on the spring launch",
    "c-harbor",
    iso(-7, 13, 0),
    49,
    ["Mary Alcott", "Jonah Reid", "Priya Nair", "Owen Marsh"],
    "google-meet",
    "Honest retro on the spring launch. The work landed but the approval chain cost nine days. Both sides agreed to a single named approver and a fixed 48-hour feedback window for the next campaign.",
    [
      "One named approver per campaign on the client side.",
      "48-hour feedback window, after which work proceeds as presented.",
      "Weekly 15-minute check-in replaces ad-hoc email threads.",
    ],
    ["Who covers approvals when Owen is travelling?"],
    ["retro", "process"],
    [
      ["Write the revised ways-of-working one-pager", "Mary", iso(-4, 17), "medium", true],
      ["Nominate a backup approver", "Owen", iso(5, 17), "medium"],
    ],
    true,
  ),
  makeNote(
    "n-9",
    "Willow & Vine — retail rollout logistics",
    "c-willow",
    iso(-8, 16, 0),
    36,
    ["Mary Alcott", "Dev Patel", "Nadia Okafor"],
    "zoom",
    "Sequenced the store rollout. The flagship gets the full signage system; the remaining eleven stores receive a lighter kit of window vinyl and shelf talkers. Printer lead times are the only real risk to the date.",
    [
      "Flagship first with full signage, then a lighter kit for eleven stores.",
      "Hold two weeks of buffer before the flagship date.",
    ],
    ["Can the printer commit to a three-week turnaround in peak season?"],
    ["rollout", "retail"],
    [["Confirm printer lead times in writing", "Dev", iso(8, 17), "medium"]],
    true,
  ),
  makeNote(
    "n-10",
    "Brightline Fitness — campaign sprint, week one",
    "c-brightline",
    iso(-9, 11, 30),
    41,
    ["Mary Alcott", "Elena Cruz", "Marcus Bell"],
    "google-meet",
    "First sprint review on the January intake campaign. The 'start where you are' line tested far better than the performance-led alternatives. Photography direction shifts from gym interiors to everyday settings.",
    [
      "Lead line is 'Start where you are'.",
      "Shoot in everyday settings, not gym interiors.",
      "Drop the countdown mechanic — it read as pressure.",
    ],
    [],
    ["campaign", "copy", "photography"],
    [
      ["Rebuild the shot list around everyday settings", "Elena", iso(-6, 17), "high", true],
      ["Price the revised shoot", "Marcus", iso(4, 17), "low"],
    ],
  ),
  makeNote(
    "n-11",
    "Atlas Media — brand voice workshop",
    "c-atlas",
    iso(-11, 10, 30),
    78,
    ["Mary Alcott", "Jonah Reid", "Elena Cruz"],
    "google-meet",
    "Working session to define the Atlas voice. Landed on three principles — plain, precise, generous — and wrote sample copy for the homepage and an investor update to test the tone against real formats.",
    [
      "Voice principles: plain, precise, generous.",
      "No industry jargon in top-of-funnel copy.",
      "Investor updates keep a slightly more formal register.",
    ],
    ["Do we apply the voice retroactively to the existing help centre?"],
    ["workshop", "brand voice"],
    [["Write the voice guidelines page with examples", "Mary", iso(9, 17), "low"]],
  ),
  makeNote(
    "n-12",
    "Fern & Field — logo review, round one",
    "c-fern",
    iso(-13, 15, 0),
    46,
    ["Mary Alcott", "Dev Patel", "Rebecca Voss"],
    "zoom",
    "First look at three identity routes. The botanical monoline route was the clear favourite but the current weight disappears on packaging. Agreed to thicken the strokes and test it printed before round two.",
    [
      "Progress the botanical monoline route only.",
      "Thicken strokes and test on uncoated stock before round two.",
    ],
    ["Should the mark work without the wordmark at all?"],
    ["identity", "logo", "review"],
    [
      ["Print-test the thickened monoline on uncoated stock", "Dev", iso(-8, 17), "medium", true],
      ["Book the round-two review", "Rebecca", iso(2, 17), "low"],
    ],
    true,
  ),
  makeNote(
    "n-13",
    "Northwind Outdoors — brand strategy kickoff",
    "c-northwind",
    iso(-15, 9, 30),
    68,
    ["Mary Alcott", "Anna Whitfield", "Sara Lin"],
    "in-person",
    "Kickoff for the Northwind repositioning ahead of their move into technical apparel. The heritage story is an asset but it currently reads as nostalgic rather than credible. Strategy will bridge heritage to technical capability.",
    [
      "Position heritage as proof of durability, not nostalgia.",
      "Technical apparel gets its own sub-brand naming track.",
      "Strategy phase runs five weeks with two checkpoints.",
    ],
    ["Do retailers need a separate story from direct customers?"],
    ["kickoff", "strategy"],
    [
      ["Audit competitor heritage claims", "Sara", iso(-10, 17), "medium", true],
      ["Draft the naming track brief", "Mary", iso(6, 17), "medium"],
    ],
    true,
  ),
  makeNote(
    "n-14",
    "Studio ops sync — tooling and billing hygiene",
    "c-internal",
    iso(-17, 16, 30),
    31,
    ["Mary Alcott", "Priya Nair", "Sara Lin"],
    "google-meet",
    "Consolidated three overlapping project tools down to one and set a hard rule that time is logged the same day. Two invoices had slipped past 45 days; both are now chased with a written payment schedule.",
    [
      "One project tool; the other two are cancelled at renewal.",
      "Time logged same day, no exceptions.",
      "Any invoice past 30 days gets a written payment schedule.",
    ],
    [],
    ["internal", "ops", "billing"],
    [
      ["Cancel the two redundant tool subscriptions", "Priya", iso(-12, 17), "low", true],
      ["Chase the two overdue invoices", "Sara", iso(-2, 17), "high"],
    ],
  ),
];

export const actionItems: ActionItem[] = notes.flatMap((n) => n.actionItems);

export const calendar: CalendarEvent[] = [
  {
    id: "e-1",
    title: "Willow & Vine — packaging direction review",
    clientId: "c-willow",
    start: iso(0, 9, 30),
    end: iso(0, 10, 17),
    platform: "google-meet",
  },
  {
    id: "e-2",
    title: "Harbor Coffee Co. — campaign sprint planning",
    clientId: "c-harbor",
    start: iso(0, 14, 0),
    end: iso(0, 14, 38),
    platform: "zoom",
  },
  {
    id: "e-3",
    title: "Studio demos",
    clientId: "c-internal",
    start: iso(0, 15, 0),
    end: iso(0, 16, 0),
    platform: "in-person",
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

// The packaging review is the demo note with a full, timestamped transcript, so a
// few of its decisions, questions and actions point back into the recording.
const packaging = notes.find((n) => n.id === "n-1");
if (packaging) {
  packaging.decisionTimes = [571, 571, undefined, 682];
  packaging.questionTimes = [330, 665];
  const at: Record<number, number> = { 0: 665, 2: 330, 3: 665 };
  packaging.actionItems.forEach((item, i) => {
    if (at[i] !== undefined) item.atSeconds = at[i];
  });
}

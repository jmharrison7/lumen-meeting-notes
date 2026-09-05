import type { BrandDNA, Idea } from "./types";

function ago(days: number, hour = 9, minute = 12) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const seedIdeas: Idea[] = [
  {
    id: "i-1",
    title: "Harbor: seasonal cups as a collectible set",
    transcript:
      "Thinking about Harbor again on the walk home. What if the four seasonal cups aren't four separate designs but one illustration split across the set, so the regulars want the whole run? It gives the baristas something to talk about at the counter and it makes the limited edition feel earned rather than a sticker on the same cup.",
    clientId: "c-harbor",
    tags: ["packaging", "retail"],
    source: "recorded",
    durationSeconds: 41,
    createdAtISO: ago(1, 18, 40),
  },
  {
    id: "i-2",
    title: "Stop pitching moodboards first",
    transcript:
      "Note to self on how we present. We keep opening with moodboards and clients start editing taste instead of strategy. Next pitch, open with the one sentence we want their customer to say, then show work that earns it. Moodboard becomes an appendix, not the headline.",
    tags: ["process", "new business"],
    source: "typed",
    createdAtISO: ago(2, 7, 5),
  },
  {
    id: "i-3",
    title: "Willow & Vine: shelf test before the buyer meeting",
    transcript:
      "Voice memo from the car. Before the buyer presentation for Willow and Vine we should photograph Direction B on an actual shelf next to Sundry, printed at real size on kraft. Nadia can borrow the shelf from the studio kitchen. Half the argument is proximity — the deck flattens it.",
    clientId: "c-willow",
    tags: ["packaging", "presentation"],
    source: "uploaded",
    durationSeconds: 63,
    createdAtISO: ago(4, 8, 20),
  },
  {
    id: "i-4",
    title: "A studio letter, monthly",
    transcript:
      "Idea for us. One short letter a month about a decision we made and why, written in plain English, sent to the twelve people whose opinion we care about. Not a newsletter with case studies — a letter. It would keep the writing muscle warm and it's the only marketing I would actually enjoy doing.",
    clientId: "c-internal",
    tags: ["studio", "writing"],
    source: "recorded",
    durationSeconds: 55,
    createdAtISO: ago(9, 20, 30),
  },
];

const transcriptPool: { transcript: string; durationSeconds: number }[] = [
  {
    transcript:
      "Quick thought before I lose it. The onboarding for new clients should start with a two-page brand read rather than a questionnaire — we tell them what we already see, and they correct us. It's a faster way to the truth and it shows we did the work before the kickoff call.",
    durationSeconds: 38,
  },
  {
    transcript:
      "Idea for the Brightline campaign. Instead of hero shots of people mid-workout, shoot the ten minutes after — the sweat drying, the quiet, the coffee. Nobody in that category owns the aftermath, and the aftermath is the actual reason people go.",
    durationSeconds: 47,
  },
  {
    transcript:
      "Something to raise on Monday. We're accepting scope changes verbally in meetings and then absorbing them. Every change should get a one-line written confirmation the same day with a cost or a trade. Not heavy process, just a habit.",
    durationSeconds: 33,
  },
  {
    transcript:
      "Packaging thought. Warm kraft plus a single embossed mark reads as expensive because it withholds. The temptation on every project is to add one more element — the discipline is to remove the second idea entirely and let the first one breathe.",
    durationSeconds: 44,
  },
  {
    transcript:
      "Note about the site. The case studies are all outcome, no argument. Each one should open with the decision that was hard and how we landed it. That's what makes a prospective client trust us more than a nice grid of images.",
    durationSeconds: 52,
  },
];

let poolIndex = 0;
export function nextMockTranscript() {
  const item = transcriptPool[poolIndex % transcriptPool.length]!;
  poolIndex += 1;
  return item;
}

export function suggestTitle(transcript: string) {
  const first = transcript.split(/[.!?]/)[0]?.trim() ?? "";
  const words = first.split(/\s+/).slice(0, 8).join(" ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Untitled thought";
}

export const seedBrandDna: Record<string, BrandDNA> = {
  "c-harbor": {
    clientId: "c-harbor",
    voice: ["warm", "unhurried", "neighbourly", "specific about craft"],
    always: [
      "Name the origin and the roaster when we talk about a coffee",
      "Write like a barista talking across the counter",
      "Lead with the ritual, not the product",
    ],
    never: [
      "Coffee-snob vocabulary without a plain-English translation",
      "Discount-led language or urgency countdowns",
      "Stock imagery of laptops in cafés",
    ],
    tone: "Warm but precise; short sentences; never precious about coffee.",
    updatedAtISO: ago(6, 15, 10),
  },
  "c-willow": {
    clientId: "c-willow",
    voice: ["design-forward", "direct", "quietly confident", "editorial"],
    always: [
      "Show the product on a real shelf, at real size",
      "One idea per surface — the mark does the work",
      "Use plain names for colours and materials",
    ],
    never: [
      "Gradients, drop shadows or corporate jargon",
      "More than two typefaces in a layout",
      "Claims we can't put a number against",
    ],
    tone: "Confident and plain; no adjectives doing a designer's job.",
    updatedAtISO: ago(2, 11, 45),
  },
};

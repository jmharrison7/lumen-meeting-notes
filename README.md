# Lumen Meeting Notes

Build "Lumen" — a beautiful AI meeting-notes app for a creative-agency founder (Mary). It is the UI for a self-hosted meeting-capture system: her Mac records Google Meet and Zoom calls, AI (whisper + LLM) turns them into structured notes, and this app is where she reads, manages, and acts on them. Think "Granola meets Notion, but calmer and faster." The visual bar must be HIGH — this is a design-led product for someone who runs a design agency.

## Design language
- Clean, premium, editorial. Light theme default with a refined dark theme toggle (persist choice).
- Typography: a strong serif for meeting/note titles paired with a crisp sans (Inter/system) for UI. System font stacks preferred — no heavy font dependencies.
- Palette: warm paper-white background (#FAF9F6 family), near-black ink text, ONE confident accent color (deep ember/terracotta or forest green — pick one, use sparingly), subtle warm grays for chrome. Avoid generic blue SaaS vibes entirely.
- Rounded but restrained corners, hairline borders, generous whitespace, soft shadows. Motion: subtle fades/slides only (150–200ms).
- Layout: left sidebar (nav), main content, and slide-over/right panel for detail — fully responsive (sidebar collapses on tablet/mobile).

## App structure & pages
1. Sidebar nav: Today, All Notes, Action Items, Clients, Search. Bottom: settings chip ("Mary"), theme toggle. Show today's date and a subtle "record a meeting" affordance.
2. Today/Home: greeting, today's meetings from a mock calendar feed, latest notes, compact "open action items" strip (overdue/today/upcoming counts).
3. All Notes: core list. Sortable/filterable by client, tag, date, "has action items"; search box. Each row: title (serif), client chip, date + duration, AI summary (2-line clamp), tags, action-item count badge. Click → detail. Bulk select → delete/archive.
4. Note Detail (panel or route): structured note —
   - Header: title, client, date/time, duration, attendees, platform badge (Meet/Zoom), "AI transcribed" chip.
   - Sections in order: Summary (2–3 sentences), Decisions (bullets), Action Items (interactive checklist: checkbox, owner tag, due date, priority dot), Open Questions, Transcript (collapsible, collapsed by default, copy button).
   - Actions: edit inline, copy markdown, export, download transcript, delete, "mark reviewed".
   - Action items: toggle done (strike + fade), edit owner/due, "→ Teamwork" sync badge (UI state only).
5. Action Items view: grouped Overdue / Today / This week / Later / Done. Filter by client/owner. Card: text, client, note link, due date, checkbox.
6. Clients view: card grid with meeting counts, latest note snippet, tag color. Click → filtered All Notes.
7. Search: global, instant, fuzzy-ish across titles, summaries, decisions, action items. "/" focuses search; Cmd+K command palette (jump to note, mark reviewed, toggle theme). Esc closes overlays.
8. Delightful empty states everywhere with clear next action. Loading = skeletons. Friendly error state.

## Data layer (IMPORTANT — do this exactly)
- Do NOT wire Supabase or any external backend. Create a thin client layer `src/lib/api.ts` with typed functions: listNotes(), getNote(id), listClients(), listActionItems(), searchNotes(q), updateActionItem(id, patch) — each returns typed Promises. For now each resolves from `src/lib/mock-data.ts` after a 300–500ms simulated delay so skeletons show.
- Structure so mock → real HTTP is a one-file change: functions read import.meta.env.VITE_API_URL; if set, fetch from ${VITE_API_URL}/... else mock. I will wire the real endpoint later. Do not build auth pages.
- Persist UI-only state (theme, reviewed flags, checkboxes) to localStorage.

## Data model (TypeScript)
- Client: { id, name, tagColor, meetingsThisMonth?, lastMeetingAt? }

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1d35ebad-0265-4214-91d7-e10141bef06b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

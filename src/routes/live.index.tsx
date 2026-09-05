import { createFileRoute } from "@tanstack/react-router";
import { LiveNote } from "@/components/lumen/LiveNote";

export const Route = createFileRoute("/live/")({
  head: () => ({
    meta: [
      { title: "Live note — Lumen" },
      {
        name: "description",
        content:
          "The during-the-meeting view: summary, decisions and action items appear as the call happens.",
      },
      { property: "og:title", content: "Live note — Lumen" },
      {
        property: "og:description",
        content: "Watch the note write itself while the call is still running.",
      },
    ],
  }),
  component: LiveNote,
});

import { createFileRoute } from "@tanstack/react-router";
import { LiveNote } from "@/components/lumen/LiveNote";

export const Route = createFileRoute("/live/$sessionId")({
  head: () => ({
    meta: [
      { title: "Live session — Lumen" },
      {
        name: "description",
        content: "A meeting in progress: the note fills in live as the conversation moves.",
      },
      { property: "og:title", content: "Live session — Lumen" },
      {
        property: "og:description",
        content: "A meeting in progress, written up as it happens.",
      },
    ],
  }),
  component: LiveNote,
});

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listClients } from "@/lib/api";
import { TemplatesPanel } from "@/components/lumen/TemplatesPanel";
import { tagStyles } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Templates — Lumen" },
      {
        name: "description",
        content: "Estimates, brand docs, proposals and agendas — global and per client.",
      },
      { property: "og:title", content: "Templates — Lumen" },
      {
        property: "og:description",
        content: "A reusable library of estimates, proposals and brand documents.",
      },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const [client, setClient] = useState<string | undefined>(undefined);
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-title text-3xl font-semibold tracking-tight">Templates</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The documents you start from — estimates, agendas, brand shells.
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setClient(undefined)}
          className={cn(
            "rounded-full border border-hairline px-2.5 py-1 text-[11px] transition-colors",
            !client ? "bg-ember text-[oklch(0.99_0.005_85)]" : "hover:bg-accent",
          )}
        >
          All
        </button>
        {(clients.data ?? []).map((c) => (
          <button
            key={c.id}
            onClick={() => setClient(c.id)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-opacity",
              tagStyles[c.tagColor],
              client === c.id ? "ring-2 ring-ember/50" : "opacity-80 hover:opacity-100",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <TemplatesPanel clientId={client} />
    </div>
  );
}

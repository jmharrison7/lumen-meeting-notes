import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteIdea } from "@/lib/api";
import { fullDate, relativeDate } from "@/lib/format";
import type { Client, Idea } from "@/lib/types";
import { ClientChip } from "@/components/lumen/primitives";
import { IdeaSuggestion } from "@/components/lumen/IdeaSuggestion";

export function IdeasGrid({
  ideas,
  clients,
  showClient = true,
}: {
  ideas: Idea[];
  clients: Client[];
  showClient?: boolean;
}) {
  const qc = useQueryClient();

  async function remove(id: string) {
    await deleteIdea(id);
    await qc.invalidateQueries({ queryKey: ["ideas"] });
    toast.success("Idea deleted.");
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {ideas.map((i) => {
        const c = clients.find((x) => x.id === i.clientId);
        return (
          <li
            key={i.id}
            className="group flex flex-col rounded-xl border border-hairline bg-card p-4 transition-shadow hover:shadow-soft"
          >
            <div className="flex items-start gap-2">
              <Link
                to="/ideas/$ideaId"
                params={{ ideaId: i.id }}
                className="text-title min-w-0 flex-1 text-[17px] font-medium leading-snug hover:text-ember"
              >
                {i.title}
              </Link>
              <button
                onClick={() => void remove(i.id)}
                aria-label={`Delete idea ${i.title}`}
                className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {i.transcript}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              {showClient ? (
                c ? (
                  <ClientChip name={c.name} color={c.tagColor} />
                ) : (
                  <span className="rounded-full border border-hairline px-2 py-0.5">Personal</span>
                )
              ) : null}
              {i.tags.map((t) => (
                <span key={t} className="rounded-md border border-hairline bg-surface px-1.5 py-0.5">
                  {t}
                </span>
              ))}
              <span className="ml-auto capitalize" title={fullDate(i.createdAtISO)}>
                {i.source} · {relativeDate(i.createdAtISO)}
              </span>
            </div>
            <IdeaSuggestion idea={i} />
          </li>
        );
      })}
    </ul>
  );
}

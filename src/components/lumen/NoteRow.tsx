import { Link } from "@tanstack/react-router";
import { CheckSquare } from "lucide-react";
import { ClientChip, Tag } from "./primitives";
import { formatDate, formatDuration } from "@/lib/format";
import type { Client, Note } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NoteRow({
  note,
  client,
  selected,
  onSelect,
  selectMode,
}: {
  note: Note;
  client?: Client | undefined;
  selected?: boolean | undefined;
  onSelect?: ((id: string, value: boolean) => void) | undefined;
  selectMode?: boolean | undefined;
}) {
  const openItems = note.actionItems.filter((a) => !a.done).length;
  return (
    <div
      className={cn(
        "group relative border-b border-hairline transition-colors last:border-0 hover:bg-accent/40",
        selected && "bg-ember-soft/40",
      )}
    >
      <div className="flex gap-3 px-4 py-5 sm:px-5">
        {selectMode ? (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={(e) => onSelect?.(note.id, e.target.checked)}
            aria-label={`Select ${note.title}`}
            className="mt-1.5 size-4 accent-[oklch(0.53_0.145_42)]"
          />
        ) : null}
        <Link
          to="/notes/$noteId"
          params={{ noteId: note.id }}
          className="min-w-0 flex-1 focus:outline-none"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
            <h3 className="text-title text-[17px] font-semibold leading-snug text-foreground">
              {note.title}
            </h3>
            {client ? <ClientChip name={client.name} color={client.tagColor} /> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(note.date)} · {formatDuration(note.durationMinutes)}
            {note.reviewed ? " · reviewed" : ""}
          </p>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {note.summary}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {note.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
            {openItems > 0 ? (
              <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-ember-soft px-1.5 py-0.5 text-[11px] font-medium text-ember">
                <CheckSquare className="size-3" />
                {openItems} open
              </span>
            ) : null}
          </div>
        </Link>
      </div>
    </div>
  );
}

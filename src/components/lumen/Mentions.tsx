import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronDown } from "lucide-react";
import { getMentionHits } from "@/lib/api";
import { cn } from "@/lib/utils";

function mmss(s?: number) {
  if (s === undefined) return null;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function useMentions(noteId: string) {
  return useQuery({ queryKey: ["mentions", noteId], queryFn: () => getMentionHits(noteId) });
}

/** Tiny bell glyph for note rows. */
export function AlertGlyph({ noteId }: { noteId: string }) {
  const { data } = useMentions(noteId);
  if (!data || data.length === 0) return null;
  const top = data.slice(0, 3).map((h) => h.term).join(", ");
  return (
    <span
      title={`Flagged: ${top}`}
      aria-label={`Flagged mentions: ${top}`}
      className="relative inline-flex items-center text-muted-foreground"
    >
      <Bell className="size-3.5" />
      <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-ember" />
    </span>
  );
}

/** Banner above the note summary listing flagged mentions. */
export function MentionBanner({ noteId }: { noteId: string }) {
  const { data } = useMentions(noteId);
  const [open, setOpen] = useState(false);
  if (!data || data.length === 0) return null;
  const terms = data.map((h) => h.term);

  return (
    <div className="rounded-xl border border-hairline bg-ember-soft/50 px-4 py-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left text-sm"
      >
        <Bell className="size-4 text-ember" />
        <span>
          {data.length} mention{data.length === 1 ? "" : "s"} flagged —{" "}
          <span className="text-muted-foreground">{terms.slice(0, 3).join(", ").toLowerCase()}</span>
        </span>
        <ChevronDown
          className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <ul className="mt-3 space-y-2.5 animate-[fade-in_160ms_ease-out]">
          {data.map((h, i) => (
            <li key={`${h.term}-${i}`} className="rounded-lg bg-card px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-ember-soft px-2 py-0.5 text-[11px] font-medium text-ember">
                  {h.term}
                </span>
                {h.atSeconds !== undefined ? (
                  <a
                    href="#transcript"
                    className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-ember"
                  >
                    transcript @ {mmss(h.atSeconds)}
                  </a>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{h.snippet}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

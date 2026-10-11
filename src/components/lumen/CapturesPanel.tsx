import { FileText, Mic } from "lucide-react";
import { fullDate, relativeDate } from "@/lib/format";
import type { Capture, CaptureStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState, SectionTitle, Tag } from "./primitives";

const statusLabel: Record<CaptureStatus, string> = {
  received: "Received",
  filed: "Filed",
  actions: "To-dos created",
  complete: "Complete",
};

const statusTone: Record<CaptureStatus, string> = {
  received: "text-muted-foreground",
  filed: "text-muted-foreground",
  actions: "text-ember",
  complete: "text-ember",
};

const AUDIO_EXT = /\.(mp3|m4a|m4b|wav|webm|ogg|oga|opus|aac|flac|aiff?)$/i;

function isAudio(c: Capture) {
  return (c.mime ?? "").startsWith("audio/") || AUDIO_EXT.test(c.name);
}

function CaptureRow({ c }: { c: Capture }) {
  const Icon = isAudio(c) ? Mic : FileText;
  return (
    <li className="flex items-start gap-3 border-b border-hairline px-4 py-3.5 last:border-0">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</p>
          <span className={cn("shrink-0 text-[11px] font-medium", statusTone[c.status])}>
            {statusLabel[c.status]}
            {c.actionsTotal > 0 ? ` · ${c.actionsDone}/${c.actionsTotal}` : ""}
          </span>
        </div>
        {c.excerpt ? (
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
            {c.excerpt}
          </p>
        ) : (
          <p className="mt-1 text-[13px] italic text-muted-foreground">Waiting on transcription…</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span title={fullDate(c.createdAtISO)}>{relativeDate(c.createdAtISO)}</span>
          {c.chars ? (
            <>
              <span>·</span>
              <span>{c.chars.toLocaleString()} chars</span>
            </>
          ) : null}
          {c.tags.slice(0, 4).map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      </div>
    </li>
  );
}

export function CapturesPanel({
  captures,
  title = "Memos & uploads",
}: {
  captures: Capture[];
  title?: string;
}) {
  if (!captures.length)
    return (
      <EmptyState
        title="No memos yet"
        body="Record or upload a voice memo above — it lands here with its status."
      />
    );
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <SectionTitle>{title}</SectionTitle>
        <span className="text-[11px] text-muted-foreground">
          {captures.length} item{captures.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="overflow-hidden rounded-xl border border-hairline bg-card">
        {captures.map((c) => (
          <CaptureRow key={c.id} c={c} />
        ))}
      </ul>
    </section>
  );
}

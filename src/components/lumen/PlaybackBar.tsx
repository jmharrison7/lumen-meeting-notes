import { useEffect, useRef, useState } from "react";
import { CornerDownLeft, Pause, Play, Rewind, FastForward, X, Clock3 } from "lucide-react";
import { clock } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Small muted chip that opens playback at a given second. */
export function TimeChip({
  seconds,
  onPlay,
  className,
}: {
  seconds: number;
  onPlay: (s: number) => void;
  className?: string;
}) {
  return (
    <button
      onClick={() => onPlay(seconds)}
      aria-label={`Play the meeting audio from ${clock(seconds)}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border border-hairline bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-ember/40 hover:bg-ember-soft hover:text-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      <Clock3 className="size-3" />
      {clock(seconds)}
    </button>
  );
}

export function PlaybackBar({
  label,
  startAt,
  durationSeconds,
  onClose,
  onBackToNote,
}: {
  label: string;
  startAt: number;
  durationSeconds: number;
  onClose: () => void;
  onBackToNote?: (() => void) | undefined;
}) {
  const [position, setPosition] = useState(startAt);
  const [playing, setPlaying] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setPosition(startAt);
    setPlaying(true);
    setExpanded(true);
  }, [startAt]);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setPosition((p) => {
        if (p + 1 >= durationSeconds) {
          setPlaying(false);
          return durationSeconds;
        }
        return p + 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, durationSeconds]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((v) => !v);
      } else if (e.key === "ArrowRight") {
        setPosition((p) => Math.min(durationSeconds, p + 5));
      } else if (e.key === "ArrowLeft") {
        setPosition((p) => Math.max(0, p - 5));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [durationSeconds]);

  if (!expanded)
    return (
      <div className="fixed bottom-[calc(112px+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 md:bottom-6">
        <button
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-card px-3 py-2 text-xs shadow-lg"
        >
          <Play className="size-3.5 text-ember" /> {clock(position)}
        </button>
      </div>
    );

  return (
    <div
      className="fixed inset-x-0 bottom-[calc(112px+env(safe-area-inset-bottom))] z-40 animate-[rise_180ms_ease-out] border-t border-hairline bg-background/95 px-3 py-2.5 backdrop-blur md:bottom-0 md:px-6"
      title="Demo tone — real audio streams from your archive"
      role="region"
      aria-label="Meeting audio playback"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPlaying((v) => !v)}
            aria-label={playing ? "Pause meeting audio" : "Play meeting audio"}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-ember text-[oklch(0.99_0.005_85)]"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            onClick={() => setPosition((p) => Math.max(0, p - 5))}
            aria-label="Back five seconds"
            className="grid size-9 place-items-center rounded-lg border border-hairline text-muted-foreground hover:bg-accent"
          >
            <Rewind className="size-3.5" />
          </button>
          <button
            onClick={() => setPosition((p) => Math.min(durationSeconds, p + 5))}
            aria-label="Forward five seconds"
            className="grid size-9 place-items-center rounded-lg border border-hairline text-muted-foreground hover:bg-accent"
          >
            <FastForward className="size-3.5" />
          </button>
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {label} · {clock(position)}
            <span className="ml-1.5 rounded bg-ember-soft px-1 py-0.5 text-[10px] text-ember">
              demo audio
            </span>
          </p>
          {onBackToNote ? (
            <button
              onClick={onBackToNote}
              className="hidden items-center gap-1 rounded-md border border-hairline px-2 py-1 text-[11px] text-muted-foreground hover:text-ember sm:inline-flex"
            >
              <CornerDownLeft className="size-3" /> back to note
            </button>
          ) : null}
          <button
            onClick={onClose}
            aria-label="Close playback"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
          <span>{clock(position)}</span>
          <input
            type="range"
            min={0}
            max={durationSeconds}
            value={position}
            aria-label="Seek within the meeting audio"
            onChange={(e) => setPosition(Number(e.target.value))}
            className={cn(
              "h-1 flex-1 cursor-pointer appearance-none rounded-full bg-hairline accent-[oklch(0.53_0.145_42)]",
              playing && "animate-pulse",
            )}
          />
          <span>{clock(durationSeconds)}</span>
        </div>
      </div>
    </div>
  );
}

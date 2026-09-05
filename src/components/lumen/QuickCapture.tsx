import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, Square, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { createIdea, listClients, titleFromTranscript, transcribeAudio } from "@/lib/api";
import { clock } from "@/lib/format";
import type { IdeaSource } from "@/lib/types";
import { cn } from "@/lib/utils";

type Draft = {
  transcript: string;
  source: IdeaSource;
  durationSeconds?: number | undefined;
  fileLabel?: string | undefined;
};

export function QuickCapture({ defaultClientId }: { defaultClientId?: string }) {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [typed, setTyped] = useState("");
  const [title, setTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function handleBlob(blob: Blob, source: IdeaSource, seconds?: number, label?: string) {
    setTranscribing(true);
    try {
      const res = await transcribeAudio(blob);
      const draftNext: Draft = {
        transcript: res.transcript,
        source,
        durationSeconds: seconds ?? res.durationSeconds,
        fileLabel: label,
      };
      setDraft(draftNext);
      setTitle(titleFromTranscript(res.transcript));
    } catch {
      toast.error("That recording couldn't be transcribed. Try uploading it instead.");
    } finally {
      setTranscribing(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        void handleBlob(blob, "recorded", elapsed);
      };
      recorderRef.current = rec;
      rec.start();
      setElapsed(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      toast.error("Lumen can't reach your microphone", {
        description: "Allow mic access in your browser, or upload a voice memo instead.",
      });
    }
  }

  function stopRecording() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
    recorderRef.current?.stop();
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const size = `${(file.size / 1024 / 1024).toFixed(1)} MB`;
    void handleBlob(file, "uploaded", undefined, `${file.name} · ${size}`);
  }

  function startTyped() {
    if (!typed.trim()) return;
    setDraft({ transcript: typed.trim(), source: "typed" });
    setTitle(titleFromTranscript(typed.trim()));
    setTyped("");
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (!t || tags.includes(t)) return setTagInput("");
    setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function reset() {
    setDraft(null);
    setTitle("");
    setTags([]);
    setTagInput("");
    setClientId(defaultClientId ?? "");
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await createIdea({
        title: title.trim() || titleFromTranscript(draft.transcript),
        transcript: draft.transcript,
        clientId: clientId || undefined,
        tags,
        source: draft.source,
        durationSeconds: draft.durationSeconds,
      });
      await qc.invalidateQueries({ queryKey: ["ideas"] });
      toast.success("Caught it.");
      reset();
    } catch {
      toast.error("That idea didn't save. Try once more.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-hairline bg-card p-5 shadow-soft">
      {!draft ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={recording ? stopRecording : () => void startRecording()}
              disabled={transcribing}
              aria-label={recording ? "Stop recording" : "Tap to record a thought"}
              className={cn(
                "inline-flex min-h-[52px] items-center gap-2.5 rounded-full px-5 text-sm font-medium transition-colors",
                recording
                  ? "bg-destructive text-[oklch(0.99_0.005_85)]"
                  : "bg-ember text-[oklch(0.99_0.005_85)] hover:opacity-90",
                transcribing && "opacity-60",
              )}
            >
              {recording ? (
                <>
                  <Square className="size-4 fill-current" />
                  Stop
                  <span className="tabular-nums opacity-90">{clock(elapsed)}</span>
                </>
              ) : (
                <>
                  <Mic className="size-4" /> Tap to record a thought
                </>
              )}
            </button>
            {recording ? (
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-2.5 animate-pulse rounded-full bg-destructive" />
                Listening — say it before it&apos;s gone
              </span>
            ) : null}

            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-sm text-muted-foreground transition-colors hover:border-ember/40 hover:text-ember">
              <Upload className="size-4" /> Upload voice memo
              <input
                type="file"
                accept="audio/*,.m4a,.mp3,.wav"
                className="sr-only"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  startTyped();
                }
              }}
              placeholder="…or type it"
              aria-label="Type an idea"
              className="min-h-[44px] flex-1 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
            />
            <button
              onClick={startTyped}
              disabled={!typed.trim()}
              className="min-h-[44px] rounded-lg border border-hairline px-3 text-sm transition-colors hover:border-ember/40 hover:text-ember disabled:opacity-40"
            >
              Capture
            </button>
          </div>

          {transcribing ? (
            <div className="space-y-2 rounded-xl border border-hairline bg-surface p-4">
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Transcribing…
              </p>
              <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
              {draft.source}
              {draft.durationSeconds ? ` · ${clock(draft.durationSeconds)}` : ""}
            </span>
            {draft.fileLabel ? (
              <span className="truncate text-[11px] text-muted-foreground">{draft.fileLabel}</span>
            ) : null}
            <button
              onClick={reset}
              aria-label="Discard this capture"
              className="ml-auto rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            aria-label="Idea title"
            className="text-title w-full rounded-lg border border-hairline bg-surface px-3 py-2.5 text-lg outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
          />
          <textarea
            value={draft.transcript}
            onChange={(e) => setDraft({ ...draft, transcript: e.target.value })}
            rows={5}
            aria-label="Idea transcript"
            className="w-full rounded-lg border border-hairline bg-surface p-3 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
          />

          <div className="flex flex-wrap items-center gap-2">
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2 py-1 text-[11px] text-muted-foreground hover:text-ember"
                aria-label={`Remove tag ${t}`}
              >
                {t} <X className="size-3" />
              </button>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add a tag"
              aria-label="Add a tag"
              className="min-h-[38px] w-32 rounded-lg border border-hairline bg-surface px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
            />
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              aria-label="Assign to a client"
              className="ml-auto min-h-[38px] rounded-lg border border-hairline bg-surface px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
            >
              <option value="">Personal / General</option>
              {(clients.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-ember px-4 text-sm font-medium text-[oklch(0.99_0.005_85)] disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null} Save idea
            </button>
            <button
              onClick={reset}
              className="min-h-[44px] rounded-lg border border-hairline px-3 text-sm text-muted-foreground hover:text-foreground"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

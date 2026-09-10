import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, Square, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  createIdea,
  titleFromTranscript,
  transcribeAudio,
} from "@/lib/api";
import { clock } from "@/lib/format";
import type { IdeaSource } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClientSelect } from "@/components/lumen/ClientSelect";
import type { ClientScope } from "@/lib/types";

type Draft = {
  transcript: string;
  source: IdeaSource;
  durationSeconds?: number | undefined;
  fileLabel?: string | undefined;
};

const LOOPBACK_INPUT_NAMES = ["lumen meeting audio", "loopback"];

function isPreferredMeetingInput(device: MediaDeviceInfo) {
  const label = device.label.toLowerCase();
  return device.kind === "audioinput" && LOOPBACK_INPUT_NAMES.some((name) => label.includes(name));
}

export function QuickCapture({
  defaultClientId,
  scope = "work",
  heading = "Quick capture",
  recordLabel = "Tap to record a thought",
  listeningLabel = "Listening — say it before it's gone",
  typePlaceholder = "…or type it",
  assignLabel,
  autoStart = false,
  seedClientId,
  seedTitle,
}: {
  defaultClientId?: string | undefined;
  scope?: ClientScope;
  heading?: string;
  recordLabel?: string;
  listeningLabel?: string;
  typePlaceholder?: string;
  assignLabel?: string | undefined;
  /** Opened from the persistent sidebar/mobile record control — start recording on mount. */
  autoStart?: boolean;
  seedClientId?: string | undefined;
  seedTitle?: string | undefined;
}) {
  const qc = useQueryClient();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [typed, setTyped] = useState("");
  const [title, setTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [audioInputLabel, setAudioInputLabel] = useState("");
  const [loopbackMissing, setLoopbackMissing] = useState(false);
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [newClient, setNewClient] = useState<{ name: string; note?: string } | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  /** Multi-file uploads: transcribe one at a time so each note keeps its own title/client/tags. */
  const [queue, setQueue] = useState<{ file: File; label: string }[]>([]);
  const [queuePos, setQueuePos] = useState(0);

  const sectionRef = useRef<HTMLElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const meetingTitleRef = useRef<string | null>(null);
  const lastBlobRef = useRef<Blob | null>(null);

  async function getMeetingAudioStream() {
    const first = await navigator.mediaDevices.getUserMedia({ audio: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    const preferred = devices.find(isPreferredMeetingInput);
    if (!preferred?.deviceId) {
      const track = first.getAudioTracks()[0];
      setAudioInputLabel(track?.label || "Default microphone");
      setLoopbackMissing(true);
      return first;
    }

    first.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: preferred.deviceId } },
      });
      const track = stream.getAudioTracks()[0];
      setAudioInputLabel(track?.label || preferred.label || "Lumen Meeting Audio");
      setLoopbackMissing(false);
      return stream;
    } catch {
      const fallback = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = fallback.getAudioTracks()[0];
      setAudioInputLabel(track?.label || "Default microphone");
      setLoopbackMissing(true);
      return fallback;
    }
  }


  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const onStart = () => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (!recording && !transcribing && !draft) void startRecording();
    };
    window.addEventListener("lumen:start-recording", onStart);

    const onMeetingStart = (ev: Event) => {
      const detail = ((ev as CustomEvent).detail || {}) as {
        clientId?: string;
        title?: string;
      };
      // Seed the capture for a specific calendar meeting, then start recording.
      if (detail.clientId) setClientId(detail.clientId);
      meetingTitleRef.current = detail.title || null;
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (!recording && !transcribing && !draft) {
        window.setTimeout(() => void startRecording(), 150); // allow state to settle
      }
    };
    window.addEventListener("lumen:start-meeting-recording", onMeetingStart);

    const pending = window.sessionStorage.getItem("lumen.startRecordingOnToday");
    if (pending) {
      window.sessionStorage.removeItem("lumen.startRecordingOnToday");
      window.setTimeout(onStart, 100);
    }

    return () => {
      window.removeEventListener("lumen:start-recording", onStart);
      window.removeEventListener("lumen:start-meeting-recording", onMeetingStart);
    };
  }, [draft, recording, transcribing]);

  // Opened from the sidebar/mobile record control (the centre capture card was removed
  // from Today at Mary's request) — seed any meeting context, then roll straight away.
  useEffect(() => {
    if (!autoStart) return;
    if (seedClientId) setClientId(seedClientId);
    if (seedTitle) meetingTitleRef.current = seedTitle;
    const t = window.setTimeout(() => {
      if (!recording && !transcribing && !draft) void startRecording();
    }, 150);
    return () => window.clearTimeout(t);
  }, [autoStart, seedClientId, seedTitle]);

  async function handleBlob(blob: Blob, source: IdeaSource, seconds?: number, label?: string) {
    setTranscribing(true);
    try {
  const speakers: string[] = [];
      const res = await transcribeAudio(blob, speakers);
      lastBlobRef.current = source === "recorded" || source === "uploaded" ? blob : null;
      const draftNext: Draft = {
        transcript: res.transcript,
        source,
        durationSeconds: seconds ?? res.durationSeconds,
        fileLabel: label,
      };
      setDraft(draftNext);
      // A meeting-seeded capture keeps its calendar title instead of an auto one.
      if (meetingTitleRef.current) {
        setTitle(meetingTitleRef.current);
        meetingTitleRef.current = null;
      } else {
        setTitle(titleFromTranscript(res.transcript));
      }
    } catch {
      toast.error("That recording couldn't be transcribed. Try uploading it instead.");
    } finally {
      setTranscribing(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await getMeetingAudioStream();
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

  /**
   * Multi-select upload. The picker used to take only `files[0]`, so choosing several notes
   * silently discarded all but the first. Now the extra files are queued and transcribed one
   * at a time, and each still lands in the draft for review before it saves.
   */
  function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const items = Array.from(files).map((f) => ({
      file: f,
      label: `${f.name} · ${(f.size / 1024 / 1024).toFixed(1)} MB`,
    }));
    if (items.length === 1) {
      const only = items[0];
      if (only) onFile(only.file);
      return;
    }
    setQueue(items);
    setQueuePos(0);
    const first = items[0];
    if (first) void handleBlob(first.file, "uploaded", undefined, first.label);
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
    setNewClient(undefined);
    meetingTitleRef.current = null;
    lastBlobRef.current = null;
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
        ...(newClient?.name.trim() ? { createClient: { name: newClient.name, note: newClient.note, scope } } : {}),
      });
      await qc.invalidateQueries({ queryKey: ["ideas"] });
      await qc.invalidateQueries({ queryKey: ["clients"] });
      const next = queuePos + 1;
      const queued = queue[next];
      if (queued) {
        setQueuePos(next);
        reset();
        toast.success(`Saved ${next} of ${queue.length} — loading the next one.`);
        void handleBlob(queued.file, "uploaded", undefined, queued.label);
      } else {
        const total = queue.length;
        setQueue([]);
        setQueuePos(0);
        toast.success(total > 1 ? `All ${total} notes saved.` : "Caught it.");
        reset();
      }
    } catch {
      toast.error("That idea didn't save. Try once more.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section ref={sectionRef} className="rounded-2xl border border-hairline bg-card p-5 shadow-soft">
      <h2 className="text-title mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {heading}
      </h2>
      {!draft ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={recording ? stopRecording : () => void startRecording()}
              disabled={transcribing}
              aria-label={recording ? "Stop recording" : recordLabel}
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
                  <Mic className="size-4" /> {recordLabel}
                </>
              )}
            </button>
            {recording ? (
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-2.5 animate-pulse rounded-full bg-destructive" />
                {listeningLabel}
              </span>
            ) : null}
            {audioInputLabel ? (
              <span className="text-xs text-muted-foreground">
                {loopbackMissing ? "Mic fallback" : "Meeting audio"}: {audioInputLabel}
              </span>
            ) : null}

            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-sm text-muted-foreground transition-colors hover:border-ember/40 hover:text-ember">
              <Upload className="size-4" /> Upload voice memo
              <input
                type="file"
                multiple
                accept="audio/*,.m4a,.mp3,.wav"
                className="sr-only"
                onChange={(e) => {
                  onFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {queue.length > 1 ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                Note {queuePos + 1} of {queue.length}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <textarea
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  startTyped();
                }
              }}
              rows={4}
              placeholder={typePlaceholder}
              aria-label="Type an idea"
              className="min-h-[104px] flex-1 resize-y rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
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
            <div className="ml-auto w-full sm:w-auto">
          <ClientSelect
            value={clientId}
            newClient={newClient}
            scope={scope}
            label={assignLabel ?? (scope === "personal" ? "Assign to an area" : "Assign to a client")}
            onChange={(choice) => {
              setClientId(choice.clientId ?? "");
              setNewClient(choice.newClient);
                }}
              />
            </div>
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

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, Square, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  createIdea,
  deleteVoiceprint,
  enrollVoiceprint,
  enrollVoiceprintSpeaker,
  listContacts,
  listVoiceprints,
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

const VOICE_ENROLLMENT_PROMPT =
  "Today I'm testing Lumen's voice memory so it can recognize me clearly in future recordings. I'm speaking at my normal pace, with my normal tone, in a quiet room. The quick brown fox jumps over the lazy dog, but honestly I'd rather talk about weekend plans, client notes, house projects, and getting useful work done without extra hassle. If Lumen hears this correctly, it should remember my voice and label me correctly next time.";
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
}: {
  defaultClientId?: string | undefined;
  scope?: ClientScope;
  heading?: string;
  recordLabel?: string;
  listeningLabel?: string;
  typePlaceholder?: string;
  assignLabel?: string | undefined;
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
  const [speakerInput, setSpeakerInput] = useState("");
  const [audioInputLabel, setAudioInputLabel] = useState("");
  const [loopbackMissing, setLoopbackMissing] = useState(false);
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [newClient, setNewClient] = useState<{ name: string; note?: string } | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const seededForRef = useRef<string | null>(null);
  const meetingTitleRef = useRef<string | null>(null);
  const lastBlobRef = useRef<Blob | null>(null);
  const enrollTargetRef = useRef<string | null>(null);

  // Enrolled voiceprints (people Lumen already recognizes by voice)
  const [voiceprints, setVoiceprints] = useState<string[]>([]);
  const [vpOpen, setVpOpen] = useState(false);
  const [vpName, setVpName] = useState("");
  const [vpBusy, setVpBusy] = useState(false);
  const [enrollMode, setEnrollMode] = useState(false);
  // Unidentified diarized speakers from the last audio capture ("Speaker 2" etc.)
  const [unidentified, setUnidentified] = useState<{ label: string; sample: string }[]>([]);
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});
  const [identifying, setIdentifying] = useState<string | null>(null);

  const refreshVoiceprints = () =>
    listVoiceprints()
      .then((rows) => setVoiceprints(rows.map((r) => r.name)))
      .catch(() => {});

  useEffect(() => {
    void refreshVoiceprints();
  }, []);

  async function enrollBlob(name: string, blob: Blob) {
    setVpBusy(true);
    try {
      await enrollVoiceprint(name, blob);
      toast.success(`Saved ${name}'s voice — auto-recognized in future meetings`);
      setVpName("");
      setVpOpen(false);
      void refreshVoiceprints();
    } catch {
      toast.error("Couldn't save that voiceprint. Try a cleaner clip.");
    } finally {
      setVpBusy(false);
    }
  }

  async function removeVoiceprint(name: string) {
    try {
      await deleteVoiceprint(name);
      toast.success(`Forgot ${name}'s voice`);
      void refreshVoiceprints();
    } catch {
      toast.error("Couldn't remove that voiceprint.");
    }
  }

  // Enroll ONE speaker from a meeting recording — no separate clip needed.
  async function saveMeetingSpeaker(label: string) {
    const name = (speakerNames[label] ?? "").trim();
    const blob = lastBlobRef.current;
    if (!name || !blob) return;
    const num = label.replace(/\D/g, "");
    setIdentifying(label);
    try {
      await enrollVoiceprintSpeaker(name, num, blob);
      toast.success(`Saved ${name}'s voice from this recording`);
      setDraft((d) =>
        d
          ? {
              ...d,
              transcript: d.transcript
                .split("\n")
                .map((line) => (line.startsWith(`${label}:`) ? `${name}:${line.slice(label.length + 1)}` : line))
                .join("\n"),
            }
          : d,
      );
      setUnidentified((prev) => prev.filter((u) => u.label !== label));
      setSpeakerNames((prev) => {
        const next = { ...prev };
        delete next[label];
        return next;
      });
      void refreshVoiceprints();
    } catch {
      toast.error("Couldn't save that voice. Try again with a clearer recording.");
    } finally {
      setIdentifying(null);
    }
  }

  function startEnrollCapture() {
    if (!vpName.trim()) return;
    enrollTargetRef.current = vpName.trim();
    setEnrollMode(true);
    void startRecording();
  }

  function enrollUpload(file: File | undefined) {
    if (!file || !vpName.trim()) return;
    void enrollBlob(vpName.trim(), file);
  }

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


  // Auto-fill the Known speakers list from the selected client's address-book
  // contacts (frequent meeting participants) the first time that client is active.
  useEffect(() => {
    if (!clientId) {
      seededForRef.current = null;
      return;
    }
    if (seededForRef.current === clientId) return;
    let cancelled = false;
    listContacts(clientId)
      .then((rows) => {
        if (cancelled || seededForRef.current === clientId) return;
        const names = [...new Set(rows.map((c) => c.name.trim()).filter(Boolean))].slice(0, 12);
        if (names.length) {
          setSpeakerInput(names.join(", "));
          seededForRef.current = clientId;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [clientId]);

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
      seededForRef.current = null; // let speaker-list auto-fill pick up the new client
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

  async function handleBlob(blob: Blob, source: IdeaSource, seconds?: number, label?: string) {
    setTranscribing(true);
    setUnidentified([]);
    setSpeakerNames({});
    try {
      const speakers = speakerInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
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
      // Offer to name diarized speakers Lumen couldn't match (voiceprint or LLM).
      if (res.diarizationStatus === "ok" && lastBlobRef.current) {
        const matched = new Set(Object.keys(res.voiceprintMatches ?? {}));
        const lines = (res.transcript ?? "").split("\n");
        const seen: string[] = [];
        const list: { label: string; sample: string }[] = [];
        for (const turn of res.speakerSegments ?? []) {
          const sp = (turn.speaker ?? "").trim();
          if (!/^Speaker\s*\d+$/i.test(sp)) continue;
          if (matched.has(sp)) continue;
          if (!lines.some((l) => l.startsWith(`${sp}:`))) continue;
          if (seen.includes(sp)) continue;
          seen.push(sp);
          const s = (res.segments ?? []).find(
            (g) => g.speaker === sp && (g.text ?? "").trim(),
          );
          list.push({ label: sp, sample: ((s?.text ?? "").trim() || "").slice(0, 90) });
        }
        setUnidentified(list);
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
        const enrollName = enrollTargetRef.current;
        if (enrollName) {
          enrollTargetRef.current = null;
          setEnrollMode(false);
          void enrollBlob(enrollName, blob);
          return;
        }
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
    setNewClient(undefined);
    meetingTitleRef.current = null;
    setUnidentified([]);
    setSpeakerNames({});
    lastBlobRef.current = null;
    enrollTargetRef.current = null;
    setEnrollMode(false);
    setVpName("");
    setVpOpen(false);
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
      toast.success("Caught it.");
      reset();
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
              placeholder={typePlaceholder}
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

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="speaker-guide">
              Known speakers
            </label>
            <input
              id="speaker-guide"
              value={speakerInput}
              onChange={(e) => setSpeakerInput(e.target.value)}
              placeholder="Mary, Josh, Daniella"
              className="min-h-[42px] w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
            />
          </div>

          <div className="rounded-xl border border-hairline bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Voice memory — people Lumen knows by voice</p>
              <button
                onClick={() => {
                  if (recording && !enrollMode) stopRecording();
                  setVpOpen((o) => !o);
                }}
                className="text-xs font-medium text-ember hover:underline"
              >
                {vpOpen ? "Done" : "+ Enroll a voice"}
              </button>
            </div>
            {voiceprints.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {voiceprints.map((n) => (
                  <span
                    key={n}
                    className="inline-flex items-center gap-1 rounded-full border border-hairline bg-card px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {n}
                    <button
                      onClick={() => void removeVoiceprint(n)}
                      aria-label={`Forget ${n}'s voice`}
                      className="transition-colors hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {vpOpen ? (
              <div className="mt-2 space-y-2 border-t border-hairline pt-2">
                <input
                  value={vpName}
                  onChange={(e) => setVpName(e.target.value)}
                  placeholder="Their name (e.g., Daniella Clark)"
                  aria-label="Name for the voiceprint"
                  className="min-h-[40px] w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
                />
                <div className="rounded-lg border border-hairline bg-card p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Read this aloud
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {VOICE_ENROLLMENT_PROMPT}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => (recording && enrollMode ? stopRecording() : startEnrollCapture())}
                    disabled={(!vpName.trim() && !recording) || vpBusy}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-ember px-3 text-xs font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {recording && enrollMode ? (
                      <>
                        <Square className="size-3.5 fill-current" /> Stop & save
                      </>
                    ) : (
                      <>
                        <Mic className="size-3.5" /> Record 10–30s clip
                      </>
                    )}
                  </button>
                  <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 text-xs text-muted-foreground transition-colors hover:border-ember/40 hover:text-ember">
                    <Upload className="size-3.5" /> Upload clip
                    <input
                      type="file"
                      accept="audio/*,.m4a,.mp3,.wav"
                      className="sr-only"
                      onChange={(e) => {
                        enrollUpload(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {vpBusy ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Have the person talk alone for ~15s — Lumen will recognize them in every meeting afterwards.
                </p>
              </div>
            ) : null}
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

          {unidentified.length > 0 && lastBlobRef.current && draft.source !== "typed" ? (
            <div className="space-y-2 rounded-xl border border-ember/30 bg-ember-soft/40 p-3">
              <p className="text-xs font-medium text-ember">New voices — name them to remember their voice</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Type a name and save — Lumen enrolls their voiceprint from this recording, so no separate
                enrollment clip is needed.
              </p>
              {unidentified.map((u) => (
                <div key={u.label} className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-hairline bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                    {u.label}
                  </span>
                  {u.sample ? (
                    <span className="max-w-[240px] truncate text-[11px] italic text-muted-foreground">
                      “{u.sample}”
                    </span>
                  ) : null}
                  <input
                    value={speakerNames[u.label] ?? ""}
                    onChange={(e) =>
                      setSpeakerNames((prev) => ({ ...prev, [u.label]: e.target.value }))
                    }
                    placeholder="Their name (e.g., Daniella Clark)"
                    aria-label={`Name for ${u.label}`}
                    className="min-h-[38px] flex-1 rounded-lg border border-hairline bg-surface px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
                  />
                  <button
                    onClick={() => void saveMeetingSpeaker(u.label)}
                    disabled={!(speakerNames[u.label] ?? "").trim() || identifying === u.label}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-ember px-3 text-xs font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {identifying === u.label ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Mic className="size-3.5" />
                    )}
                    Save voice
                  </button>
                </div>
              ))}
            </div>
          ) : null}

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

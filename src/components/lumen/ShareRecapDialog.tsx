import { useMemo, useState } from "react";
import { Check, Link2, Mail, Send, Type } from "lucide-react";
import { toast } from "sonner";
import { buildRecap, shareRecap } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import type { Note, ShareChannel } from "@/lib/types";

const TEAM_ALIAS = "studio@lumen.work";

function emailFor(name: string) {
  return `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`;
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function ShareRecapDialog({
  note,
  clientName,
  open,
  onOpenChange,
}: {
  note: Note;
  clientName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { markShared } = useUi();
  const attendees = useMemo(
    () => note.attendees.map((a) => ({ name: a, email: emailFor(a) })),
    [note.attendees],
  );
  const [selected, setSelected] = useState<string[]>(() =>
    attendees.filter((a) => a.name !== "Mary Alcott").map((a) => a.email),
  );
  const [includeTeam, setIncludeTeam] = useState(false);
  const [manual, setManual] = useState("");
  const [extra, setExtra] = useState<string[]>([]);
  const [channel, setChannel] = useState<ShareChannel>("email");
  const [sending, setSending] = useState(false);

  const recap = useMemo(() => buildRecap(note, clientName), [note, clientName]);
  const recipients = [...selected, ...extra];
  const canSend = channel !== "email" || recipients.length > 0 || includeTeam;

  function toggle(email: string) {
    setSelected((s) => (s.includes(email) ? s.filter((e) => e !== email) : [...s, email]));
  }

  function addManual() {
    const v = manual.trim();
    if (!isEmail(v)) {
      toast.error("That doesn't look like an email address");
      return;
    }
    setExtra((e) => [...new Set([...e, v])]);
    setManual("");
  }

  async function submit() {
    setSending(true);
    try {
      const result = await shareRecap(note.id, { recipients, includeTeam, channel });
      markShared(note.id, new Date().toISOString());
      if (result.channel === "email")
        toast.success(`Recap sent to ${(result.sentTo ?? []).join(", ")}`);
      if (result.channel === "link" && result.link) {
        await navigator.clipboard.writeText(`${window.location.origin}${result.link}`);
        toast.success("Link copied");
      }
      if (result.channel === "text" && result.text) {
        await navigator.clipboard.writeText(result.text);
        toast.success("Recap copied");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't share that recap — try again");
    } finally {
      setSending(false);
    }
  }

  const channels: { key: ShareChannel; label: string; icon: typeof Mail }[] = [
    { key: "email", label: "Email", icon: Mail },
    { key: "link", label: "Copy link", icon: Link2 },
    { key: "text", label: "Copy text", icon: Type },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-title text-xl">Share recap</DialogTitle>
          <DialogDescription className="text-xs">{note.title}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Recipients
            </p>
            <div className="flex flex-wrap gap-2">
              {attendees.map((a) => (
                <button
                  key={a.email}
                  onClick={() => toggle(a.email)}
                  aria-pressed={selected.includes(a.email)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                    selected.includes(a.email)
                      ? "border-ember/40 bg-ember-soft text-ember"
                      : "border-hairline hover:bg-accent",
                  )}
                >
                  {selected.includes(a.email) ? <Check className="size-3" /> : null}
                  {a.name}
                </button>
              ))}
              {extra.map((e) => (
                <span
                  key={e}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ember/40 bg-ember-soft px-3 py-1.5 text-xs text-ember"
                >
                  {e}
                  <button onClick={() => setExtra((x) => x.filter((v) => v !== e))} aria-label={`Remove ${e}`}>
                    ×
                  </button>
                </span>
              ))}
              <button
                onClick={() => setIncludeTeam((v) => !v)}
                aria-pressed={includeTeam}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  includeTeam ? "border-ember/40 bg-ember-soft text-ember" : "border-hairline hover:bg-accent",
                )}
              >
                Team · {TEAM_ALIAS}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addManual();
                  }
                }}
                placeholder="Add someone else — name@company.com"
                aria-label="Add another recipient"
                className="min-h-[44px] flex-1 rounded-lg border border-hairline bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <button
                onClick={addManual}
                className="rounded-lg border border-border px-3 text-sm hover:bg-accent"
              >
                Add
              </button>
            </div>
            {channel === "email" && !canSend ? (
              <p className="text-xs text-destructive">Pick at least one recipient to send this recap.</p>
            ) : null}
          </section>

          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              How to share
            </p>
            <div className="inline-flex rounded-lg border border-hairline p-0.5">
              {channels.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setChannel(c.key)}
                  aria-pressed={channel === c.key}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors",
                    channel === c.key ? "bg-ember-soft text-ember" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  <c.icon className="size-3.5" /> {c.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Preview
            </p>
            <div className="rounded-xl border border-hairline bg-surface p-4">
              <p className="text-sm font-medium">{recap.subject}</p>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-muted-foreground">
                {recap.body}
              </pre>
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={sending || !canSend}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg bg-ember px-3.5 py-1.5 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90",
              (sending || !canSend) && "opacity-40",
            )}
          >
            <Send className="size-3.5" />
            {sending
              ? "Working…"
              : channel === "email"
                ? "Send recap"
                : channel === "link"
                  ? "Copy link"
                  : "Copy recap"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

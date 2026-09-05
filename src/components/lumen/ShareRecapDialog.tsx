import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Mail, Send, Type } from "lucide-react";
import { toast } from "sonner";
import { buildRecap, createContact, listContacts, shareRecap } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { RecipientField, type Recipient } from "./RecipientField";
import type { Note, ShareChannel } from "@/lib/types";

const TEAM_ALIAS = "studio@lumen.work";

function emailFor(name: string) {
  return `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`;
}

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
  const qc = useQueryClient();

  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => listContacts() });
  const suggested = useMemo<Recipient[]>(
    () =>
      note.attendees
        .filter((a) => a !== "Mary Alcott")
        .map((a) => {
          const match = (contacts.data ?? []).find(
            (c) => c.name.toLowerCase() === a.toLowerCase(),
          );
          return match
            ? { name: match.name, email: match.email, known: true }
            : { name: a, email: emailFor(a), known: false };
        }),
    [note.attendees, contacts.data],
  );
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const value = recipients ?? suggested;
  const [includeTeam, setIncludeTeam] = useState(false);
  const [channel, setChannel] = useState<ShareChannel>("email");
  const [sending, setSending] = useState(false);

  const recap = useMemo(() => buildRecap(note, clientName), [note, clientName]);
  const canSend = channel !== "email" || value.length > 0 || includeTeam;

  function offerToSave(list: Recipient[]) {
    for (const r of list.filter((x) => !x.known)) {
      toast(`Add ${r.name} to contacts?`, {
        action: {
          label: "Add",
          onClick: () => {
            void createContact({
              name: r.name,
              email: r.email,
              clientId: note.clientId,
              role: "client",
              source: "sent",
            }).then(() => {
              void qc.invalidateQueries({ queryKey: ["contacts"] });
              toast.success(`${r.name} saved to contacts`);
            });
          },
        },
        cancel: { label: "Not now", onClick: () => undefined },
      });
    }
  }

  async function submit() {
    setSending(true);
    try {
      const result = await shareRecap(note.id, {
        recipients: value.map((r) => r.email),
        includeTeam,
        channel,
      });

      markShared(note.id, new Date().toISOString());
      if (result.channel === "email") {
        toast.success(`Recap sent to ${(result.sentTo ?? []).join(", ")}`);
        offerToSave(value);
      }

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
            <RecipientField
              value={value}
              onChange={setRecipients}
              clientId={note.clientId}
              label="Recipients"
            />
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

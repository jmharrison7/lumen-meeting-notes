import { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { draftFollowUp } from "@/lib/api";
import type { FollowUpDraft, FollowUpOptions, FollowUpTone, Note } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const tones: { id: FollowUpTone; label: string }[] = [
  { id: "warm", label: "Warm" },
  { id: "professional", label: "Professional" },
  { id: "concise", label: "Concise" },
];

export function FollowUpDialog({
  note,
  open,
  onOpenChange,
}: {
  note: Note;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [options, setOptions] = useState<FollowUpOptions>({
    tone: "warm",
    includeQuestions: true,
    includeActionItems: true,
  });
  const [draft, setDraft] = useState<FollowUpDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [copied, setCopied] = useState(false);

  const hasQuestions = note.openQuestions.length > 0;
  const hasActions = note.actionItems.some((a) => !a.done);

  const key = useMemo(
    () => `${options.tone}|${options.includeQuestions}|${options.includeActionItems}|${nonce}`,
    [options, nonce],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    const t = setTimeout(() => {
      draftFollowUp(note.id, options)
        .then((d) => !cancelled && setDraft(d))
        .catch(() => !cancelled && setError(true))
        .finally(() => !cancelled && setLoading(false));
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key, note.id]);

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
    toast.success(`${label} copied`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-title text-xl">Draft follow-up</DialogTitle>
          <DialogDescription>{note.title}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
          <div className="order-2 min-w-0 md:order-1">
            {error ? (
              <div className="rounded-xl border border-hairline bg-surface p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  The draft didn't come through. Try once more?
                </p>
                <button
                  onClick={() => setNonce((n) => n + 1)}
                  className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  Retry
                </button>
              </div>
            ) : loading || !draft ? (
              <div className="space-y-3 rounded-xl border border-hairline bg-card p-5">
                <div className="h-4 w-2/3 animate-pulse rounded bg-accent" />
                <div className="h-3 w-full animate-pulse rounded bg-accent" />
                <div className="h-3 w-11/12 animate-pulse rounded bg-accent" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-accent" />
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-auto rounded-xl border border-hairline bg-card p-5">
                <p className="text-title text-[15px] font-semibold">{draft.subject}</p>
                <div className="mt-3 space-y-2 text-[14px] leading-relaxed text-foreground/90">
                  {draft.bodyMarkdown.split("\n").map((line, i) =>
                    line.trim() === "" ? (
                      <div key={i} className="h-1" />
                    ) : line.startsWith("**") ? (
                      <p key={i} className="pt-1 font-semibold">
                        {line.replace(/\*\*/g, "")}
                      </p>
                    ) : line.startsWith("- ") ? (
                      <p key={i} className="flex gap-2 pl-1">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ember" />
                        {line.slice(2)}
                      </p>
                    ) : (
                      <p key={i}>{line}</p>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="order-1 space-y-4 md:order-2">
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Tone
              </p>
              <div className="flex rounded-lg border border-border p-0.5">
                {tones.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setOptions((o) => ({ ...o, tone: t.id }))}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-xs transition-colors",
                      options.tone === t.id
                        ? "bg-ember-soft font-medium text-ember"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <Toggle
              label="Include open questions"
              checked={options.includeQuestions && hasQuestions}
              disabled={!hasQuestions}
              onChange={(v) => setOptions((o) => ({ ...o, includeQuestions: v }))}
            />
            <Toggle
              label="Include action items"
              checked={options.includeActionItems && hasActions}
              disabled={!hasActions}
              onChange={(v) => setOptions((o) => ({ ...o, includeActionItems: v }))}
            />

            <div className="space-y-2 pt-1">
              <button
                disabled={!draft}
                onClick={() => void copy(`${draft!.subject}\n\n${draft!.bodyText}`, "Email")}
                className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg bg-ember px-3 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Copy className="size-3.5" /> {copied ? "Copied ✓" : "Copy email"}
              </button>
              <button
                disabled={!draft}
                onClick={() => void copy(draft!.bodyMarkdown, "Markdown")}
                className="min-h-[40px] w-full rounded-lg border border-border px-3 text-sm transition-colors hover:bg-accent disabled:opacity-50"
              >
                Copy markdown
              </button>
              <button
                onClick={() => setNonce((n) => n + 1)}
                className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
              >
                <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Regenerate
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="min-h-[40px] w-full rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left text-xs disabled:opacity-45"
    >
      <span>{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-ember" : "bg-accent",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-card transition-all duration-150",
            checked ? "left-[1.125rem]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

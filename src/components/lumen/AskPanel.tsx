import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Paperclip, Send, Sparkles, Trash2 } from "lucide-react";
import { askLumen, suggestedQuestions } from "@/lib/api";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AskMessage, AskSource } from "@/lib/types";

const KEY = "lumen.ask.v1";

type Threads = Record<string, AskMessage[]>;

function readThreads(): Threads {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Threads;
  } catch {
    return {};
  }
}

function writeThread(scopeKey: string, messages: AskMessage[]) {
  const all = readThreads();
  all[scopeKey] = messages;
  window.localStorage.setItem(KEY, JSON.stringify(all));
}

export interface AskScope {
  clientId?: string | undefined;
  noteId?: string | undefined;
  label: string;
}

export function AskPanel({
  scope,
  open,
  onOpenChange,
}: {
  scope: AskScope;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const scopeKey = scope.noteId ? `note:${scope.noteId}` : `client:${scope.clientId ?? "all"}`;
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(readThreads()[scopeKey] ?? []);
  }, [scopeKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || pending) return;
      const userMsg: AskMessage = {
        id: `m-${Date.now()}`,
        role: "user",
        text: question,
        ...(attachment ? { attachment } : {}),
      };
      const next = [...messages, userMsg];
      setMessages(next);
      writeThread(scopeKey, next);
      setDraft("");
      setAttachment(null);
      setPending(true);
      try {
        const reply = await askLumen(
          { ...(scope.clientId ? { clientId: scope.clientId } : {}), ...(scope.noteId ? { noteId: scope.noteId } : {}) },
          question,
        );
        const withReply: AskMessage[] = [
          ...next,
          { id: `m-${Date.now()}-a`, role: "assistant", text: reply.answer, sources: reply.sources },
        ];
        setMessages(withReply);
        writeThread(scopeKey, withReply);
      } catch {
        const failed: AskMessage[] = [
          ...next,
          {
            id: `m-${Date.now()}-e`,
            role: "assistant",
            text: "Something went wrong reaching the archive. Try that again in a moment.",
          },
        ];
        setMessages(failed);
        writeThread(scopeKey, failed);
      } finally {
        setPending(false);
      }
    },
    [attachment, messages, pending, scope.clientId, scope.noteId, scopeKey],
  );

  function clearThread() {
    setMessages([]);
    writeThread(scopeKey, []);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-hairline px-5 py-4">
          <SheetTitle className="text-title flex items-center gap-2 text-xl">
            <Sparkles className="size-4 text-ember" /> Ask Lumen
          </SheetTitle>
          <SheetDescription className="text-xs">{scope.label}</SheetDescription>
          {messages.length ? (
            <button
              onClick={clearThread}
              className="mt-1 inline-flex w-fit items-center gap-1 text-[11px] text-muted-foreground hover:text-ember"
            >
              <Trash2 className="size-3" /> Clear thread
            </button>
          ) : null}
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ask anything about this account. Answers come from the meetings, transcripts and files
                Lumen already has.
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions({
                  ...(scope.clientId ? { clientId: scope.clientId } : {}),
                  ...(scope.noteId ? { noteId: scope.noteId } : {}),
                }).map((q) => (
                  <button
                    key={q}
                    onClick={() => void send(q)}
                    className="rounded-full border border-hairline bg-card px-3 py-1.5 text-xs transition-colors hover:border-ember/40 hover:bg-ember-soft hover:text-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ember px-3.5 py-2.5 text-sm text-[oklch(0.99_0.005_85)]">
                  {m.text}
                  {m.attachment ? (
                    <p className="mt-1 text-[11px] opacity-80">Attached: {m.attachment}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div key={m.id} className="space-y-2">
                <div className="max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-hairline bg-card px-3.5 py-2.5 text-sm leading-relaxed">
                  {m.text}
                </div>
                {m.sources?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {m.sources.map((s, i) => (
                      <SourceChip key={`${m.id}-${i}`} source={s} />
                    ))}
                  </div>
                ) : null}
                <p className="text-[11px] text-muted-foreground">
                  AI may get details wrong — check sources.
                </p>
              </div>
            ),
          )}

          {pending ? (
            <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-hairline bg-card px-3.5 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
              <span className="sr-only">Lumen is thinking</span>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <div className="border-t border-hairline p-3">
          {attachment ? (
            <p className="mb-2 truncate text-[11px] text-muted-foreground">
              Attached: {attachment}{" "}
              <button onClick={() => setAttachment(null)} className="text-ember">
                remove
              </button>
            </p>
          ) : null}
          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setAttachment(e.target.files?.[0]?.name ?? null)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              aria-label="Attach a file to this question"
              className="grid size-11 shrink-0 place-items-center rounded-lg border border-hairline text-muted-foreground transition-colors hover:bg-accent"
            >
              <Paperclip className="size-4" />
            </button>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
              rows={1}
              placeholder="Ask about this account…"
              aria-label="Ask Lumen a question"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-lg border border-hairline bg-card px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <button
              onClick={() => void send(draft)}
              disabled={pending || !draft.trim()}
              aria-label="Send question"
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-lg bg-ember text-[oklch(0.99_0.005_85)] transition-opacity",
                (pending || !draft.trim()) && "opacity-40",
              )}
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SourceChip({ source }: { source: AskSource }) {
  const [open, setOpen] = useState(false);
  const noteId = source.link.startsWith("note:")
    ? (source.link.slice(5).split("@")[0] as string)
    : source.kind === "note"
      ? source.link
      : null;

  return (
    <div className="w-full">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-md border border-hairline bg-surface px-2 py-1 text-[11px] underline decoration-dotted underline-offset-2 transition-colors hover:border-ember/40 hover:text-ember"
      >
        {source.label}
      </button>
      {open ? (
        <div className="mt-1.5 animate-[fade-in_150ms_ease-out] rounded-lg border border-hairline bg-surface p-2.5 text-[12px] leading-relaxed text-muted-foreground">
          {source.snippet}
          {noteId ? (
            <Link
              to="/notes/$noteId"
              params={{ noteId }}
              className="mt-1.5 block text-[11px] text-ember hover:underline"
            >
              Open the note →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

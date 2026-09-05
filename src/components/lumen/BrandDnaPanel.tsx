import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { getBrandDNA, listClientFiles, saveBrandDNA } from "@/lib/api";
import { relativeDate } from "@/lib/format";
import type { BrandDNA } from "@/lib/types";
import { ErrorState, ListSkeleton } from "./primitives";

export function BrandDnaPanel({ clientId }: { clientId: string }) {
  const dna = useQuery({ queryKey: ["brand-dna", clientId], queryFn: () => getBrandDNA(clientId) });
  const files = useQuery({ queryKey: ["client-files", clientId], queryFn: () => listClientFiles(clientId) });
  const [draft, setDraft] = useState<BrandDNA | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dna.data) setDraft(dna.data);
  }, [dna.data]);

  if (dna.isError) return <ErrorState onRetry={() => void dna.refetch()} />;
  if (!draft) return <ListSkeleton rows={3} />;

  async function persist(next: BrandDNA) {
    setDraft(next);
    setSaving(true);
    try {
      const saved = await saveBrandDNA(clientId, next);
      setDraft(saved);
    } catch {
      toast.error("That change didn't save.");
    } finally {
      setSaving(false);
    }
  }

  const references = (files.data ?? []).filter((f) => f.source === "drive");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>Last updated {relativeDate(draft.updatedAtISO)}</span>
        {saving ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" /> Saving…
          </span>
        ) : null}
      </div>

      <Zone title="Voice" hint="How the brand talks.">
        <ChipList
          items={draft.voice}
          placeholder="Add a word — e.g. playful"
          onChange={(voice) => void persist({ ...draft, voice })}
        />
      </Zone>

      <div className="grid gap-4 sm:grid-cols-2">
        <Zone title="Always" hint="Things we hold to.">
          <RuleList
            items={draft.always}
            placeholder="Always…"
            onChange={(always) => void persist({ ...draft, always })}
          />
        </Zone>
        <Zone title="Never" hint="Things we refuse.">
          <RuleList
            items={draft.never}
            placeholder="Never…"
            onChange={(never) => void persist({ ...draft, never })}
          />
        </Zone>
      </div>

      <Zone title="Tone" hint="One line, plain English.">
        <input
          value={draft.tone}
          onChange={(e) => setDraft({ ...draft, tone: e.target.value })}
          onBlur={() => void persist(draft)}
          placeholder="warm but sharp; plain English; no fluff"
          aria-label="Tone"
          className="min-h-[44px] w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
        />
      </Zone>

      <Zone title="Brand references" hint="Working documents from this client's Drive.">
        {references.length === 0 ? (
          <p className="text-sm text-muted-foreground">No linked documents yet — add them in Files.</p>
        ) : (
          <ul className="space-y-1.5">
            {references.map((f) => (
              <li key={f.id}>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-ember hover:underline"
                >
                  {f.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Zone>
    </div>
  );
}

function Zone({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-hairline bg-card p-5">
      <h2 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
      <p className="mb-3 mt-1 text-xs text-muted-foreground/80">{hint}</p>
      {children}
    </section>
  );
}

function ChipList({
  items,
  placeholder,
  onChange,
}: {
  items: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((t) => (
        <button
          key={t}
          onClick={() => onChange(items.filter((x) => x !== t))}
          aria-label={`Remove ${t}`}
          className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-ember/40 hover:text-ember"
        >
          {t} <X className="size-3" />
        </button>
      ))}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const v = value.trim();
          if (!v || items.includes(v)) return setValue("");
          onChange([...items, v]);
          setValue("");
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-[38px] w-48 rounded-lg border border-hairline bg-surface px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
      />
    </div>
  );
}

function RuleList({
  items,
  placeholder,
  onChange,
}: {
  items: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="space-y-2">
      {items.map((rule, idx) => (
        <div key={`${rule}-${idx}`} className="flex items-start gap-2">
          <input
            defaultValue={rule}
            aria-label={`Edit rule: ${rule}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (!v || v === rule) return;
              const next = [...items];
              next[idx] = v;
              onChange(next);
            }}
            className="min-h-[38px] flex-1 rounded-lg border border-hairline bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
          />
          <button
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
            aria-label={`Delete rule: ${rule}`}
            className="mt-1 rounded-md p-1.5 text-muted-foreground hover:text-destructive"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const v = value.trim();
            if (!v) return;
            onChange([...items, v]);
            setValue("");
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-h-[38px] flex-1 rounded-lg border border-dashed border-hairline bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
        />
        <button
          onClick={() => {
            const v = value.trim();
            if (!v) return;
            onChange([...items, v]);
            setValue("");
          }}
          aria-label="Add rule"
          className="rounded-md p-2 text-muted-foreground hover:text-ember"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Copy, ExternalLink, Link2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { deleteTemplate, listTemplates, registerTemplate } from "@/lib/api";
import { fullDate, relativeDate } from "@/lib/format";
import type { Template, TemplateKind } from "@/lib/types";
import { EmptyState, ErrorState } from "./primitives";
import { formatBytes } from "./FilesPanel";

const kinds: TemplateKind[] = ["estimate", "brand", "proposal", "agenda", "other"];
const kindLabel: Record<TemplateKind, string> = {
  estimate: "Estimate",
  brand: "Brand doc",
  proposal: "Proposal",
  agenda: "Agenda",
  other: "Other",
};

function TemplateCard({
  t,
  onDelete,
  onDuplicate,
  onArchive,
  archived,
}: {
  t: Template;
  onDelete: (id: string) => void;
  onDuplicate: (t: Template) => void;
  onArchive: (id: string) => void;
  archived: boolean;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-hairline bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-title text-base font-semibold leading-snug">{t.name}</h3>
        <span className="shrink-0 rounded-full bg-ember-soft px-2 py-0.5 text-[11px] font-medium text-ember">
          {kindLabel[t.kind]}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {t.source === "drive" ? "Linked Drive" : "Uploaded"}
        {t.sizeBytes ? ` · ${formatBytes(t.sizeBytes)}` : ""} ·{" "}
        <span title={fullDate(t.createdAtISO)}>{relativeDate(t.createdAtISO)}</span>
        {archived ? " · Archived" : ""}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {t.url ? (
          <a
            href={t.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${t.name}`}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs transition-colors hover:bg-accent"
          >
            <ExternalLink className="size-3.5" /> Open
          </a>
        ) : null}
        <button
          onClick={() => onDuplicate(t)}
          aria-label={`Duplicate ${t.name}`}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs transition-colors hover:bg-accent"
        >
          <Copy className="size-3.5" /> Duplicate
        </button>
        <button
          onClick={() => onArchive(t.id)}
          aria-label={`${archived ? "Unarchive" : "Archive"} ${t.name}`}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs transition-colors hover:bg-accent"
        >
          <Archive className="size-3.5" /> {archived ? "Unarchive" : "Archive"}
        </button>
        <button
          onClick={() => onDelete(t.id)}
          aria-label={`Delete ${t.name}`}
          className="ml-auto grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-ember"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function TemplatesPanel({ clientId }: { clientId?: string | undefined }) {
  const qc = useQueryClient();
  const all = useQuery({ queryKey: ["templates"], queryFn: () => listTemplates() });
  const [archived, setArchived] = useState<string[]>([]);
  const [kind, setKind] = useState<TemplateKind>("estimate");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["templates"] });

  const add = useMutation({
    mutationFn: (input: Parameters<typeof registerTemplate>[0]) => registerTemplate(input),
    onSuccess: () => {
      refresh();
      toast.success("Template added");
    },
    onError: () => toast.error("Couldn't add that template"),
  });

  if (all.isError) return <ErrorState onRetry={() => void all.refetch()} />;

  const rows = (all.data ?? []).filter((t) => (clientId ? t.clientId === clientId : true));
  const global = rows.filter((t) => !t.clientId);
  const perClient = rows.filter((t) => t.clientId);

  const remove = async (id: string) => {
    await deleteTemplate(id);
    refresh();
    toast.success("Template deleted");
  };
  const duplicate = (t: Template) =>
    add.mutate({
      name: `${t.name} (copy)`,
      kind: t.kind,
      source: t.source,
      clientId: t.clientId,
      url: t.url,
      sizeBytes: t.sizeBytes,
    });
  const toggleArchive = (id: string) =>
    setArchived((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const grid = (list: Template[]) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {list.map((t) => (
        <TemplateCard
          key={t.id}
          t={t}
          archived={archived.includes(t.id)}
          onDelete={(id) => void remove(id)}
          onDuplicate={duplicate}
          onArchive={toggleArchive}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-3 rounded-xl border border-dashed border-border bg-surface/60 p-3 sm:grid-cols-[1fr_auto_auto]">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          aria-label="Template name"
          className="min-h-[40px] rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as TemplateKind)}
          aria-label="Template type"
          className="min-h-[40px] rounded-lg border border-border bg-background px-3 text-sm"
        >
          {kinds.map((k) => (
            <option key={k} value={k}>
              {kindLabel[k]}
            </option>
          ))}
        </select>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f)
              add.mutate({
                name: name || f.name,
                kind,
                source: "upload",
                clientId,
                sizeBytes: f.size,
              });
          }}
          className="flex items-center gap-2"
        >
          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-accent"
          >
            <UploadCloud className="size-4" /> Upload template file
          </button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                add.mutate({
                  name: name || f.name,
                  kind,
                  source: "upload",
                  clientId,
                  sizeBytes: f.size,
                });
              e.target.value = "";
            }}
          />
        </div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="…or paste a Drive URL"
          aria-label="Drive template URL"
          className="min-h-[40px] rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember/40 sm:col-span-2"
        />
        <button
          onClick={() => {
            if (!url.trim()) return toast.error("Paste a Drive URL first");
            add.mutate({ name: name || "Untitled template", kind, source: "drive", clientId, url });
            setUrl("");
            setName("");
          }}
          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-ember px-3.5 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90"
        >
          <Link2 className="size-4" /> Link from Drive
        </button>
      </div>

      {all.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl border border-hairline bg-muted/60" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No templates yet"
          body="Upload an estimate, agenda or brand doc — or link one from Drive — and it'll be ready the next time you need it."
        />
      ) : clientId ? (
        grid(rows)
      ) : (
        <>
          {global.length ? (
            <section className="space-y-3">
              <h2 className="text-title text-lg font-semibold">Global templates</h2>
              {grid(global)}
            </section>
          ) : null}
          {perClient.length ? (
            <section className="space-y-3">
              <h2 className="text-title text-lg font-semibold">Per-client templates</h2>
              {grid(perClient)}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

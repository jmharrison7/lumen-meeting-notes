import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Link2,
  Paperclip,
  Presentation,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import {
  addDriveLink,
  deleteClientFile,
  listClientFiles,
  registerUpload,
  updateClientFile,
} from "@/lib/api";
import { fullDate, relativeDate } from "@/lib/format";
import type { ClientFile, DocKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, SectionTitle, Tag } from "./primitives";

export function formatBytes(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const kindIcon: Record<DocKind, typeof FileText> = {
  slides: Presentation,
  docs: FileText,
  sheets: FileSpreadsheet,
  file: Paperclip,
};

const kindLabel: Record<DocKind, string> = {
  slides: "Slides",
  docs: "Doc",
  sheets: "Sheet",
  file: "File",
};

function FileRow({ file, onDelete }: { file: ClientFile; onDelete: (id: string) => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(file.label ?? "");
  const Icon = kindIcon[file.kind];
  const stamp = file.modifiedAtISO ?? file.createdAtISO;

  const save = async () => {
    setEditing(false);
    if ((file.label ?? "") === label) return;
    await updateClientFile(file.id, { label });
    void qc.invalidateQueries({ queryKey: ["client-files", file.clientId] });
  };

  return (
    <div className="flex items-start gap-3 border-b border-hairline px-4 py-3.5 transition-colors last:border-0 hover:bg-accent/40">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span>{kindLabel[file.kind]}</span>
          <span>·</span>
          <span title={fullDate(stamp)}>{relativeDate(stamp)}</span>
          {file.sizeBytes ? (
            <>
              <span>·</span>
              <span>{formatBytes(file.sizeBytes)}</span>
            </>
          ) : null}
          {file.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
        {editing ? (
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="Add a label"
            aria-label={`Label for ${file.name}`}
            className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="mt-1.5 text-[11px] text-muted-foreground underline-offset-2 hover:text-ember hover:underline"
          >
            {file.label ? file.label : "Add a label"}
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {file.url ? (
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${file.name}`}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ember/40"
          >
            <ExternalLink className="size-3.5" /> Open
          </a>
        ) : null}
        <button
          onClick={() => onDelete(file.id)}
          aria-label={`Delete ${file.name}`}
          className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-ember focus-visible:ring-2 focus-visible:ring-ember/40"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function FilesPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const files = useQuery({
    queryKey: ["client-files", clientId],
    queryFn: () => listClientFiles(clientId),
  });
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["client-files", clientId] });

  const upload = useMutation({
    mutationFn: (f: File) => registerUpload(clientId, { name: f.name, size: f.size, mime: f.type }),
    onSuccess: (f) => {
      refresh();
      toast.success(`${f.name} added`);
    },
    onError: () => toast.error("That upload didn't stick — try again"),
  });

  const link = useMutation({
    mutationFn: () => addDriveLink(clientId, { url, label }),
    onSuccess: () => {
      setUrl("");
      setLabel("");
      refresh();
      toast.success("Drive doc linked");
    },
    onError: () => toast.error("Couldn't link that doc"),
  });

  const remove = async (id: string) => {
    await deleteClientFile(id);
    refresh();
    toast.success("Removed");
  };

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    for (const f of Array.from(list)) upload.mutate(f);
  };

  if (files.isError) return <ErrorState onRetry={() => void files.refetch()} />;

  const drive = (files.data ?? []).filter((f) => f.source === "drive");
  const uploads = (files.data ?? []).filter((f) => f.source === "upload");

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionTitle>Drive docs</SectionTitle>
        {files.isLoading ? (
          <div className="h-32 animate-pulse rounded-xl border border-hairline bg-muted/60" />
        ) : drive.length === 0 ? (
          <EmptyState
            title="No Drive docs linked"
            body="Paste a Google Drive share link below to keep this client's decks, docs and sheets one click away."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-hairline bg-card">
            {drive.map((f) => (
              <FileRow key={f.id} file={f} onDelete={(id) => void remove(id)} />
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!url.trim()) return;
            link.mutate();
          }}
          className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-surface/60 p-3 sm:flex-row"
        >
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a Drive share URL"
            aria-label="Drive share URL"
            className="min-h-[40px] flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            aria-label="Drive doc label"
            className="min-h-[40px] rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember/40 sm:w-52"
          />
          <button
            type="submit"
            disabled={link.isPending}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-ember px-3.5 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Link2 className="size-4" /> {link.isPending ? "Linking…" : "Link a Drive doc"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <SectionTitle>Uploaded files</SectionTitle>
        {files.isLoading ? (
          <div className="h-24 animate-pulse rounded-xl border border-hairline bg-muted/60" />
        ) : uploads.length === 0 ? (
          <EmptyState
            title="Nothing uploaded yet"
            body="Drop a PDF, deck, doc or image below and it'll sit alongside this client's notes."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-hairline bg-card">
            {uploads.map((f) => (
              <FileRow key={f.id} file={f} onDelete={(id) => void remove(id)} />
            ))}
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "rounded-xl border border-dashed p-6 text-center transition-colors",
            dragging ? "border-ember bg-ember-soft/50" : "border-border bg-surface/60",
          )}
        >
          <UploadCloud className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 text-sm">
            {upload.isPending ? "Uploading…" : "Drag files here"}
          </p>
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-2 min-h-[40px] rounded-lg border border-border px-3.5 text-sm transition-colors hover:bg-accent"
          >
            Choose files
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.pptx,.md,.txt,image/*"
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </section>
    </div>
  );
}

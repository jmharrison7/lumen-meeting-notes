import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createClient, listClients, suggestClientForIdea, updateIdea } from "@/lib/api";
import type { Idea } from "@/lib/types";

/**
 * Routing suggestion for an idea with no client. Nothing attaches until Mary
 * confirms — the banner only ever proposes.
 */
export function IdeaSuggestion({ idea }: { idea: Idea }) {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [picking, setPicking] = useState(false);
  const [creatingName, setCreatingName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enabled = !idea.clientId && !idea.suggestionDismissed;
  const suggestion = useQuery({
    queryKey: ["idea-suggestion", idea.id],
    queryFn: () => suggestClientForIdea(idea.id),
    enabled,
  });

  if (!enabled || !suggestion.data) return null;
  const { clientId, reason } = suggestion.data;
  const match = (clients.data ?? []).find((c) => c.id === clientId);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["ideas"] });
    await qc.invalidateQueries({ queryKey: ["idea", idea.id] });
    await qc.invalidateQueries({ queryKey: ["clients"] });
  }

  async function attach(id: string, name: string) {
    setBusy(true);
    try {
      await updateIdea(idea.id, { clientId: id });
      await refresh();
      toast.success(`Filed under ${name}.`);
    } finally {
      setBusy(false);
    }
  }

  async function keepPersonal() {
    setBusy(true);
    try {
      await updateIdea(idea.id, { suggestionDismissed: true });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createAndAttach(name: string) {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const created = await createClient({ name });
      await updateIdea(idea.id, { clientId: created.id });
      await refresh();
      toast.success(`${created.name} added — idea filed there.`);
    } finally {
      setBusy(false);
      setCreatingName(null);
    }
  }

  const btn =
    "min-h-[36px] rounded-lg border border-hairline bg-card px-2.5 text-xs transition-colors hover:border-ember/40 hover:text-ember disabled:opacity-50";

  return (
    <div className="mt-3 rounded-lg border border-ember/30 bg-ember-soft/60 p-3">
      <p className="flex items-start gap-2 text-xs">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-ember" />
        {match ? (
          <span>
            Suggested client: <strong>{match.name}</strong> — {reason}. Attach?
          </span>
        ) : (
          <span>Looks like a new project — {reason}. Create a client for it?</span>
        )}
      </p>

      {creatingName !== null ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={creatingName}
            onChange={(e) => setCreatingName(e.target.value)}
            placeholder="Client name"
            aria-label="New client name"
            autoFocus
            className="min-h-[36px] flex-1 rounded-lg border border-hairline bg-card px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
          />
          <button onClick={() => void createAndAttach(creatingName)} disabled={busy} className={btn}>
            Create &amp; attach
          </button>
          <button onClick={() => setCreatingName(null)} className={btn}>
            Cancel
          </button>
        </div>
      ) : picking ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            aria-label="Pick a client for this idea"
            defaultValue=""
            onChange={(e) => {
              const c = (clients.data ?? []).find((x) => x.id === e.target.value);
              if (c) void attach(c.id, c.name);
            }}
            className="min-h-[36px] rounded-lg border border-hairline bg-card px-2.5 text-xs"
          >
            <option value="">Choose a client…</option>
            {(clients.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button onClick={() => setCreatingName("")} className={btn}>
            ＋ New client
          </button>
          <button onClick={() => setPicking(false)} className={btn}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {match ? (
            <button onClick={() => void attach(match.id, match.name)} disabled={busy} className={btn}>
              Attach
            </button>
          ) : (
            <button onClick={() => setCreatingName("")} disabled={busy} className={btn}>
              Create client
            </button>
          )}
          <button onClick={() => void keepPersonal()} disabled={busy} className={btn}>
            Keep personal
          </button>
          <button onClick={() => setPicking(true)} className={btn}>
            {match ? "Wrong client? Pick…" : "Pick a client…"}
          </button>
        </div>
      )}
    </div>
  );
}

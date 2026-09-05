import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bell, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getAlertConfig,
  getClientAlertConfig,
  getMentionHits,
  listClients,
  listNotes,
  resetAlertConfig,
  saveAlertConfig,
  saveClientAlertConfig,
} from "@/lib/api";
import type { AlertRule, ClientAlertConfig, GlobalAlertConfig } from "@/lib/types";
import { fullDate, relativeDate } from "@/lib/format";
import { ErrorState, SectionTitle } from "@/components/lumen/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — Lumen" },
      {
        name: "description",
        content: "Watch for budget, timeline and renewal talk across every meeting, quietly.",
      },
      { property: "og:title", content: "Alerts — Lumen" },
      {
        property: "og:description",
        content: "Keyword and topic alerts that catch scope creep and renewal signals early.",
      },
    ],
  }),
  component: AlertsPage,
});

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors",
        checked ? "bg-ember" : "bg-border",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-card shadow-sm transition-all",
          checked ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}

function RuleRow({
  rule,
  onChange,
  onDelete,
}: {
  rule: AlertRule;
  onChange: (r: AlertRule) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-0">
      <span className={cn("flex-1 text-sm", !rule.enabled && "text-muted-foreground line-through")}>
        {rule.term}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Watch</span>
        <Toggle
          checked={rule.enabled}
          label={`Watch ${rule.term}`}
          onChange={(v) => onChange({ ...rule, enabled: v })}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Notify</span>
        <Toggle
          checked={rule.notify}
          label={`Notify me about ${rule.term}`}
          onChange={(v) => onChange({ ...rule, notify: v })}
        />
      </div>
      <button
        onClick={onDelete}
        aria-label={`Delete ${rule.term}`}
        className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-ember"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function AlertsPage() {
  const qc = useQueryClient();
  const cfg = useQuery({ queryKey: ["alerts"], queryFn: getAlertConfig });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const notes = useQuery({ queryKey: ["notes"], queryFn: listNotes });
  const [term, setTerm] = useState("");
  const [clientId, setClientId] = useState<string>("");

  const clientCfg = useQuery({
    queryKey: ["alerts-client", clientId],
    queryFn: () => getClientAlertConfig(clientId),
    enabled: !!clientId,
  });

  const save = useMutation({
    mutationFn: (next: GlobalAlertConfig) => saveAlertConfig(next),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
  const saveClient = useMutation({
    mutationFn: (next: ClientAlertConfig) => saveClientAlertConfig(next.clientId, next),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts-client", clientId] }),
  });

  const recent = useQuery({
    queryKey: ["alerts-recent", (notes.data ?? []).length],
    enabled: !!notes.data,
    queryFn: async () => {
      const rows = await Promise.all(
        (notes.data ?? []).slice(0, 8).map(async (n) => ({
          note: n,
          hits: await getMentionHits(n.id),
        })),
      );
      return rows.filter((r) => r.hits.length > 0).slice(0, 5);
    },
  });

  const active = useMemo(
    () => (cfg.data?.rules ?? []).filter((r) => r.enabled).length,
    [cfg.data],
  );

  if (cfg.isError) return <ErrorState onRetry={() => void cfg.refetch()} />;

  const c = cfg.data;
  const cc = clientCfg.data;

  const update = (patch: Partial<GlobalAlertConfig>) => {
    if (!c) return;
    const next = { ...c, ...patch };
    qc.setQueryData(["alerts"], next);
    save.mutate(next);
  };
  const updateClient = (patch: Partial<ClientAlertConfig>) => {
    if (!cc) return;
    const next = { ...cc, ...patch };
    qc.setQueryData(["alerts-client", clientId], next);
    saveClient.mutate(next);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-title text-3xl font-semibold tracking-tight">Alerts</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          A quiet watchdog. Catch scope creep early, never miss a renewal date.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Keywords {c ? `· ${active} active` : ""}</SectionTitle>
          <button
            onClick={async () => {
              const next = await resetAlertConfig();
              qc.setQueryData(["alerts"], next);
              toast.success("Defaults restored");
            }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-ember"
          >
            <RotateCcw className="size-3.5" /> Reset to defaults
          </button>
        </div>

        {cfg.isLoading || !c ? (
          <div className="h-64 animate-pulse rounded-xl border border-hairline bg-muted/60" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-hairline bg-card">
            {c.rules.map((r) => (
              <RuleRow
                key={r.id}
                rule={r}
                onChange={(nr) => update({ rules: c.rules.map((x) => (x.id === nr.id ? nr : x)) })}
                onDelete={() => update({ rules: c.rules.filter((x) => x.id !== r.id) })}
              />
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = term.trim();
            if (!t || !c) return;
            if (c.rules.some((r) => r.term.toLowerCase() === t.toLowerCase())) {
              toast.error("You're already watching that word");
              return;
            }
            update({
              rules: [...c.rules, { id: `r-${Date.now()}`, term: t, enabled: true, notify: false }],
            });
            setTerm("");
          }}
          className="flex gap-2"
        >
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Add a word to watch — e.g. Retainer"
            aria-label="New keyword"
            className="min-h-[40px] flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
          />
          <button className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-ember px-3.5 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90">
            <Plus className="size-4" /> Add
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <SectionTitle>Per-client overrides</SectionTitle>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          aria-label="Choose a client"
          className="min-h-[40px] rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="">Choose a client…</option>
          {(clients.data ?? []).map((cl) => (
            <option key={cl.id} value={cl.id}>
              {cl.name}
            </option>
          ))}
        </select>

        {clientId && cc ? (
          <div className="space-y-3 rounded-xl border border-hairline bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex-1 text-sm">Inherit the global keyword list</span>
              <Toggle
                checked={cc.inheritGlobal}
                label="Inherit global keywords"
                onChange={(v) => updateClient({ inheritGlobal: v })}
              />
            </div>
            {cc.rules.length ? (
              <div className="overflow-hidden rounded-lg border border-hairline">
                {cc.rules.map((r) => (
                  <RuleRow
                    key={r.id}
                    rule={r}
                    onChange={(nr) =>
                      updateClient({ rules: cc.rules.map((x) => (x.id === nr.id ? nr : x)) })
                    }
                    onDelete={() => updateClient({ rules: cc.rules.filter((x) => x.id !== r.id) })}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No client-only words yet — this account follows your global list.
              </p>
            )}
            <ClientTermAdder
              onAdd={(t) =>
                updateClient({
                  inheritGlobal: true,
                  rules: [
                    ...cc.rules,
                    { id: `rc-${Date.now()}`, term: t, enabled: true, notify: false },
                  ],
                })
              }
            />
          </div>
        ) : null}
      </section>

      {c ? (
        <section className="space-y-3">
          <SectionTitle>Topic alerts</SectionTitle>
          <div className="space-y-3 rounded-xl border border-hairline bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex-1 text-sm">Auto-detect topics as well as words</span>
              <Toggle
                checked={c.topics.enabled}
                label="Auto-detect topics"
                onChange={(v) => update({ topics: { ...c.topics, enabled: v } })}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {c.topics.topics.map((t) => (
                <button
                  key={t.key}
                  onClick={() =>
                    update({
                      topics: {
                        ...c.topics,
                        topics: c.topics.topics.map((x) =>
                          x.key === t.key ? { ...x, enabled: !x.enabled } : x,
                        ),
                      },
                    })
                  }
                  aria-pressed={t.enabled}
                  className={cn(
                    "rounded-full border border-hairline px-3 py-1 text-xs transition-colors",
                    t.enabled ? "bg-ember-soft text-ember" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionTitle>Recent activity</SectionTitle>
        {recent.isLoading ? (
          <div className="h-28 animate-pulse rounded-xl border border-hairline bg-muted/60" />
        ) : (recent.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface/60 px-4 py-6 text-sm text-muted-foreground">
            Nothing flagged yet. When one of your words comes up in a meeting, it'll show here.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-hairline bg-card">
            {(recent.data ?? []).map(({ note, hits }) => (
              <Link
                key={note.id}
                to="/notes/$noteId"
                params={{ noteId: note.id }}
                className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3 text-sm transition-colors last:border-0 hover:bg-accent/40"
              >
                <Bell className="size-3.5 text-ember" />
                <span className="font-medium">{note.title}</span>
                {hits.slice(0, 3).map((h, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-ember-soft px-2 py-0.5 text-[11px] text-ember"
                  >
                    {h.term}
                  </span>
                ))}
                <span
                  className="ml-auto text-[11px] text-muted-foreground"
                  title={fullDate(note.date)}
                >
                  {relativeDate(note.date)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ClientTermAdder({ onAdd }: { onAdd: (term: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.trim()) return;
        onAdd(v.trim());
        setV("");
      }}
      className="flex gap-2"
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Add a word just for this client"
        aria-label="New client keyword"
        className="min-h-[40px] flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
      />
      <button className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-accent">
        <Plus className="size-4" /> Add
      </button>
    </form>
  );
}

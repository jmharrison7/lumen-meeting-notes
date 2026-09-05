import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createContact,
  deleteContact,
  dismissSuggestion,
  listClients,
  listContacts,
  suggestedContacts,
  updateContact,
} from "@/lib/api";
import { EmptyState, ErrorState } from "@/components/lumen/primitives";
import { initials } from "@/components/lumen/RecipientField";
import { cn } from "@/lib/utils";
import type { Contact, ContactRole } from "@/lib/types";

export const Route = createFileRoute("/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts — Lumen" },
      {
        name: "description",
        content:
          "Mary's address book: client stakeholders, studio team and freelancers, ready for recaps and invites.",
      },
      { property: "og:title", content: "Contacts — Lumen" },
      {
        property: "og:description",
        content: "One address book for recaps, follow-ups and collaborator invites.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactsPage,
});

const roles: ContactRole[] = ["client", "team", "freelancer", "other"];
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

interface Draft {
  id?: string;
  name: string;
  email: string;
  company: string;
  clientId: string;
  role: string;
}

const blank: Draft = { name: "", email: "", company: "", clientId: "", role: "" };

function ContactsPage() {
  const qc = useQueryClient();
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => listContacts() });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const suggestions = useQuery({ queryKey: ["contacts", "suggestions"], queryFn: suggestedContacts });

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");

  const clientName = (id?: string) => clients.data?.find((c) => c.id === id)?.name;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (contacts.data ?? []).filter(
      (c) =>
        (!needle ||
          c.name.toLowerCase().includes(needle) ||
          c.email.toLowerCase().includes(needle) ||
          (c.company ?? "").toLowerCase().includes(needle)) &&
        (!roleFilter || c.role === roleFilter) &&
        (!clientFilter || c.clientId === clientFilter),
    );
  }, [contacts.data, q, roleFilter, clientFilter]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["contacts"] });
  };

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const payload = {
        name: d.name.trim(),
        email: d.email.trim(),
        company: d.company.trim() || undefined,
        clientId: d.clientId || undefined,
        role: (d.role || undefined) as ContactRole | undefined,
      };
      return d.id ? updateContact(d.id, payload) : createContact(payload);
    },
    onSuccess: (c) => {
      invalidate();
      setDraft(null);
      toast.success(`${c.name} saved to your address book`);
    },
    onError: () => toast.error("Couldn't save that contact — try again"),
  });

  const remove = useMutation({
    mutationFn: (c: Contact) => deleteContact(c.id),
    onSuccess: () => {
      invalidate();
      toast.success("Contact removed");
    },
  });

  const addSuggested = useMutation({
    mutationFn: (s: { name: string; clientId?: string | undefined }) =>
      createContact({
        name: s.name,
        email: `${s.name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
        clientId: s.clientId,
        role: "client",
        source: "attendee",
      }),
    onSuccess: (c) => {
      invalidate();
      toast.success(`${c.name} added — tidy up their email any time`);
    },
  });

  function submit() {
    if (!draft) return;
    if (!draft.name.trim()) return setError("A name helps you find them later.");
    if (!emailOk(draft.email)) return setError("That doesn't look like an email address.");
    const dupe = (contacts.data ?? []).find(
      (c) => c.email.toLowerCase() === draft.email.trim().toLowerCase() && c.id !== draft.id,
    );
    if (dupe) return setError(`${dupe.name} already uses that address.`);
    setError("");
    save.mutate(draft);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title text-3xl font-semibold tracking-tight">Contacts</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Type a name — we'll find the address. Recaps and invites fill this in as you go.
          </p>
        </div>
        <button
          onClick={() => {
            setError("");
            setDraft({ ...blank });
          }}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-ember px-3.5 text-sm font-medium text-[oklch(0.99_0.005_85)] hover:opacity-90"
        >
          <Plus className="size-4" /> New contact
        </button>
      </header>

      {draft ? (
        <div className="rounded-xl border border-hairline bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-title text-sm font-semibold">
              {draft.id ? "Edit contact" : "New contact"}
            </p>
            <button onClick={() => setDraft(null)} aria-label="Close form">
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Full name"
              aria-label="Contact name"
              className="min-h-[44px] rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <input
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="name@company.com"
              aria-label="Contact email"
              className="min-h-[44px] rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <input
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
              placeholder="Company (optional)"
              aria-label="Company"
              className="min-h-[44px] rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={draft.clientId}
                onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}
                aria-label="Client"
                className="min-h-[44px] rounded-lg border border-hairline bg-surface px-2 text-sm"
              >
                <option value="">No client</option>
                {(clients.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                aria-label="Role"
                className="min-h-[44px] rounded-lg border border-hairline bg-surface px-2 text-sm"
              >
                <option value="">No role</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r[0]!.toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setDraft(null)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={save.isPending}
              className="rounded-lg bg-ember px-3.5 py-1.5 text-sm font-medium text-[oklch(0.99_0.005_85)] hover:opacity-90 disabled:opacity-40"
            >
              {save.isPending ? "Saving…" : "Save contact"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email or company"
          aria-label="Search contacts"
          className="min-h-[44px] min-w-[14rem] flex-1 rounded-lg border border-hairline bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          aria-label="Filter by client"
          className="min-h-[44px] rounded-lg border border-hairline bg-card px-2 text-sm"
        >
          <option value="">All clients</option>
          {(clients.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
          className="min-h-[44px] rounded-lg border border-hairline bg-card px-2 text-sm"
        >
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r[0]!.toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {contacts.isError ? (
        <ErrorState onRetry={() => void contacts.refetch()} />
      ) : contacts.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-hairline bg-muted/60" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Your address book starts empty"
          body="Recaps will build it — anyone you send to can be saved here in one tap."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-hairline bg-card p-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ember/15 text-xs font-semibold text-ember">
                {initials(c.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.email}
                  {c.company ? ` · ${c.company}` : ""}
                </p>
              </div>
              <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                {c.role ? (
                  <span
                    className={cn(
                      "rounded-full border border-hairline px-2 py-0.5 text-[10px] capitalize",
                      c.role === "client" ? "text-ember" : "text-muted-foreground",
                    )}
                  >
                    {c.role}
                  </span>
                ) : null}
                {clientName(c.clientId) ? (
                  <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] text-muted-foreground">
                    {clientName(c.clientId)}
                  </span>
                ) : null}
              </div>
              <button
                onClick={() => {
                  setError("");
                  setDraft({
                    id: c.id,
                    name: c.name,
                    email: c.email,
                    company: c.company ?? "",
                    clientId: c.clientId ?? "",
                    role: c.role ?? "",
                  });
                }}
                aria-label={`Edit ${c.name}`}
                className="grid size-9 place-items-center rounded-lg hover:bg-accent"
              >
                <Pencil className="size-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => remove.mutate(c)}
                aria-label={`Delete ${c.name}`}
                className="grid size-9 place-items-center rounded-lg hover:bg-accent"
              >
                <Trash2 className="size-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {(suggestions.data ?? []).length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-title text-lg font-semibold">Suggested</h2>
          <p className="text-xs text-muted-foreground">
            People from recent meetings who aren't in the book yet.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(suggestions.data ?? []).map((s) => (
              <li
                key={s.name}
                className="flex items-center gap-3 rounded-xl border border-hairline bg-surface p-3"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ember/10 text-[11px] font-semibold text-ember">
                  {initials(s.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.reason}</p>
                </div>
                <button
                  onClick={() => addSuggested.mutate(s)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-accent"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    dismissSuggestion(s.name);
                    void qc.invalidateQueries({ queryKey: ["contacts", "suggestions"] });
                  }}
                  aria-label={`Dismiss ${s.name}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

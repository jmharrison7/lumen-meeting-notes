import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listClients } from "@/lib/api";

export type ClientChoice = { clientId?: string; newClient?: { name: string; note?: string } };

/**
 * Client picker with an inline "＋ New client…" form. The new client isn't
 * created until the parent saves, so an abandoned capture leaves no stray client.
 */
export function ClientSelect({
  value,
  newClient,
  onChange,
  label = "Assign to a client",
  className = "",
}: {
  value: string;
  newClient?: { name: string; note?: string } | undefined;
  onChange: (choice: ClientChoice) => void;
  label?: string;
  className?: string;
}) {
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(newClient?.name ?? "");
  const [note, setNote] = useState(newClient?.note ?? "");

  if (creating || newClient) {
    return (
      <div className="w-full space-y-2 rounded-lg border border-hairline bg-surface p-3">
        <p className="text-xs font-medium">New client</p>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            onChange({ newClient: { name: e.target.value, note } });
          }}
          placeholder="Client name"
          aria-label="New client name"
          autoFocus
          className="min-h-[38px] w-full rounded-lg border border-hairline bg-card px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
        />
        <input
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            onChange({ newClient: { name, note: e.target.value } });
          }}
          placeholder="One-line note (optional)"
          aria-label="Note about this client"
          className="min-h-[38px] w-full rounded-lg border border-hairline bg-card px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
        />
        <button
          onClick={() => {
            setCreating(false);
            setName("");
            setNote("");
            onChange({ clientId: undefined });
          }}
          className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__new") {
          setCreating(true);
          onChange({ newClient: { name: "" } });
          return;
        }
        onChange({ clientId: e.target.value || undefined });
      }}
      aria-label={label}
      className={`min-h-[38px] rounded-lg border border-hairline bg-surface px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ember/40 ${className}`}
    >
      <option value="">Personal / General</option>
      {(clients.data ?? []).map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      <option value="__new">＋ New client…</option>
    </select>
  );
}

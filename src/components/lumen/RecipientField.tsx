import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchContacts } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Contact } from "@/lib/types";

export interface Recipient {
  name: string;
  email: string;
  /** false when typed ad-hoc and not yet in the address book */
  known: boolean;
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function RecipientField({
  value,
  onChange,
  clientId,
  placeholder = "Type a name — we'll find them.",
  label = "Recipients",
  max,
}: {
  value: Recipient[];
  onChange: (next: Recipient[]) => void;
  clientId?: string | undefined;
  placeholder?: string;
  label?: string;
  max?: number;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ["contacts", "search", q, clientId ?? null],
    queryFn: () => searchContacts(q, clientId),
    enabled: open,
  });

  const chosen = new Set(value.map((v) => v.email.toLowerCase()));
  const matches = (data ?? []).filter((c) => !chosen.has(c.email.toLowerCase())).slice(0, 6);
  const showAddNew = q.trim().length > 0 && !matches.some((m) => m.email === q.trim());
  const options = matches.length + (showAddNew ? 1 : 0);
  const full = max !== undefined && value.length >= max;

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function add(r: Recipient) {
    if (chosen.has(r.email.toLowerCase())) return;
    onChange(max === 1 ? [r] : [...value, r]);
    setQ("");
    setOpen(false);
  }

  function addContact(c: Contact) {
    add({ name: c.name, email: c.email, known: true });
  }

  function addTyped() {
    const raw = q.trim();
    if (!raw) return;
    const parsed = /<([^>]+)>/.exec(raw)?.[1] ?? raw;
    if (!isEmail(parsed)) return;
    const name = raw.includes("<") ? raw.split("<")[0]!.trim() : parsed.split("@")[0]!;
    add({ name: name || parsed, email: parsed, known: false });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && q === "" && value.length) {
      onChange(value.slice(0, -1));
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (options ? (i + 1) % options : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (options ? (i - 1 + options) % options : 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && active < matches.length && matches[active]) addContact(matches[active]!);
      else addTyped();
      return;
    }
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="space-y-1.5" ref={boxRef}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div
        className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-lg border border-hairline bg-card px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/40"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((r) => (
          <span
            key={r.email}
            title={r.email}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
              r.known
                ? "border-ember/40 bg-ember-soft text-ember"
                : "border-hairline bg-surface text-foreground",
            )}
          >
            <span className="grid size-4 place-items-center rounded-full bg-ember/15 text-[9px] font-semibold text-ember">
              {initials(r.name)}
            </span>
            {r.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((v) => v.email !== r.email));
              }}
              aria-label={`Remove ${r.name}`}
              className="opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
        {full ? null : (
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={value.length ? "" : placeholder}
            aria-label={label}
            className="min-w-[10rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
          />
        )}
      </div>

      {open && (matches.length > 0 || showAddNew) ? (
        <div className="relative">
          <ul
            role="listbox"
            className="absolute z-30 max-h-64 w-full overflow-auto rounded-xl border border-hairline bg-card p-1 shadow-soft"
          >
            {matches.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => addContact(c)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left",
                    i === active ? "bg-accent" : "hover:bg-accent",
                  )}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ember/15 text-[11px] font-semibold text-ember">
                    {initials(c.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                  </span>
                  {c.company ? (
                    <span className="shrink-0 rounded-full border border-hairline px-2 py-0.5 text-[10px] text-muted-foreground">
                      {c.company}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
            {showAddNew ? (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={active === matches.length}
                  onMouseEnter={() => setActive(matches.length)}
                  onClick={addTyped}
                  disabled={!isEmail(/<([^>]+)>/.exec(q.trim())?.[1] ?? q.trim())}
                  className={cn(
                    "w-full rounded-lg px-2.5 py-2 text-left text-sm disabled:opacity-40",
                    active === matches.length ? "bg-accent" : "hover:bg-accent",
                  )}
                >
                  Add new: <span className="font-medium">{q.trim()}</span>
                  {isEmail(/<([^>]+)>/.exec(q.trim())?.[1] ?? q.trim()) ? null : (
                    <span className="ml-1 text-xs text-muted-foreground">
                      — needs a full email address
                    </span>
                  )}
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Home,
  Paperclip,
  Pencil,
  Receipt,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { deleteMoneyExpense, listClients, listMoneyExpenses, listMoneyYears } from "@/lib/api";
import { CATEGORIES, ExpenseDialog } from "@/components/lumen/ExpenseDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ExpenseCategory, MoneyExpense } from "@/lib/types";

export const Route = createFileRoute("/money")({
  head: () => ({
    meta: [
      { title: "Money — Lumen" },
      {
        name: "description",
        content:
          "Expenses, receipts and tax-year totals for the studio — logged in seconds, sorted for year end.",
      },
      { property: "og:title", content: "Money — Lumen" },
      {
        property: "og:description",
        content: "The studio's expenses, receipts and tax-year totals in one calm place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MoneyPage,
});

const TABS = ["Overview", "Expenses", "Household", "Receivables", "Year-End"] as const;
type Tab = (typeof TABS)[number];

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function monthKey(iso: string) {
  return iso.slice(0, 7);
}
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function MoneyPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState<Tab>("Overview");

  const years = useQuery({ queryKey: ["money", "years"], queryFn: listMoneyYears });
  const expenses = useQuery({
    queryKey: ["money", "expenses", year],
    queryFn: () => listMoneyExpenses(year),
  });

  const rows = expenses.data ?? [];
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title text-3xl font-semibold tracking-tight">Money</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Log it and forget it — receipts do the rest.
          </p>
        </div>
        <YearSelector
          year={year}
          currentYear={currentYear}
          years={years.data ?? [currentYear]}
          onChange={setYear}
        />
      </header>

      <div className="flex flex-wrap gap-1.5 border-b border-hairline pb-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-current={tab === t ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-[13px] transition-colors",
              tab === t
                ? "bg-ember text-[oklch(0.99_0.005_85)]"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <Overview
          rows={rows}
          year={year}
          total={total}
          loading={expenses.isLoading}
          onOpenExpenses={() => setTab("Expenses")}
        />
      ) : tab === "Expenses" ? (
        <Expenses rows={rows} year={year} total={total} loading={expenses.isLoading} />
      ) : (
        <Placeholder tab={tab} />
      )}
    </div>
  );
}

function YearSelector({
  year,
  currentYear,
  years,
  onChange,
}: {
  year: number;
  currentYear: number;
  years: number[];
  onChange: (y: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const previous = years.filter((y) => y !== currentYear);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm hover:bg-accent">
          <span className="font-medium">Tax year {year}</span>
          {year === currentYear ? (
            <span className="rounded-full bg-ember/15 px-2 py-0.5 text-[11px] text-ember">
              Current
            </span>
          ) : null}
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        <button
          onClick={() => {
            onChange(currentYear);
            setOpen(false);
          }}
          className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-accent"
        >
          {currentYear} · Current
          {year === currentYear ? <Check className="size-3.5 text-ember" /> : null}
        </button>
        {previous.length ? (
          <>
            <p className="px-2.5 pb-1 pt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              Previous years
            </p>
            {previous.map((y) => (
              <button
                key={y}
                onClick={() => {
                  onChange(y);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-accent"
              >
                {y}
                {year === y ? <Check className="size-3.5 text-ember" /> : null}
              </button>
            ))}
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function Overview({
  rows,
  year,
  total,
  loading,
  onOpenExpenses,
}: {
  rows: MoneyExpense[];
  year: number;
  total: number;
  loading: boolean;
  onOpenExpenses: () => void;
}) {
  const top = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const r of rows) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amount);
    return [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [rows]);
  const max = top[0]?.[1] ?? 1;

  if (loading) return <SkeletonBlock />;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-hairline bg-surface p-5">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Expenses this year
        </p>
        <p className="text-title mt-2 text-3xl font-semibold">{money(total)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} logged in {year}
        </p>
      </div>

      <div className="rounded-xl border border-hairline bg-surface p-5">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Top categories</p>
        <ul className="mt-3 space-y-2.5">
          {top.length ? (
            top.map(([cat, amt]) => (
              <li key={cat}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{cat}</span>
                  <span className="text-muted-foreground">{money(amt)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-accent">
                  <div
                    className="h-1.5 rounded-full bg-ember/70"
                    style={{ width: `${Math.max(6, (amt / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))
          ) : (
            <li className="text-sm text-muted-foreground">Nothing logged yet for {year}.</li>
          )}
        </ul>
      </div>

      <div className="rounded-xl border border-hairline bg-surface p-5">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Recent</p>
        <ul className="mt-3 space-y-2">
          {rows.slice(0, 5).map((r) => (
            <li key={r.id}>
              <button
                onClick={onOpenExpenses}
                className="flex w-full items-baseline justify-between gap-3 rounded-md px-1 py-1 text-left text-sm hover:bg-accent"
              >
                <span className="truncate">{r.vendor}</span>
                <span className="shrink-0 text-muted-foreground">{money(r.amount)}</span>
              </button>
            </li>
          ))}
          {!rows.length ? (
            <li className="text-sm text-muted-foreground">Your first expense will land here.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

function Expenses({
  rows,
  year,
  total,
  loading,
}: {
  rows: MoneyExpense[];
  year: number;
  total: number;
  loading: boolean;
}) {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ExpenseCategory | "all">("all");
  const [dialog, setDialog] = useState<{ open: boolean; expense?: MoneyExpense | undefined }>({
    open: false,
  });
  const [confirm, setConfirm] = useState<string | null>(null);

  const filtered = rows.filter((r) => {
    const okCat = cat === "all" || r.category === cat;
    const needle = q.trim().toLowerCase();
    const okQ =
      !needle ||
      r.vendor.toLowerCase().includes(needle) ||
      (r.notes ?? "").toLowerCase().includes(needle);
    return okCat && okQ;
  });

  const groups = useMemo(() => {
    const m = new Map<string, MoneyExpense[]>();
    for (const r of filtered) {
      const k = monthKey(r.dateISO);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const clientName = (id?: string) => (clients.data ?? []).find((c) => c.id === id)?.name;

  async function remove(id: string) {
    await deleteMoneyExpense(id);
    await qc.invalidateQueries({ queryKey: ["money"] });
    setConfirm(null);
    toast.success("Expense deleted.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-title text-xl font-semibold">{year} expenses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {money(total)} across {rows.length} {rows.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        <button
          onClick={() => setDialog({ open: true })}
          className="rounded-lg bg-ember px-3.5 py-2 text-sm font-medium text-[oklch(0.99_0.005_85)]"
        >
          Log expense
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search vendor or notes"
            aria-label="Search expenses"
            className="w-full rounded-lg border border-hairline bg-surface py-2 pl-8 pr-3 text-sm outline-none focus:border-ember/60 focus:ring-2 focus:ring-ember/20"
          />
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value as ExpenseCategory | "all")}
          aria-label="Filter by category"
          className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <SkeletonBlock />
      ) : !groups.length ? (
        <div className="rounded-xl border border-dashed border-hairline p-10 text-center">
          <Receipt className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="text-title mt-3 text-lg">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {q || cat !== "all"
              ? "No expenses match that — try a wider filter."
              : `Log your first ${year} expense and the year-end pile starts sorting itself.`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([key, list]) => {
            const subtotal = list.reduce((s, r) => s + r.amount, 0);
            return (
              <section key={key}>
                <header className="flex items-baseline justify-between border-b border-hairline pb-1.5">
                  <h3 className="text-title text-sm font-semibold">{monthLabel(key)}</h3>
                  <span className="text-[12px] text-muted-foreground">{money(subtotal)}</span>
                </header>
                <ul className="divide-y divide-hairline">
                  {list.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                      <span className="w-14 shrink-0 text-muted-foreground">
                        {new Date(r.dateISO).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="min-w-32 flex-1 truncate font-medium">{r.vendor}</span>
                      <span className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">
                        {r.category}
                      </span>
                      {r.clientId ? (
                        <span className="text-[11px] text-muted-foreground">
                          {clientName(r.clientId)}
                        </span>
                      ) : null}
                      {r.payment ? (
                        <span className="hidden text-[11px] text-muted-foreground sm:inline">
                          {r.payment}
                        </span>
                      ) : null}
                      {r.receiptName ? (
                        <Paperclip
                          className="size-3.5 text-muted-foreground"
                          aria-label={`Receipt attached: ${r.receiptName}`}
                        />
                      ) : null}
                      <span className="w-20 text-right tabular-nums">{money(r.amount)}</span>
                      <span className="flex gap-1">
                        <button
                          aria-label={`Edit ${r.vendor}`}
                          onClick={() => setDialog({ open: true, expense: r })}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          aria-label={`Delete ${r.vendor}`}
                          onClick={() => setConfirm(r.id)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                      {confirm === r.id ? (
                        <span className="flex w-full items-center gap-2 rounded-md bg-accent px-2.5 py-1.5 text-[12px]">
                          Delete this expense?
                          <button
                            onClick={() => void remove(r.id)}
                            className="rounded-md bg-destructive px-2 py-0.5 text-destructive-foreground"
                          >
                            Delete
                          </button>
                          <button onClick={() => setConfirm(null)} className="underline">
                            Keep it
                          </button>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <ExpenseDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog({ open: v })}
        expense={dialog.expense}
        defaultYear={year}
      />
    </div>
  );
}

const placeholderCopy: Record<string, { icon: typeof Home; title: string; body: string }> = {
  Household: {
    icon: Home,
    title: "Household expenses arrive in a later build",
    body: "Rent, power, internet — your home-office deduction will assemble itself here.",
  },
  Receivables: {
    icon: Wallet,
    title: "Receivables arrive in a later build",
    body: "Who owes you, how long it's been, and the nudge already written.",
  },
  "Year-End": {
    icon: Receipt,
    title: "Year-end packet arrives in a later build",
    body: "One tidy summary for your accountant — categories totalled, receipts attached.",
  },
};

function Placeholder({ tab }: { tab: Tab }) {
  const meta = placeholderCopy[tab]!;
  const Icon = meta.icon;
  return (
    <div className="rounded-xl border border-dashed border-hairline px-6 py-16 text-center">
      <Icon className="mx-auto size-6 text-muted-foreground" aria-hidden />
      <p className="text-title mt-3 text-lg">{meta.title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{meta.body}</p>
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-accent/60" />
      ))}
    </div>
  );
}

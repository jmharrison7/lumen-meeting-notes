import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Home,
  Loader2,
  Paperclip,
  Pencil,
  Receipt,
  Search,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  analyzeReceipt,
  createHouseholdExpense,
  createIncome,
  createMoneyExpense,
  deleteHouseholdExpense,
  deleteIncome,
  deleteMoneyExpense,
  getHomeOfficeSettings,
  getYearEndSummary,
  listClients,
  listHouseholdExpenses,
  listIncome,
  listMoneyExpenses,
  listMoneyYears,
  normalizeVendor,
  updateHouseholdExpense,
  updateIncome,
  yearBundleUrl,
  yearWorkbookUrl,
} from "@/lib/api";
import type { ReceiptAnalysis } from "@/lib/api";
import { CATEGORIES, ExpenseDialog } from "@/components/lumen/ExpenseDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAccess } from "@/lib/access-store";
import { useScope } from "@/lib/scope-store";
import type {
  ExpenseCategory,
  HouseholdCategory,
  HouseholdExpense,
  IncomeEntry,
  IntakeBucket,
  MoneyExpense,
  YearEndSummary,
} from "@/lib/types";

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
  const { scope, setScope } = useScope();
  const { isOwner } = useAccess();

  const years = useQuery({ queryKey: ["money", "years"], queryFn: listMoneyYears, enabled: isOwner && scope === "work" });
  const expenses = useQuery({
    queryKey: ["money", "expenses", year],
    queryFn: () => listMoneyExpenses(year),
    enabled: isOwner && scope === "work",
  });

  const rows = expenses.data ?? [];
  const total = rows.reduce((s, r) => s + r.amount, 0);

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-hairline bg-card p-8 text-center">
        <Wallet className="mx-auto size-8 text-muted-foreground" />
        <h1 className="text-title mt-3 text-xl font-semibold">Money is private</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Expenses, receipts and tax-year totals are only available to Mary.
        </p>
      </div>
    );
  }

  if (scope === "personal") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-hairline bg-card p-8 text-center">
        <Wallet className="mx-auto size-8 text-muted-foreground" />
        <h1 className="text-title mt-3 text-xl font-semibold">Money lives in Work</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Expenses, receipts and tax-year totals are part of the studio workspace — switch over
          to Work to see them.
        </p>
        <button
          onClick={() => setScope("work")}
          className="mt-4 inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-ember px-4 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90"
        >
          <Home className="size-4" /> Switch to Work
        </button>
      </div>
    );
  }

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
      ) : tab === "Household" ? (
        <Household year={year} />
      ) : tab === "Year-End" ? (
        <YearEnd rows={rows} year={year} loading={expenses.isLoading} />
      ) : tab === "Receivables" ? (
        <Receivables year={year} />
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

/**
 * The single intake point for money documents. Drop a receipt, a bill, or an
 * invoice you issued; Lumen reads it, decides which pile it belongs to, and files
 * it there — EMBR business expenses, Household, or Receivables (money in).
 *
 * Two guards matter. A utility or household bill never lands in business expenses
 * (the server enforces that too, so no other client can bypass it), and a document
 * that is already logged is skipped rather than filed twice — the duplicate check
 * compares NORMALISED vendor names, because the analyzer renders the same company
 * several ways and a raw comparison silently misses it.
 */
function IntakeZone({ year }: { year: number }) {
  const qc = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const allExpenses = useQuery({ queryKey: ["money", "all"], queryFn: () => listMoneyExpenses() });
  const allHousehold = useQuery({
    queryKey: ["money", "household", "all"],
    queryFn: () => listHouseholdExpenses(),
  });
  const allIncome = useQuery({
    queryKey: ["money", "income", "all"],
    queryFn: () => listIncome(),
  });

  const labelFor = (b: IntakeBucket) =>
    b === "household" ? "Household" : b === "income" ? "Receivables" : "Expenses";

  /** Is this document already logged, in any of the three places? */
  function findDuplicate(vendor: string, amount: number, dateISO: string): IntakeBucket | null {
    const v = normalizeVendor(vendor);
    const t = Date.parse(`${dateISO}T12:00:00Z`);
    const near = (iso: string) => Math.abs(Date.parse(iso) - t) <= 3 * 86400000;
    const match = (name: string, amt: number, iso: string) =>
      normalizeVendor(name) === v && Math.abs(amt - amount) < 0.01 && near(iso);
    if ((allExpenses.data ?? []).some((r) => match(r.vendor, r.amount, r.dateISO))) return "business";
    if ((allHousehold.data ?? []).some((r) => match(r.vendor ?? "", r.amount, r.dateISO)))
      return "household";
    if ((allIncome.data ?? []).some((r) => match(r.payer, r.amount, r.dateISO))) return "income";
    return null;
  }

  function filed(bucket: IntakeBucket, id: string, vendor: string, amount: number) {
    void qc.invalidateQueries({ queryKey: ["money"] });
    toast.success(`${vendor} · ${money(amount)} → ${labelFor(bucket)}`, {
      description:
        bucket === "household" ? "Filed with the house, home-office share included." : undefined,
      action: {
        label: "Undo",
        onClick: () => {
          void (async () => {
            try {
              if (bucket === "household") await deleteHouseholdExpense(id);
              else if (bucket === "income") await deleteIncome(id);
              else await deleteMoneyExpense(id);
              await qc.invalidateQueries({ queryKey: ["money"] });
              toast.success("Removed.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Couldn't undo that.");
            }
          })();
        },
      },
    });
  }

  async function fileIt(parsed: ReceiptAnalysis, force: boolean) {
    const bucket = parsed.bucket ?? "business";
    const vendor = (parsed.vendor || "").trim() || "Unknown";
    const amount = Math.round(Number(parsed.amount) * 100) / 100;
    const dateISO = parsed.dateISO || `${year}-12-31`;

    if (!force) {
      const where = findDuplicate(vendor, amount, dateISO);
      if (where) {
        toast(`Already in ${labelFor(where)} — skipped`, {
          description: `${vendor} · ${money(amount)} on ${dateISO}. Nothing was imported.`,
          action: { label: "Import anyway", onClick: () => void fileIt(parsed, true) },
        });
        return;
      }
    }

    try {
      if (bucket === "income") {
        const row = await createIncome({
          dateISO,
          payer: vendor,
          amount,
          category: parsed.category,
          notes: parsed.notes,
          source: "receipt-intake",
          receiptFile: parsed.receiptFile,
        });
        filed(bucket, row.id, vendor, amount);
      } else if (bucket === "household") {
        const row = await createHouseholdExpense({
          dateISO,
          category: parsed.householdCategory ?? "Utilities",
          vendor,
          amount,
          homeOfficeEligible: true,
          source: "receipt-intake",
          receiptFile: parsed.receiptFile,
        });
        filed(bucket, row.id, vendor, amount);
      } else {
        const row = await createMoneyExpense({
          dateISO,
          vendor,
          amount,
          category: parsed.category,
          notes: parsed.notes,
          receiptName: parsed.receiptName,
          receiptFile: parsed.receiptFile,
        });
        filed(bucket, row.id, vendor, amount);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't file that one.");
    }
  }

  async function handleFiles(files: File[]) {
    const list = files.filter(Boolean);
    if (!list.length) return;
    setBusy(true);
    try {
      for (const f of list) {
        try {
          const parsed = { ...(await analyzeReceipt(f)), receiptName: f.name };
          await fileIt(parsed, false);
        } catch (e) {
          toast.error(`${f.name}: ${e instanceof Error ? e.message : "couldn't read it."}`);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleFiles([...e.dataTransfer.files]);
      }}
      onClick={() => fileRef.current?.click()}
      role="button"
      aria-label="Upload a receipt, bill or invoice"
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
        dragOver ? "border-ember/70 bg-ember/10" : "border-hairline bg-surface hover:border-ember/40",
      )}
    >
      {busy ? (
        <>
          <Loader2 className="size-5 animate-spin text-ember" aria-hidden />
          <span className="text-sm">Reading it…</span>
        </>
      ) : (
        <>
          <Upload className="size-5 text-ember" aria-hidden />
          <span className="text-sm font-medium">Drop a receipt, bill or invoice here</span>
          <span className="text-xs text-muted-foreground">
            Lumen reads it and files it — business expenses, household, or money in.
          </span>
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          void handleFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </div>
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
      <div className="md:col-span-3">
        <IntakeZone year={year} />
      </div>

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
  const [dialog, setDialog] = useState<{
    open: boolean;
    expense?: MoneyExpense | undefined;
    prefill?: ReceiptAnalysis | undefined;
  }>({ open: false });
  const [confirm, setConfirm] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Batch receipt upload: dropped files queue up and are confirmed one at a time.
  const [batch, setBatch] = useState<{ total: number; done: number; skipped: number } | null>(null);
  const receiptFileRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<File[]>([]);
  // Set when the dialog reports a deliberate skip, so the batch advance can tell a
  // skipped receipt from a logged one instead of counting both as logged.
  const skipRef = useRef(false);

  function finishBatch() {
    setBatch((b) => {
      if (b && (b.done > 0 || b.skipped > 0)) {
        const logged = `${b.done} receipt${b.done === 1 ? "" : "s"} logged`;
        toast.success(
          b.skipped ? `${logged}, ${b.skipped} skipped as already recorded.` : `${logged}.`,
        );
      }
      return null;
    });
    setAnalyzing(false);
  }

  /** Read the next queued receipt and open the dialog for it. */
  async function nextFromQueue() {
    const file = queueRef.current.shift();
    if (!file) {
      finishBatch();
      return;
    }
    setAnalyzing(true);
    try {
      const parsed = await analyzeReceipt(file);
      setDialog({ open: true, prefill: { ...parsed, receiptName: file.name } });
    } catch (e) {
      // One unreadable scan must not stall the rest of the batch.
      toast.error(`${file.name}: ${e instanceof Error ? e.message : "couldn't read it."}`);
      setBatch((b) => (b ? { ...b, done: b.done + 1 } : b));
      await nextFromQueue();
      return;
    }
    setAnalyzing(false);
  }

  /** Accept one or many receipts at once; extras queue behind the open one. */
  function handleReceiptFiles(files: File[]) {
    const list = files.filter(Boolean);
    if (!list.length) return;
    const idle = !analyzing && !batch;
    queueRef.current = queueRef.current.concat(list);
    if (idle) {
      setBatch({ total: queueRef.current.length, done: 0, skipped: 0 });
      void nextFromQueue();
    } else {
      setBatch((b) => ({
        total: (b?.total ?? 0) + list.length,
        done: b?.done ?? 0,
        skipped: b?.skipped ?? 0,
      }));
    }
  }

  /** The dialog closed — move on to the next queued receipt. A skipped one is not counted as logged. */
  function advanceBatch(skipped = false) {
    if (!batch) return;
    setBatch((b) =>
      b ? { ...b, done: b.done + (skipped ? 0 : 1), skipped: b.skipped + (skipped ? 1 : 0) } : b,
    );
    if (!queueRef.current.length) {
      finishBatch();
      return;
    }
    // Let the close commit before reopening: ExpenseDialog seeds its fields from
    // [open, expense?.id] only, so `open` has to go false first or the next
    // receipt would show the previous one's values.
    setTimeout(() => void nextFromQueue(), 60);
  }

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

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleReceiptFiles([...e.dataTransfer.files]);
        }}
        onClick={() => receiptFileRef.current?.click()}
        role="button"
        aria-label="Upload a receipt to auto-fill an expense"
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
          dragOver ? "border-ember/70 bg-ember/10" : "border-hairline bg-surface hover:border-ember/40",
        )}
      >
        {analyzing ? (
          <>
            <Loader2 className="size-5 animate-spin text-ember" aria-hidden />
            <span className="text-sm">
              {batch && batch.total > 1
                ? `Reading receipt ${Math.min(batch.done + 1, batch.total)} of ${batch.total}…`
                : "Reading the receipt…"}
            </span>
          </>
        ) : batch ? (
          <>
            <Upload className="size-5 text-ember" aria-hidden />
            <span className="text-sm">
              {batch.done} of {batch.total} logged
            {batch.skipped ? ` · ${batch.skipped} skipped` : ""} — confirm the open receipt to continue
            </span>
          </>
        ) : (
          <>
            <Upload className={cn("size-5", dragOver ? "text-ember" : "text-muted-foreground")} aria-hidden />
            <span className="text-sm">
              Drop receipts here, or <span className="text-ember">browse</span> — photo or PDF
            </span>
            <span className="text-[11px] text-muted-foreground">
              Multiple at once is fine — Lumen reads each and fills in vendor, amount, date &amp; category.
            </span>
          </>
        )}
        <input
          ref={receiptFileRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => {
            void handleReceiptFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
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
        onOpenChange={(v) => {
          setDialog({ open: v });
          if (!v) {
            const skipped = skipRef.current;
            skipRef.current = false;
            advanceBatch(skipped);
          }
        }}
        onSkip={() => {
          skipRef.current = true;
          if (!batch) toast.success("Skipped — nothing logged.");
        }}
        expense={dialog.expense}
        prefill={dialog.prefill}
        defaultYear={year}
      />
    </div>
  );
}

/** Household bill categories. Mirrors HOUSEHOLD_CATS on the server. */
export const HOUSEHOLD_CATS: HouseholdCategory[] = [
  "Electricity",
  "Water/Sewer",
  "Internet",
  "Garbage/Recycling",
  "Gas",
  "Mortgage Interest",
  "Property Tax",
  "Insurance",
  "Repairs/Maintenance",
  "Home Office",
  "Other",
];

/**
 * Household bills — the other half of Money. Each row can be flagged home-office
 * eligible, and the studio's percentage (from the server's meta table) turns the
 * eligible total into the figure the accountant needs.
 */
function Household({ year }: { year: number }) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; row?: HouseholdExpense | undefined }>({
    open: false,
  });
  const [confirm, setConfirm] = useState<string | null>(null);

  const rowsQ = useQuery({
    queryKey: ["money", "household", year],
    queryFn: () => listHouseholdExpenses(year),
  });
  const settingsQ = useQuery({
    queryKey: ["money", "household", "settings"],
    queryFn: getHomeOfficeSettings,
  });

  const rows = rowsQ.data ?? [];
  const pct = settingsQ.data?.homeOfficePct ?? null;
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const eligible = rows.filter((r) => r.homeOfficeEligible).reduce((s, r) => s + r.amount, 0);
  const deductible = pct == null ? null : eligible * pct;
  const pctLabel = pct == null ? "" : `${(pct * 100).toFixed(2)}%`;

  const groups = useMemo(() => {
    const m = new Map<string, HouseholdExpense[]>();
    for (const r of rows) {
      const k = monthKey(r.dateISO);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  async function remove(id: string) {
    await deleteHouseholdExpense(id);
    await qc.invalidateQueries({ queryKey: ["money"] });
    setConfirm(null);
    toast.success("Household expense deleted.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-title text-xl font-semibold">{year} household</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {money(total)} across {rows.length} {rows.length === 1 ? "bill" : "bills"}
          </p>
        </div>
        <button
          onClick={() => setDialog({ open: true })}
          className="rounded-lg bg-ember px-3.5 py-2 text-sm font-medium text-[oklch(0.99_0.005_85)]"
        >
          Log expense
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-hairline bg-surface p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Household total
          </div>
          <div className="text-title mt-1 text-lg font-semibold tabular-nums">{money(total)}</div>
        </div>
        <div className="rounded-xl border border-hairline bg-surface p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Home-office eligible
          </div>
          <div className="text-title mt-1 text-lg font-semibold tabular-nums">{money(eligible)}</div>
        </div>
        <div className="rounded-xl border border-ember/40 bg-ember/10 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Deductible {pctLabel ? `(${pctLabel})` : ""}
          </div>
          <div className="text-title mt-1 text-lg font-semibold tabular-nums">
            {deductible == null ? "—" : money(deductible)}
          </div>
        </div>
      </div>

      {settingsQ.data?.note ? (
        <p className="text-[12px] text-muted-foreground">{settingsQ.data.note}</p>
      ) : null}

      {rowsQ.isLoading ? (
        <SkeletonBlock />
      ) : !groups.length ? (
        <div className="rounded-xl border border-dashed border-hairline p-10 text-center">
          <Home className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="text-title mt-3 text-lg">No household bills yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Power, internet, interest, property tax — anything the home-office share applies to.
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
                      <span className="min-w-32 flex-1 truncate font-medium">
                        {r.vendor || r.category}
                      </span>
                      <span className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">
                        {r.category}
                      </span>
                      {r.homeOfficeEligible ? (
                        <span className="rounded-full border border-ember/40 bg-ember/10 px-2 py-0.5 text-[11px] text-ember">
                          office{pctLabel ? ` ${pctLabel}` : ""}
                        </span>
                      ) : (
                        <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-muted-foreground">
                          not claimed
                        </span>
                      )}
                      <span className="w-24 text-right tabular-nums">{money(r.amount)}</span>
                      <span className="flex gap-1">
                        <button
                          aria-label={`Edit ${r.vendor || r.category}`}
                          onClick={() => setDialog({ open: true, row: r })}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          aria-label={`Delete ${r.vendor || r.category}`}
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

      <HouseholdDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog({ open: v })}
        row={dialog.row}
        defaultYear={year}
      />
    </div>
  );
}

function HouseholdDialog({
  open,
  onOpenChange,
  row,
  defaultYear,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row?: HouseholdExpense | undefined;
  defaultYear: number;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState(`${defaultYear}-12-31`);
  const [category, setCategory] = useState<HouseholdCategory>("Electricity");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [eligible, setEligible] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(row ? row.dateISO.slice(0, 10) : `${defaultYear}-12-31`);
    setCategory(row?.category ?? "Electricity");
    setVendor(row?.vendor ?? "");
    setAmount(row ? String(row.amount) : "");
    setEligible(row ? row.homeOfficeEligible : true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row?.id]);

  async function save() {
    const amt = Number(amount);
    if (!date) {
      toast.error("Pick a date.");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Add an amount.");
      return;
    }
    setSaving(true);
    const payload = {
      dateISO: new Date(`${date}T12:00:00Z`).toISOString(),
      category,
      vendor: vendor.trim(),
      amount: Math.round(amt * 100) / 100,
      homeOfficeEligible: eligible,
    };
    try {
      if (row) await updateHouseholdExpense(row.id, payload);
      else await createHouseholdExpense(payload);
      await qc.invalidateQueries({ queryKey: ["money"] });
      toast.success(row ? "Household bill updated." : "Household bill logged.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title">
            {row ? "Edit household expense" : "Log household expense"}
          </DialogTitle>
          <DialogDescription>
            Bills for the home. Anything marked eligible gets the home-office percentage applied.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Date
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-lg border border-hairline bg-surface px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Amount
              </span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1 min-h-[44px] w-full rounded-lg border border-hairline bg-surface px-3 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Category
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as HouseholdCategory)}
              className="mt-1 h-11 w-full rounded-lg border border-hairline bg-card px-2.5 text-sm"
            >
              {HOUSEHOLD_CATS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Paid to
            </span>
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Puget Sound Energy, Navy Federal…"
              className="mt-1 min-h-[44px] w-full rounded-lg border border-hairline bg-surface px-3 text-sm"
            />
          </label>
          <label className="flex items-center gap-2.5 rounded-lg border border-hairline bg-surface px-3 py-3">
            <input
              type="checkbox"
              checked={eligible}
              onChange={(e) => setEligible(e.target.checked)}
              className="size-4"
            />
            <span className="text-sm">Home-office eligible — apply the percentage</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-ember px-4 text-sm font-medium text-[oklch(0.99_0.005_85)] disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {row ? "Save changes" : "Log it"}
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-hairline px-4 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function YearEnd({
  rows,
  year,
  loading,
}: {
  rows: MoneyExpense[];
  year: number;
  loading: boolean;
}) {
  const summary = useQuery({
    queryKey: ["money", "summary", year],
    queryFn: () => getYearEndSummary(year),
  });
  const household = useQuery({
    queryKey: ["money", "household", year],
    queryFn: () => listHouseholdExpenses(year),
  });

  const hhRows = household.data ?? [];
  const s = summary.data;

  const bizRows = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    for (const r of rows) {
      const cur = m.get(r.category) ?? { total: 0, count: 0 };
      cur.total += r.amount;
      cur.count += 1;
      m.set(r.category, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [rows]);

  const homeRows = useMemo(() => {
    const m = new Map<string, { total: number; count: number; eligible: number }>();
    for (const r of hhRows) {
      const cur = m.get(r.category) ?? { total: 0, count: 0, eligible: 0 };
      cur.total += r.amount;
      cur.count += 1;
      if (r.homeOfficeEligible) cur.eligible += r.amount;
      m.set(r.category, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [hhRows]);

  const pct = s?.homeOfficePct ?? null;
  const incomeCount = s?.income.count ?? 0;
  const withReceipt = rows.filter((r) => r.receiptFile).length;
  const hhWithReceipt = hhRows.filter((r) => r.receiptFile).length;
  const storedFiles = withReceipt + hhWithReceipt;

  function exportCsv() {
    const esc = (v: unknown) => {
      const t = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const lines = ["table,date,category,vendor,amount,home_office_eligible,office_share"];
    for (const r of rows)
      lines.push(
        ["business", r.dateISO.slice(0, 10), r.category, r.vendor, r.amount.toFixed(2), "", ""]
          .map(esc)
          .join(","),
      );
    for (const r of hhRows)
      lines.push(
        [
          "household",
          r.dateISO.slice(0, 10),
          r.category,
          r.vendor,
          r.amount.toFixed(2),
          r.homeOfficeEligible ? "yes" : "no",
          r.homeOfficeEligible && pct ? (r.amount * pct).toFixed(2) : "",
        ]
          .map(esc)
          .join(","),
      );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lumen-${year}-year-end.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length + hhRows.length} rows for ${year}`);
  }

  if (loading || summary.isLoading || household.isLoading) return <SkeletonBlock />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-title text-xl font-semibold">Year-end packet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything {year} in one place — categories totalled and the office share worked out.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              window.location.href = yearBundleUrl(year);
            }}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-ember px-4 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90"
          >
            <Archive className="size-4" /> Download .zip
          </button>
          <button
            onClick={() => {
              window.location.href = yearWorkbookUrl(year);
            }}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-hairline px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            <FileSpreadsheet className="size-4" /> Excel
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-hairline px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Download className="size-4" /> CSV
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-hairline bg-surface p-5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Business expenses
          </p>
          <p className="text-title mt-2 text-3xl font-semibold">
            {money(s?.expenses.total ?? 0)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {s?.expenses.count ?? 0} rows in {year}
          </p>
        </div>

        <div className="rounded-xl border border-hairline bg-surface p-5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Household, office-eligible
          </p>
          <p className="text-title mt-2 text-3xl font-semibold">
            {money(s?.householdEligible.total ?? 0)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {s?.householdEligible.count ?? 0} bills{pct ? ` × ${(pct * 100).toFixed(2)}%` : ""}
          </p>
        </div>

        <div className="rounded-xl border border-ember/40 bg-surface p-5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Home-office deduction
          </p>
          <p className="text-title mt-2 text-3xl font-semibold">
            {money(s?.homeOfficeDeduction ?? 0)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">the share of the house you claim</p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-hairline bg-surface p-5">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Income</p>
        {incomeCount ? (
          <p className="mt-2 text-sm">
            {money(s?.income.total ?? 0)} across {incomeCount} entries —{" "}
            <span className="font-medium">net {money(s?.netBusiness ?? 0)}</span>
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm">
              <span className="font-medium">None recorded for {year}</span> — Lumen holds no income
              rows for this year.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              No net figure is shown until that is confirmed. The arithmetic would read as{" "}
              {money(Math.abs(s?.netBusiness ?? 0))} out and nothing in, which only means something
              if this really was an income-free year.
            </p>
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-hairline bg-surface p-5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Business, by category
          </p>
          <ul className="mt-3 space-y-2.5">
            {bizRows.length ? (
              bizRows.map(([cat, v]) => (
                <li key={cat}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{cat}</span>
                    <span className="shrink-0 text-muted-foreground">{money(v.total)}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{v.count} rows</div>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">Nothing logged for {year}.</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-hairline bg-surface p-5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Household, by category
          </p>
          <ul className="mt-3 space-y-2.5">
            {homeRows.length ? (
              homeRows.map(([cat, v]) => (
                <li key={cat}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{cat}</span>
                    <span className="shrink-0 text-muted-foreground">{money(v.total)}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {v.count} bills{pct ? ` · office ${money(v.eligible * pct)}` : ""}
                  </div>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">No household bills for {year}.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-hairline bg-surface p-5">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          The packet for your preparer
        </p>
        <p className="mt-2 text-sm">
          {storedFiles} receipt {storedFiles === 1 ? "file" : "files"} stored for {year} (
          {withReceipt} business, {hhWithReceipt} household).
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          The .zip holds every stored receipt filed by folder, an index.csv of what is included, and
          the Excel workbook with the totals. Rows whose receipt was never captured show a blank
          receipt column in the index.
        </p>
      </div>
    </div>
  );
}

/**
 * Money in — client payments and invoices issued. Mirrors the Household tab's
 * shape so the two read the same way. There is no "who still owes you" view yet:
 * money_income records what came in, and nothing in it marks a paid invoice.
 */
function Receivables({ year }: { year: number }) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; row?: IncomeEntry | undefined }>({
    open: false,
  });
  const [confirm, setConfirm] = useState<string | null>(null);

  const rowsQ = useQuery({
    queryKey: ["money", "income", year],
    queryFn: () => listIncome(year),
  });

  const rows = rowsQ.data ?? [];
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const payers = new Set(rows.map((r) => normalizeVendor(r.payer))).size;

  const groups = useMemo(() => {
    const m = new Map<string, IncomeEntry[]>();
    for (const r of rows) {
      const k = monthKey(r.dateISO);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  async function remove(id: string) {
    await deleteIncome(id);
    await qc.invalidateQueries({ queryKey: ["money"] });
    setConfirm(null);
    toast.success("Payment deleted.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-title text-xl font-semibold">{year} received</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {money(total)} across {rows.length} {rows.length === 1 ? "payment" : "payments"}
          </p>
        </div>
        <button
          onClick={() => setDialog({ open: true })}
          className="rounded-lg bg-ember px-3.5 py-2 text-sm font-medium text-[oklch(0.99_0.005_85)]"
        >
          Log income
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-hairline bg-surface p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Received this year
          </div>
          <div className="text-title mt-1 text-lg font-semibold tabular-nums">{money(total)}</div>
        </div>
        <div className="rounded-xl border border-hairline bg-surface p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Payments logged
          </div>
          <div className="text-title mt-1 text-lg font-semibold tabular-nums">{rows.length}</div>
        </div>
        <div className="rounded-xl border border-hairline bg-surface p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Payers</div>
          <div className="text-title mt-1 text-lg font-semibold tabular-nums">{payers}</div>
        </div>
      </div>

      {rowsQ.isLoading ? (
        <SkeletonBlock />
      ) : !groups.length ? (
        <div className="rounded-xl border border-dashed border-hairline p-10 text-center">
          <Wallet className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="text-title mt-3 text-lg">No income logged for {year}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Payments received and invoices issued. Drop one on the Overview tab and it lands here.
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
                      <span className="min-w-32 flex-1 truncate font-medium">{r.payer}</span>
                      <span className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">
                        {r.category}
                      </span>
                      {r.invoiceId ? (
                        <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-muted-foreground">
                          #{r.invoiceId}
                        </span>
                      ) : null}
                      <span className="w-24 text-right tabular-nums">{money(r.amount)}</span>
                      <span className="flex gap-1">
                        <button
                          aria-label={`Edit ${r.payer}`}
                          onClick={() => setDialog({ open: true, row: r })}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          aria-label={`Delete ${r.payer}`}
                          onClick={() => setConfirm(r.id)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                      {confirm === r.id ? (
                        <span className="flex w-full items-center gap-2 rounded-md bg-accent px-2.5 py-1.5 text-[12px]">
                          Delete this payment?
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

      <IncomeDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog({ open: v })}
        row={dialog.row}
        defaultYear={year}
      />
    </div>
  );
}

function IncomeDialog({
  open,
  onOpenChange,
  row,
  defaultYear,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row?: IncomeEntry | undefined;
  defaultYear: number;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [payer, setPayer] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Client project");
  const [invoiceId, setInvoiceId] = useState("");
  const [payment, setPayment] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = new Date();
    const initial =
      defaultYear === today.getFullYear() ? today.toISOString().slice(0, 10) : `${defaultYear}-12-31`;
    setDate(row ? row.dateISO.slice(0, 10) : initial);
    setPayer(row?.payer ?? "");
    setAmount(row ? row.amount.toFixed(2) : "");
    setCategory(row?.category ?? "Client project");
    setInvoiceId(row?.invoiceId ?? "");
    setPayment(row?.payment ?? "");
    setNotes(row?.notes ?? "");
  }, [open, row, defaultYear]);

  async function save() {
    const amt = Number(amount);
    if (!payer.trim()) {
      toast.error("Who paid you?");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Add an amount.");
      return;
    }
    setSaving(true);
    const payload = {
      dateISO: new Date(`${date}T12:00:00Z`).toISOString(),
      payer: payer.trim(),
      amount: Math.round(amt * 100) / 100,
      category: category.trim() || "Client project",
      invoiceId: invoiceId.trim() || undefined,
      payment: payment.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    try {
      if (row) await updateIncome(row.id, payload);
      else await createIncome(payload);
      await qc.invalidateQueries({ queryKey: ["money"] });
      toast.success(row ? "Payment updated." : "Logged — money in.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  const field =
    "mt-1 min-h-[44px] w-full rounded-lg border border-hairline bg-surface px-3 text-sm";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-title">{row ? "Edit payment" : "Log income"}</DialogTitle>
          <DialogDescription>
            Money you received — a client payment, or an invoice you issued.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block">
            <span className="text-[12px] text-muted-foreground">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="text-[12px] text-muted-foreground">Paid by</span>
            <input
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              placeholder="Client or company"
              className={field}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] text-muted-foreground">Amount</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className={`${field} tabular-nums`}
              />
            </label>
            <label className="block">
              <span className="text-[12px] text-muted-foreground">Type</span>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Client project"
                className={field}
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] text-muted-foreground">Invoice #</span>
              <input
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                placeholder="Optional"
                className={field}
              />
            </label>
            <label className="block">
              <span className="text-[12px] text-muted-foreground">Payment</span>
              <input
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
                placeholder="Reference or last 4"
                className={field}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-[12px] text-muted-foreground">Notes</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className={field}
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-hairline px-3.5 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-ember px-3.5 py-2 text-sm font-medium text-[oklch(0.99_0.005_85)] disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {row ? "Save changes" : "Log income"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const placeholderCopy: Record<string, { icon: typeof Home; title: string; body: string }> = {
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

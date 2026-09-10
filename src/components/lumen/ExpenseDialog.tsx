import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Paperclip, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  analyzeReceipt,
  createMoneyExpense,
  listClients,
  listMoneyExpenses,
  updateMoneyExpense,
} from "@/lib/api";
import type { ReceiptAnalysis } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ExpenseCategory, MoneyExpense } from "@/lib/types";

export const CATEGORIES: ExpenseCategory[] = [
  "Advertising",
  "Software & Subscriptions",
  "Contractors",
  "Office Supplies",
  "Travel",
  "Meals (50%)",
  "Equipment",
  "Professional Services",
  "Insurance",
  "Utilities",
  "Home Office",
  "Other",
];

const PAYMENTS = ["Card ••4412", "Check", "Cash", "Bank transfer", "Other"];

const field =
  "w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-ember/60 focus:ring-2 focus:ring-ember/20";
const labelCls = "text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

const dayKey = (isoDate: string) => isoDate.slice(0, 10);

function daysApart(a: string, b: string) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}

type Suggestion = ReceiptAnalysis & { receiptName?: string };

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  defaultYear,
  prefill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expense?: MoneyExpense | undefined;
  defaultYear: number;
  prefill?: Suggestion | undefined;
}) {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const existing = useQuery({ queryKey: ["money", "all"], queryFn: () => listMoneyExpenses() });
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Date();
  const initialDate =
    defaultYear === today.getFullYear()
      ? today.toISOString().slice(0, 10)
      : `${defaultYear}-12-31`;

  const [date, setDate] = useState(initialDate);
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Software & Subscriptions");
  const [payment, setPayment] = useState("");
  const [notes, setNotes] = useState("");
  const [clientId, setClientId] = useState("");
  const [receiptName, setReceiptName] = useState<string | undefined>(undefined);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dupe, setDupe] = useState<MoneyExpense | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSuggestion(null);
    setDupe(null);
    if (expense) {
      setDate(dayKey(expense.dateISO));
      setVendor(expense.vendor);
      setAmount(expense.amount.toFixed(2));
      setCategory(expense.category);
      setPayment(expense.payment ?? "");
      setNotes(expense.notes ?? "");
      setClientId(expense.clientId ?? "");
      setReceiptName(expense.receiptName);
    } else if (prefill) {
      setDate(dayKey(prefill.dateISO ?? initialDate));
      setVendor(prefill.vendor);
      setAmount(prefill.amount.toFixed(2));
      setCategory(prefill.category);
      setPayment(prefill.payment ?? "");
      setNotes(prefill.notes ?? "");
      setClientId("");
      setReceiptName(prefill.receiptName);
    } else {
      setDate(initialDate);
      setVendor("");
      setAmount("");
      setCategory("Software & Subscriptions");
      setPayment("");
      setNotes("");
      setClientId("");
      setReceiptName(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id]);

  const knownVendors = useMemo(
    () => [...new Set((existing.data ?? []).map((x) => x.vendor))].sort(),
    [existing.data],
  );

  async function onFile(file: File | undefined) {
    if (!file) return;
    setReceiptName(file.name);
    setSuggestion(null);
    setAnalyzing(true);
    try {
      const parsed = await analyzeReceipt(file);
      setSuggestion({ ...parsed, receiptName: file.name });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that receipt.");
      setReceiptName(file.name); // keep the file attached; user can type fields manually
    } finally {
      setAnalyzing(false);
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    if (suggestion.dateISO) setDate(dayKey(suggestion.dateISO));
    setVendor(suggestion.vendor);
    setAmount(suggestion.amount.toFixed(2));
    setCategory(suggestion.category);
    if (suggestion.payment) setPayment(suggestion.payment);
    if (suggestion.notes) setNotes(suggestion.notes);
    setSuggestion(null);
  }

  function findDuplicate(): MoneyExpense | null {
    const amt = Number(amount);
    const iso = new Date(`${date}T12:00:00Z`).toISOString();
    return (
      (existing.data ?? []).find(
        (x) =>
          x.id !== expense?.id &&
          x.vendor.toLowerCase() === vendor.trim().toLowerCase() &&
          Math.abs(x.amount - amt) < 0.01 &&
          daysApart(x.dateISO, iso) <= 3,
      ) ?? null
    );
  }

  async function save(force = false) {
    const amt = Number(amount);
    if (!vendor.trim()) {
      toast.error("Who was it paid to?");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Add an amount.");
      return;
    }
    if (!force) {
      const d = findDuplicate();
      if (d) {
        setDupe(d);
        return;
      }
    }
    setSaving(true);
    const payload = {
      dateISO: new Date(`${date}T12:00:00Z`).toISOString(),
      vendor: vendor.trim(),
      amount: Math.round(amt * 100) / 100,
      category,
      payment: payment || undefined,
      notes: notes.trim() || undefined,
      clientId: clientId || undefined,
      receiptName,
    };
    try {
      if (expense) {
        await updateMoneyExpense(expense.id, payload);
        toast.success("Expense updated.");
      } else {
        await createMoneyExpense(payload);
        toast.success("Logged — receipts do the rest.");
      }
      await qc.invalidateQueries({ queryKey: ["money"] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-title text-xl">
            {expense ? "Edit expense" : "Log expense"}
          </DialogTitle>
          <DialogDescription>
            Log it and forget it — the year-end pile assembles itself.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {suggestion ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ember/30 bg-ember/10 px-3 py-2 text-sm">
              <Sparkles className="size-4 text-ember" aria-hidden />
              <span className="min-w-0 flex-1">
                Read {suggestion.receiptName ? `“${suggestion.receiptName}”` : "it"} — {suggestion.vendor} ·
                ${suggestion.amount.toFixed(2)}?
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={applySuggestion}
                  className="rounded-md bg-ember px-2.5 py-1 text-[12px] font-medium text-[oklch(0.99_0.005_85)]"
                >
                  Fill the form
                </button>
                <button
                  onClick={() => setSuggestion(null)}
                  className="rounded-md border border-hairline px-2.5 py-1 text-[12px]"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          {analyzing ? (
            <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-ember" aria-hidden />
              Reading the receipt…
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className={labelCls}>Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={field}
              />
            </label>
            <label className="space-y-1.5">
              <span className={labelCls}>Amount</span>
              <input
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                onBlur={() => {
                  const v = Number(amount);
                  if (Number.isFinite(v) && amount) setAmount(v.toFixed(2));
                }}
                className={field}
              />
            </label>
            <label className="space-y-1.5">
              <span className={labelCls}>Vendor</span>
              <input
                list="lumen-vendors"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Adobe, Ilves Studio…"
                className={field}
              />
              <datalist id="lumen-vendors">
                {knownVendors.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </label>
            <label className="space-y-1.5">
              <span className={labelCls}>Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className={field}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className={labelCls}>Payment method</span>
              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
                className={field}
              >
                <option value="">Not recorded</option>
                {PAYMENTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className={labelCls}>Billable to client</span>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={field}
              >
                <option value="">Not billable</option>
                {(clients.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className={labelCls}>Notes</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — what it was for."
              className={cn(field, "resize-none")}
            />
          </label>

          <div className="space-y-1.5">
            <span className={labelCls}>Receipt</span>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void onFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center transition-colors",
                dragOver ? "border-ember/70 bg-ember/10" : "border-hairline bg-surface hover:border-ember/40",
              )}
            >
              {receiptName ? (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <Paperclip className="size-3.5 text-muted-foreground" aria-hidden />
                  {receiptName}
                  <button
                    type="button"
                    aria-label="Remove receipt"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setReceiptName(undefined);
                      setSuggestion(null);
                    }}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ) : null}
              <Upload className={cn("size-5", dragOver ? "text-ember" : "text-muted-foreground")} aria-hidden />
              <span className="text-sm">
                Drop a receipt here, or <span className="text-ember">browse</span> — photo or PDF
              </span>
              <span className="text-[11px] text-muted-foreground">
                Lumen reads it and fills in vendor, amount, date &amp; category.
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {dupe ? (
            <div className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm">
              <p>
                Possible duplicate? {dupe.vendor} · ${dupe.amount.toFixed(2)} on{" "}
                {new Date(dupe.dateISO).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
                .
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => void save(true)}
                  className="rounded-md bg-ember px-2.5 py-1 text-[12px] font-medium text-[oklch(0.99_0.005_85)]"
                >
                  Save anyway
                </button>
                <button
                  onClick={() => setDupe(null)}
                  className="rounded-md border border-hairline px-2.5 py-1 text-[12px]"
                >
                  Let me look
                </button>
              </div>
            </div>
          ) : null}

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
              className="rounded-lg bg-ember px-3.5 py-2 text-sm font-medium text-[oklch(0.99_0.005_85)] disabled:opacity-60"
            >
              {saving ? "Saving…" : expense ? "Save changes" : "Log expense"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

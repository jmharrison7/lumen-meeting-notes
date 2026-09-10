import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Wallet } from "lucide-react";
import { listMoneyExpenses, listMoneyYears } from "@/lib/api";

/** Compact money summary for the Today screen — tap through to the full Money page. */
export function MoneyCard() {
  const years = useQuery({ queryKey: ["money", "years"], queryFn: listMoneyYears });
  const currentYear = new Date().getFullYear();
  const activeYear = (years.data ?? []).includes(currentYear) ? currentYear : ((years.data ?? [])[0] ?? currentYear);
  const expenses = useQuery({
    queryKey: ["money", "expenses", activeYear],
    queryFn: () => listMoneyExpenses(activeYear),
    enabled: activeYear > 0,
  });
  const rows = expenses.data ?? [];
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          <Wallet className="mr-1.5 inline size-3.5 text-ember" />
          Money
        </span>
        <Link to="/money" className="text-xs text-muted-foreground hover:text-ember">
          Open Money
        </Link>
      </div>
      <Link
        to="/money"
        className="group flex items-center justify-between rounded-xl border border-hairline bg-card p-4 transition-colors hover:border-ember/30"
      >
        <div>
          <p className="text-title text-xl font-semibold tabular-nums">
            {total.toLocaleString(undefined, { style: "currency", currency: "USD" })}
          </p>
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {activeYear} expenses · {rows.length} logged
          </p>
        </div>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-ember" />
      </Link>
    </section>
  );
}

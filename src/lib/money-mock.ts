import type { MoneyExpense } from "./types";

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12)).toISOString();

let n = 0;
function e(
  dateISO: string,
  vendor: string,
  category: MoneyExpense["category"],
  amount: number,
  extra: Partial<MoneyExpense> = {},
): MoneyExpense {
  n += 1;
  return {
    id: `mx-${n}`,
    taxYear: new Date(dateISO).getUTCFullYear(),
    dateISO,
    vendor,
    category,
    amount,
    payment: "Card ••4412",
    source: "manual",
    createdAtISO: dateISO,
    ...extra,
  };
}

export const seedExpenses: MoneyExpense[] = [
  // 2026
  e(iso(2026, 8, 22), "Amazon", "Office Supplies", 24.99, { notes: "Cable organizers" }),
  e(iso(2026, 8, 14), "Adobe Creative Cloud", "Software & Subscriptions", 59.99, {
    notes: "Monthly — studio plan",
  }),
  e(iso(2026, 8, 9), "Ilves Studio", "Contractors", 1450, {
    clientId: "c-willow",
    notes: "Packaging illustration pass",
    payment: "Check 1043",
  }),
  e(iso(2026, 8, 3), "Café Mora", "Meals (50%)", 46.2, {
    clientId: "c-harbor",
    receiptName: "cafe-mora-aug3.jpg",
  }),
  e(iso(2026, 7, 28), "Canva Pro", "Software & Subscriptions", 14.99),
  e(iso(2026, 7, 19), "Delta Air Lines", "Travel", 388.4, {
    clientId: "c-northwind",
    notes: "Site visit — Bend, OR",
    receiptName: "delta-jul19.pdf",
  }),
  e(iso(2026, 7, 11), "Apple Store", "Equipment", 1099, { notes: "Studio display" }),
  e(iso(2026, 6, 30), "Figma", "Software & Subscriptions", 45, { notes: "3 seats" }),
  e(iso(2026, 6, 22), "Hartley & Cole CPA", "Professional Services", 650, {
    payment: "Bank transfer",
  }),
  e(iso(2026, 6, 12), "Hiscox", "Insurance", 212.5, { notes: "Quarterly liability" }),
  e(iso(2026, 5, 27), "Meta Ads", "Advertising", 300, { clientId: "c-brightline" }),
  e(iso(2026, 5, 8), "PG&E", "Utilities", 96.13, { notes: "Studio suite" }),
  e(iso(2026, 4, 16), "Adobe Creative Cloud", "Software & Subscriptions", 59.99),
  e(iso(2026, 3, 5), "The Container Store", "Home Office", 178.35, {
    notes: "Shelving for the back room",
  }),
  // 2025
  e(iso(2025, 11, 14), "Adobe Creative Cloud", "Software & Subscriptions", 54.99),
  e(iso(2025, 10, 2), "Sara Lin", "Contractors", 900, { clientId: "c-fern" }),
  e(iso(2025, 9, 21), "Alaska Airlines", "Travel", 264.8, { receiptName: "alaska-sep21.pdf" }),
  e(iso(2025, 6, 6), "Blue Bottle", "Meals (50%)", 38.5, { clientId: "c-atlas" }),
  e(iso(2025, 3, 18), "Dell", "Equipment", 749, { notes: "Backup workstation" }),
];

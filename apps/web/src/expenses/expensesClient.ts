import { toIsoDate } from "./expenseRules";

const base = () => import.meta.env.VITE_API_BASE_URL ?? "";

export type ExpenseOptions = { categories: string[]; currency: string; maxReceiptBytes: number; windowDays: number };

export type DraftValues = {
  amount: string;
  /** DD/MM/YYYY */
  date: string;
  category: string;
  description: string;
};

export type SaveResult = { ok: true } | { ok: false; code: string };

export async function getExpenseOptions(): Promise<ExpenseOptions> {
  const res = await fetch(`${base()}/expenses/options`, { credentials: "include" });
  if (!res.ok) throw new Error("Could not load the expense options.");
  return res.json();
}

export async function createExpenseDraft(v: DraftValues, receipt: File | null): Promise<SaveResult> {
  const form = new FormData();
  form.append("amount", v.amount.replace(/[,\s]/g, ""));
  form.append("date", toIsoDate(v.date));
  form.append("category", v.category);
  form.append("description", v.description);
  if (receipt) form.append("receipt", receipt);
  const res = await fetch(`${base()}/expenses`, { method: "POST", credentials: "include", body: form });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  return { ok: false, code: typeof data.code === "string" ? data.code : "unknown" };
}

const base = () => import.meta.env.VITE_API_BASE_URL ?? "";

export type ExecutiveSummary = {
  headcount: number;
  leaveDaysTaken: number;
  leaveYear: { from: string; to: string };
  hasData: boolean;
};

export type SummaryResult = { kind: "ok"; summary: ExecutiveSummary } | { kind: "forbidden" };

export async function getExecutiveSummary(): Promise<SummaryResult> {
  const res = await fetch(`${base()}/dashboards/executive`, { credentials: "include" });
  if (res.status === 403) return { kind: "forbidden" };
  if (!res.ok) throw new Error("Could not load the executive dashboard.");
  return { kind: "ok", summary: await res.json() };
}

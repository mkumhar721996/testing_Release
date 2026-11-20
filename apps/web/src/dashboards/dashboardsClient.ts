const base = () => import.meta.env.VITE_API_BASE_URL ?? "";

export type HrAdminDashboard = {
  /** ISO date the figures are as of. */
  asOf: string;
  /** ISO date, the inclusive start of the 12-month leavers window. */
  leaversSince: string;
  headcount: number;
  leavers12m: number;
  leaveDays: number;
  headcountByDepartment: { department: string; count: number }[];
  leaveByType: { kind: string; days: number }[];
};

export type DashboardResult =
  | { kind: "ok"; data: HrAdminDashboard }
  | { kind: "forbidden" }
  | { kind: "error" };

export async function getHrAdminDashboard(): Promise<DashboardResult> {
  try {
    const res = await fetch(`${base()}/dashboards/hr-admin`, { credentials: "include" });
    if (res.status === 403) return { kind: "forbidden" };
    if (!res.ok) return { kind: "error" };
    return { kind: "ok", data: await res.json() };
  } catch {
    return { kind: "error" };
  }
}

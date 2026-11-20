const base = () => import.meta.env.VITE_API_BASE_URL ?? "";

export type ManagerDashboard = {
  today: string;
  windowEnd: string;
  viewer: {
    displayName: string;
    jobTitle: string | null;
    absent: boolean;
    absentFrom: string | null;
    absentTo: string | null;
  };
  directReportCount: number;
  offTodayCount: number;
  offDays: {
    date: string;
    people: { employeeId: string; displayName: string; kind: string }[];
  }[];
  pending: {
    id: string;
    employeeId: string;
    employeeName: string;
    kind: string;
    startDate: string;
    endDate: string;
    days: number;
    awaiting: { employeeId: string; displayName: string };
    coveringFor: string | null;
  }[];
};

export async function getManagerDashboard(): Promise<ManagerDashboard> {
  const res = await fetch(`${base()}/dashboards/manager`, { credentials: "include" });
  if (!res.ok) throw new Error("Could not load the manager dashboard.");
  return res.json();
}

const base = () => import.meta.env.VITE_API_BASE_URL ?? "";

export type EmployeeStatus = "active" | "on_leave" | "inactive";
export type StatusFilter = "all" | EmployeeStatus;

export type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: EmployeeStatus;
};

export type EmployeeList = {
  employees: Employee[];
  counts: Record<StatusFilter, number>;
  total: number;
};

export async function listEmployees(
  params: { q: string; status: StatusFilter },
  signal?: AbortSignal,
): Promise<EmployeeList> {
  const query = new URLSearchParams({ q: params.q, status: params.status });
  const res = await fetch(`${base()}/employees?${query}`, { credentials: "include", signal });
  if (!res.ok) throw new Error(`Could not load employees (${res.status})`);
  return res.json();
}

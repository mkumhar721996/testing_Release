const base = () => import.meta.env.VITE_API_BASE_URL ?? "";

export type Employee = {
  id: string;
  displayName: string;
  managerId: string | null;
  jobTitle: string | null;
  department: string | null;
  payAnnualMinor: number | null;
  payCurrency: string | null;
  contactEmail: string | null;
  phone: string | null;
};

export type ManagerOption = { id: string; displayName: string; isExecutive: boolean };
export type EmployeeOptions = { departments: string[]; managers: ManagerOption[] };

export type EmployeeInput = {
  displayName: string;
  jobTitle: string;
  department: string;
  managerId: string;
  /** Annual pay in whole currency units. */
  payAnnual: number;
  contactEmail: string;
  phone: string;
};

export type SaveResult =
  | { ok: true; employee: Employee }
  | { ok: false; code: string; message: string };

const json = { "Content-Type": "application/json" };

export async function searchEmployees(q: string): Promise<Employee[]> {
  const res = await fetch(`${base()}/employees?q=${encodeURIComponent(q)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not search employees.");
  return res.json();
}

export async function getEmployee(id: string): Promise<Employee> {
  const res = await fetch(`${base()}/employees/${encodeURIComponent(id)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not load the employee record.");
  return res.json();
}

export async function getEmployeeOptions(): Promise<EmployeeOptions> {
  const res = await fetch(`${base()}/employees/options`, { credentials: "include" });
  if (!res.ok) throw new Error("Could not load departments and managers.");
  return res.json();
}

async function save(path: string, method: "POST" | "PATCH", body: unknown): Promise<SaveResult> {
  const res = await fetch(`${base()}${path}`, {
    method,
    credentials: "include",
    headers: json,
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true, employee: await res.json() };
  const data = await res.json().catch(() => ({}));
  return {
    ok: false,
    code: typeof data.code === "string" ? data.code : "unknown",
    message: "We could not save this employee record.",
  };
}

export const createEmployee = (input: EmployeeInput) => save("/employees", "POST", input);

export const updateEmployee = (id: string, patch: Partial<EmployeeInput>) =>
  save(`/employees/${encodeURIComponent(id)}`, "PATCH", patch);

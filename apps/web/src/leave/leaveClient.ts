const base = () => import.meta.env.VITE_API_BASE_URL ?? "";

export type LeaveType = { id: string; name: string; exempt: boolean; balanceCount: number };
export type Balance = { leaveTypeId: string; name: string; exempt: boolean; days: number | null };
export type Employee = { id: string; displayName: string };
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "forbidden" | "conflict" | "invalid" | "error"; message: string };

async function call<T>(path: string, method = "GET", body?: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(`${base()}${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) {
      const text = await res.text();
      return { ok: true, value: (text ? JSON.parse(text) : null) as T };
    }
    const data = await res.json().catch(() => ({}));
    const message = data.code ?? data.message ?? "Request failed.";
    if (res.status === 403) return { ok: false, reason: "forbidden", message };
    if (res.status === 409) return { ok: false, reason: "conflict", message };
    if (res.status === 400) return { ok: false, reason: "invalid", message };
    return { ok: false, reason: "error", message };
  } catch {
    return { ok: false, reason: "error", message: "Request failed." };
  }
}

export const listLeaveTypes = () => call<LeaveType[]>("/leave-types");
export const createLeaveType = (input: { name: string; exempt: boolean }) =>
  call<LeaveType>("/leave-types", "POST", input);
export const updateLeaveType = (id: string, input: { name: string; exempt: boolean }) =>
  call<LeaveType>(`/leave-types/${id}`, "PATCH", input);
export const deleteLeaveType = (id: string) => call<null>(`/leave-types/${id}`, "DELETE");
export const listEmployees = () => call<Employee[]>("/employees");
export const listBalances = (employeeId: string) =>
  call<Balance[]>(`/employees/${employeeId}/leave-balances`);
export const setBalance = (employeeId: string, leaveTypeId: string, days: number) =>
  call<{ leaveTypeId: string; days: number }>(
    `/employees/${employeeId}/leave-balances/${leaveTypeId}`,
    "PUT",
    { days },
  );

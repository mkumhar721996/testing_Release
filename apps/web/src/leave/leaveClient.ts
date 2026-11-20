const base = () => import.meta.env.VITE_API_BASE_URL ?? "";

export type LeaveType = { id: string; name: string; exempt: boolean; balanceCount: number };
export type Balance = { leaveTypeId: string; name: string; exempt: boolean; days: number | null };

export type Result<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      reason: "forbidden" | "conflict" | "invalid" | "error";
      /** The API's error code, e.g. `leave_type_name_taken` or `leave_type_in_use`. */
      code: string;
      message: string;
    };

async function call<T>(path: string, method: string, body?: unknown): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(`${base()}${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, reason: "error", code: "network", message: "The request did not complete." };
  }
  if (res.ok) {
    const value = res.status === 204 ? null : await res.json().catch(() => null);
    return { ok: true, value: value as T };
  }
  const data = await res.json().catch(() => ({}));
  const code = typeof data.code === "string" ? data.code : "unknown";
  const reason =
    res.status === 403 ? "forbidden" : res.status === 409 ? "conflict" : res.status === 400 ? "invalid" : "error";
  return { ok: false, reason, code, message: "The change was not saved." };
}

const id = encodeURIComponent;

export const listLeaveTypes = () => call<LeaveType[]>("/leave-types", "GET");
export const createLeaveType = (input: { name: string; exempt: boolean }) =>
  call<LeaveType>("/leave-types", "POST", input);
export const updateLeaveType = (typeId: string, input: { name: string; exempt: boolean }) =>
  call<LeaveType>(`/leave-types/${id(typeId)}`, "PATCH", input);
export const deleteLeaveType = (typeId: string) =>
  call<null>(`/leave-types/${id(typeId)}`, "DELETE");
export const listBalances = (employeeId: string) =>
  call<Balance[]>(`/employees/${id(employeeId)}/leave-balances`, "GET");
export const setBalance = (employeeId: string, leaveTypeId: string, days: number) =>
  call<{ leaveTypeId: string; days: number }>(
    `/employees/${id(employeeId)}/leave-balances/${id(leaveTypeId)}`,
    "PUT",
    { days },
  );

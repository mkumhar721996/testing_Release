import type { Role } from "../auth/authClient";

const base = () => import.meta.env.VITE_API_BASE_URL ?? "";

export type UserStatus = "pending" | "active" | "deactivated";
export type AdminUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: Role;
  status: UserStatus;
};
export type MutationResult = { ok: true; user: AdminUser } | { ok: false; message: string };

const send = (method: string, path: string, body?: unknown) =>
  fetch(`${base()}/admin/users${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function mutate(res: Response, fallback: string): Promise<MutationResult> {
  if (res.ok) return { ok: true, user: await res.json() };
  const data = await res.json().catch(() => ({}));
  return { ok: false, message: data.message ?? fallback };
}

export async function listUsers(): Promise<AdminUser[]> {
  const res = await fetch(`${base()}/admin/users`, { credentials: "include" });
  if (!res.ok) throw new Error("Could not load users.");
  return res.json();
}

export async function inviteUser(input: {
  displayName: string;
  email: string;
  role: Role;
}): Promise<MutationResult> {
  return mutate(await send("POST", "/invite", input), "The invitation could not be sent.");
}

export async function changeRole(id: string, role: Role): Promise<MutationResult> {
  return mutate(await send("PATCH", `/${id}/role`, { role }), "The role could not be saved.");
}

export async function deactivateUser(id: string): Promise<MutationResult> {
  return mutate(await send("POST", `/${id}/deactivate`), "The account could not be deactivated.");
}

export async function reactivateUser(id: string): Promise<MutationResult> {
  return mutate(await send("POST", `/${id}/reactivate`), "The account could not be reactivated.");
}

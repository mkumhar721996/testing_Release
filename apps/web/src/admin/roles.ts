import type { Role } from "../auth/authClient";

export const ROLE_OPTIONS: { id: Role; label: string; note: string }[] = [
  { id: "employee", label: "Employee", note: "Own profile and own leave only." },
  { id: "manager", label: "Manager", note: "Direct reports’ records, plus own self-service." },
  { id: "hr_admin", label: "HR admin", note: "All HR records and user administration." },
  {
    id: "read_only_executive",
    label: "Read-only executive",
    note: "Read-only dashboards, plus own self-service.",
  },
];

export const roleLabel = (role: Role) => ROLE_OPTIONS.find((r) => r.id === role)?.label ?? role;

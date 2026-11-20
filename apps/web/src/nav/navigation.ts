import type { Role } from "../auth/authClient";

export type Section = "profile" | "leave" | "team" | "employees" | "expenses" | "dashboards" | "admin";

const SECTIONS: Record<Role, Section[]> = {
  employee: ["profile", "leave", "expenses"],
  manager: ["profile", "leave", "expenses", "team", "dashboards"],
  hr_admin: ["profile", "leave", "expenses", "employees", "dashboards", "admin"],
  read_only_executive: ["profile", "leave", "dashboards"],
};

/** Convenience layer only: the API enforces access. */
export function navigationFor(role: Role): Section[] {
  return SECTIONS[role];
}

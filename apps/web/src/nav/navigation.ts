import type { Role } from "../auth/authClient";

export type Section = "profile" | "leave" | "team" | "employees" | "dashboards" | "admin";

const SECTIONS: Record<Role, Section[]> = {
  employee: ["profile", "leave"],
  manager: ["profile", "leave", "team", "dashboards"],
  hr_admin: ["profile", "leave", "employees", "dashboards", "admin"],
  read_only_executive: ["profile", "leave", "dashboards"],
};

/** Convenience layer only: the API enforces access. */
export function navigationFor(role: Role): Section[] {
  return SECTIONS[role];
}

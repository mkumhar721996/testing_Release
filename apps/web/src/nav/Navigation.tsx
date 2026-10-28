import type { Role } from "../auth/authClient";
import { navigationFor, type Section } from "./navigation";

const LABELS: Record<Section, string> = {
  profile: "Profile",
  leave: "Leave",
  team: "Team",
  employees: "Employees",
  dashboards: "Dashboards",
  admin: "Admin",
};

export function Navigation({ role }: { role: Role }) {
  return (
    <nav aria-label="Main">
      <ul className="flex gap-4 text-slate-700">
        {navigationFor(role).map((section) => (
          <li key={section}>{LABELS[section]}</li>
        ))}
      </ul>
    </nav>
  );
}

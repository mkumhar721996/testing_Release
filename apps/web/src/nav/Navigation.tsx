import type { Role } from "../auth/authClient";
import { navigationFor, type Section } from "./navigation";

const LABELS: Record<Section, string> = {
  profile: "Profile",
  leave: "Leave",
  expenses: "Expenses",
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
          <li key={section}>
            {section === "employees" || section === "expenses" ? (
              <a href={`/${section}`} className="underline">
                {LABELS[section]}
              </a>
            ) : section === "dashboards" && role === "read_only_executive" ? (
              <a href="/dashboards/executive" className="underline">
                {LABELS[section]}
              </a>
            ) : (
              LABELS[section]
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

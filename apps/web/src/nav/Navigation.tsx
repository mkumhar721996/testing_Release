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

function href(section: Section, role: Role): string | undefined {
  if (section === "employees") return "/employees";
  if (section === "dashboards" && role === "manager") return "/dashboard";
  return undefined;
}

export function Navigation({ role }: { role: Role }) {
  return (
    <nav aria-label="Main">
      <ul className="flex gap-4 text-slate-700">
        {navigationFor(role).map((section) => (
          <li key={section}>
            {href(section, role) ? (
              <a href={href(section, role)} className="underline">
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

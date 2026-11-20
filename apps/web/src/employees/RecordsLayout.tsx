import { useState, type ReactNode } from "react";
import type { Role } from "../auth/authClient";
import { Icon } from "./Icon";

type SectionId = "dashboard" | "records" | "tasks" | "reports" | "audit-log" | "admin";

// Sidebar sections in the order the UI guidelines set. Records is live; Dashboard only for the executive.
const SECTIONS: { id: SectionId; label: string; href?: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "records", label: "Records", href: "/employees" },
  { id: "tasks", label: "Tasks" },
  { id: "reports", label: "Reports" },
  { id: "audit-log", label: "Audit Log" },
  { id: "admin", label: "Admin" },
];

/** Prototype shell for the Records screens: sidebar plus slim top bar. */
export function RecordsLayout({
  children,
  current = "records",
  role,
}: {
  children: ReactNode;
  current?: SectionId;
  role?: Role;
}) {
  const [open, setOpen] = useState(false);
  const sections = SECTIONS.map((section) =>
    section.id === "dashboard" && role === "read_only_executive"
      ? { ...section, href: "/dashboards/executive" }
      : section,
  );
  return (
    <div className="app">
      <aside className="sidebar" id="primary-nav" hidden={!open}>
        <div className="brand">Acme HR</div>
        <nav className="side-nav" aria-label="Main">
          {sections.map((section) =>
            section.href ? (
              <a
                key={section.id}
                className="side-link"
                href={section.href}
                aria-current={section.id === current ? "page" : undefined}
              >
                {section.label}
              </a>
            ) : (
              <button key={section.id} type="button" className="side-link" disabled>
                {section.label}
              </button>
            ),
          )}
        </nav>
      </aside>
      <div className="main">
        <header className="topstrip">
          <button
            type="button"
            className="btn btn-icon btn-ghost menu-btn"
            aria-controls="primary-nav"
            aria-expanded={open}
            aria-label="Toggle navigation"
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name="menu" />
          </button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

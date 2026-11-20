import { useState, type ReactNode } from "react";
import { Icon } from "./Icon";

// Sidebar sections in the order the UI guidelines set. Only Records is live.
const SECTIONS = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "records", label: "Records", href: "/employees" },
  { id: "tasks", label: "Tasks" },
  { id: "reports", label: "Reports" },
  { id: "audit-log", label: "Audit Log" },
  { id: "admin", label: "Admin" },
] as const;

/** Prototype shell for the Records screens: sidebar plus slim top bar. */
export function RecordsLayout({
  children,
  current = "records",
}: {
  children: ReactNode;
  current?: (typeof SECTIONS)[number]["id"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="app">
      <aside className="sidebar" id="primary-nav" hidden={!open}>
        <div className="brand">Acme HR</div>
        <nav className="side-nav" aria-label="Main">
          {SECTIONS.map((section) =>
            "href" in section ? (
              <a key={section.id} className="side-link" href={section.href}
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

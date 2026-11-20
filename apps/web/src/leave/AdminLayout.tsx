import { useState, type ReactNode } from "react";

type SidebarLink = { id: string; label: string; href?: string };

const SECTIONS: SidebarLink[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "records", label: "Records" },
  { id: "tasks", label: "Tasks" },
  { id: "reports", label: "Reports" },
  { id: "audit-log", label: "Audit Log" },
  { id: "admin", label: "Admin", href: "/admin/leave-types" },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-bg text-t-sm text-fg max-md:flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="admin-sidebar"
        onClick={() => setOpen((o) => !o)}
        className="hidden min-h-[calc(var(--space-6)+var(--space-3))] border-b border-border bg-bg-subtle px-t3 text-left max-md:block"
      >
        Menu
      </button>
      <nav
        id="admin-sidebar"
        aria-label="Sections"
        className={`w-56 shrink-0 border-r border-border bg-bg-subtle p-t3 max-md:w-full max-md:border-b max-md:border-r-0 ${
          open ? "" : "max-md:hidden"
        }`}
      >
        <ul className="flex flex-col gap-t1">
          {SECTIONS.map((s) => {
            const current = s.id === "admin";
            return (
              <li key={s.id}>
                <a
                  href={s.href ?? "#"}
                  aria-current={current ? "page" : undefined}
                  className={`block rounded-t-sm px-t3 py-t2 ${
                    current ? "bg-primary-subtle font-medium text-primary-hover" : "text-fg"
                  }`}
                >
                  {s.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      <main className="flex-1 p-t5 max-md:p-t3">{children}</main>
    </div>
  );
}

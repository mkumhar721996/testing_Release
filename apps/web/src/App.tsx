import { useState } from "react";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { ActivatePage } from "./auth/ActivatePage";
import { SignInPage } from "./auth/SignInPage";
import { EmployeeDirectoryPage } from "./employees/EmployeeDirectoryPage";

const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "records", label: "Records" },
  { id: "tasks", label: "Tasks" },
  { id: "reports", label: "Reports" },
  { id: "audit-log", label: "Audit Log" },
  { id: "admin", label: "Admin" },
];

function Shell() {
  const { user, loading, signOut } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  if (loading) return null;
  if (!user) return <SignInPage />;
  return (
    <div className="shell">
      <aside id="primary-nav" className={`shell-sidebar${navOpen ? " is-open" : ""}`}>
        <div className="shell-brand">Comp Console</div>
        <nav className="shell-nav" aria-label="Main">
          {NAV.map((item) => (
            <a
              key={item.id}
              className="shell-nav-link"
              href="#"
              aria-current={item.id === "records" ? "page" : undefined}
              onClick={(e) => e.preventDefault()}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <button
            type="button"
            className="btn btn-icon btn-ghost shell-menu-btn"
            aria-label="Toggle navigation"
            aria-controls="primary-nav"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((open) => !open)}
          >
            ☰
          </button>
          <input
            className="input"
            type="search"
            placeholder="Search records, tasks…"
            aria-label="Search"
            style={{ maxWidth: 420 }}
          />
          <div className="shell-topbar-actions">
            <button type="button" className="btn btn-icon btn-ghost" aria-label="Notifications">
              🔔
            </button>
            <span className="email">{user.email}</span>
            <button type="button" className="btn btn-secondary" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>

        <main className="shell-content">
          <EmployeeDirectoryPage role={user.role} />
        </main>

        <footer className="shell-footer">Comp Console — internal use only.</footer>
      </div>
    </div>
  );
}

function App() {
  if (window.location.pathname === "/activate") {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    return <ActivatePage token={token} />;
  }
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

export default App;

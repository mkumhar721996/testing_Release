import { useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { RecordsLayout } from "./RecordsLayout";
import { navigate } from "./navigate";
import { getEmployeeOptions, searchEmployees, type Employee } from "./employeesClient";

type State =
  | { kind: "idle" }
  | { kind: "loading"; q: string }
  | { kind: "results"; q: string; employees: Employee[]; managers: Map<string, string> }
  | { kind: "error"; q: string };

const SKELETON_WIDTHS = [
  ["30%", "60%"],
  ["25%", "55%"],
  ["35%", "50%"],
];

export function EmployeesPage() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function run(q: string) {
    setState({ kind: "loading", q });
    try {
      const [employees, options] = await Promise.all([
        searchEmployees(q),
        getEmployeeOptions().catch(() => null),
      ]);
      const managers = new Map((options?.managers ?? []).map((m) => [m.id, m.displayName]));
      setState({ kind: "results", q, employees, managers });
    } catch {
      setState({ kind: "error", q });
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void run(query.trim());
  }

  function clear() {
    setQuery("");
    setState({ kind: "idle" });
  }

  return (
    <RecordsLayout>
      <div className="page-head">
        <h1>Employee records</h1>
        <button type="button" className="btn btn-primary" onClick={() => navigate("/employees/new")}>
          <Icon name="plus" />
          Create employee
        </button>
      </div>
      <form className="search-row" role="search" onSubmit={onSubmit}>
        <div className="field">
          <label className="field-label" htmlFor="q">
            Search by name
          </label>
          <input
            className="input"
            id="q"
            type="search"
            placeholder="Search by name"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <button type="submit" className="btn btn-secondary">
            <Icon name="search" />
            Search
          </button>
        </div>
      </form>

      {state.kind === "loading" && (
        <div aria-busy="true">
          <p className="muted result-count">Searching for “{state.q}”…</p>
          <div className="result-list" aria-hidden="true">
            {SKELETON_WIDTHS.map(([title, meta]) => (
              <div className="row-skel" key={title}>
                <div className="skeleton" style={{ height: "var(--space-4)", width: title }} />
                <div className="skeleton" style={{ height: "var(--space-3)", width: meta }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div>
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" />
            <div>Search did not complete, so no results are shown. Check your connection and search again.</div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => void run(state.q)}>
            Try again
          </button>
        </div>
      )}

      {state.kind === "results" && state.employees.length === 0 && (
        <div>
          <p className="muted result-count" role="status">
            No employees match “{state.q}”.
          </p>
          <div className="empty-state card">
            <Icon name="search" />
            <p>No employee records match this name. Check the spelling, or search by first or last name only.</p>
            <button type="button" className="btn btn-secondary" onClick={clear}>
              Clear search
            </button>
          </div>
        </div>
      )}

      {state.kind === "results" && state.employees.length > 0 && (
        <div>
          <p className="muted result-count" role="status">
            {state.employees.length} {state.employees.length === 1 ? "employee matches" : "employees match"} “
            {state.q}”
          </p>
          <ul className="result-list">
            {state.employees.map((e) => (
              <li className="result-row" key={e.id}>
                <div>
                  <div className="result-name">{e.displayName}</div>
                  <div className="meta">
                    {e.jobTitle && <span>{e.jobTitle}</span>}
                    {e.department && <span>{e.department}</span>}
                    {e.managerId && state.managers.has(e.managerId) && (
                      <span>
                        Manager: <b>{state.managers.get(e.managerId)}</b>
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-label={`Open record for ${e.displayName}`}
                  onClick={() => navigate(`/employees/${e.id}`)}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </RecordsLayout>
  );
}

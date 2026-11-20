import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { RecordsLayout } from "./RecordsLayout";
import { getDirectReports, type DirectReport } from "./employeesClient";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; reports: DirectReport[] }
  | { kind: "error" };

const SKELETON_WIDTHS = [
  ["30%", "60%"],
  ["25%", "55%"],
  ["35%", "50%"],
];

export function DirectReportsPage() {
  const [state, setState] = useState<State>({ kind: "idle" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      setState({ kind: "ready", reports: await getDirectReports() });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <RecordsLayout>
      <div className="page-head">
        <h1>My direct reports</h1>
        <p className="muted sub">Employees who report directly to you. View only.</p>
      </div>

      {state.kind === "loading" && (
        <div aria-busy="true">
          <p className="muted result-count">Loading your direct reports…</p>
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
            <div>Your direct reports could not be loaded, so no list is shown. Check your connection and try again.</div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}

      {state.kind === "ready" && state.reports.length === 0 && (
        <div className="empty-state card">
          <Icon name="user" />
          <p role="status">You have no direct reports.</p>
          <p className="muted">Employees who report to you will appear here once HR sets them as your reports.</p>
        </div>
      )}

      {state.kind === "ready" && state.reports.length > 0 && (
        <div>
          <div className="alert alert-info">
            <Icon name="info" />
            <div>
              Shows work details only. People who report to your reports, and employees who have left, are not
              listed.
            </div>
          </div>
          <p className="muted result-count" role="status">
            {state.reports.length} direct {state.reports.length === 1 ? "report" : "reports"}
          </p>
          <ul className="result-list" aria-label="Direct reports">
            {state.reports.map((r) => {
              const role = [r.jobTitle, r.department].filter(Boolean).join(", ");
              return (
                <li className="result-row result-row--report" key={r.id}>
                  <div className="col main">
                    <span className="result-name">{r.displayName}</span>
                    {role && <span className="muted">{role}</span>}
                  </div>
                  <div className="col side">
                    <span>
                      Manager: <b>{r.managerName}</b>
                    </span>
                    {r.contactEmail && (
                      <span className="muted">
                        <a href={`mailto:${r.contactEmail}`}>{r.contactEmail}</a>
                      </span>
                    )}
                    {r.phone && <span className="muted">{r.phone}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </RecordsLayout>
  );
}

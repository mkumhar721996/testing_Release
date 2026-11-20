import { useCallback, useEffect, useState } from "react";
import type { Role } from "../auth/authClient";
import { Icon } from "../employees/Icon";
import { RecordsLayout } from "../employees/RecordsLayout";
import { getExecutiveSummary, type ExecutiveSummary } from "./dashboardsClient";

type State =
  | { kind: "loading" }
  | { kind: "ok"; summary: ExecutiveSummary }
  | { kind: "empty" }
  | { kind: "forbidden" }
  | { kind: "error" };

const number = (n: number) => n.toLocaleString("en-US");

function PageHead() {
  return (
    <div className="page-head">
      <div>
        <h1>Executive dashboard</h1>
        <p className="muted sub">Company-wide headcount and leave. Read-only.</p>
      </div>
      <span className="badge">Read-only</span>
    </div>
  );
}

export function ExecutiveDashboardPage({ role }: { role: Role }) {
  const isExecutive = role === "read_only_executive";
  const [state, setState] = useState<State>(isExecutive ? { kind: "loading" } : { kind: "forbidden" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const result = await getExecutiveSummary();
      if (result.kind === "forbidden") setState({ kind: "forbidden" });
      else if (!result.summary.hasData) setState({ kind: "empty" });
      else setState({ kind: "ok", summary: result.summary });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    if (isExecutive) void load();
  }, [isExecutive, load]);

  return (
    <RecordsLayout current="dashboard" role={role}>
      {state.kind === "loading" && (
        <div className="dashboard-page" aria-busy="true">
          <div className="grid-2 dashboard-grid" aria-hidden="true">
            <div className="card">
              <div className="skeleton" style={{ height: "var(--space-6)" }} />
            </div>
            <div className="card">
              <div className="skeleton" style={{ height: "var(--space-6)" }} />
            </div>
          </div>
          <p role="status" className="viewing">
            Loading company headcount and leave…
          </p>
        </div>
      )}

      {state.kind === "ok" && (
        <div className="dashboard-page">
          <PageHead />
          <div className="grid-2 dashboard-grid">
            <div className="card">
              <div className="stat">
                <span className="stat-label">Total headcount</span>
                <strong>{number(state.summary.headcount)}</strong>
                <span className="stat-note">Employees across all departments</span>
              </div>
            </div>
            <div className="card">
              <div className="stat">
                <span className="stat-label">Total leave taken</span>
                <strong>{`${number(state.summary.leaveDaysTaken)} days`}</strong>
                <span className="stat-note">All leave types, current leave year</span>
              </div>
            </div>
          </div>
          <div className="card">
            <p className="scope-note">
              Figures are company-wide aggregates. Individual employee records are not shown here.
            </p>
          </div>
        </div>
      )}

      {state.kind === "empty" && (
        <div className="dashboard-page">
          <PageHead />
          <div className="empty-state">
            <p>No headcount or leave data is available for the company yet.</p>
          </div>
        </div>
      )}

      {state.kind === "forbidden" && (
        <div className="dashboard-page">
          <div className="empty-state">
            <p>The executive dashboard is not available to your role.</p>
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div className="state-block">
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" />
            <div>Company headcount and leave could not be loaded. Check your connection and try again.</div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}
    </RecordsLayout>
  );
}

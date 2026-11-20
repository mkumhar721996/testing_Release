import { useEffect, useState } from "react";
import type { Role } from "../auth/authClient";
import { Icon } from "../employees/Icon";
import { RecordsLayout } from "../employees/RecordsLayout";
import { getHrAdminDashboard, type HrAdminDashboard } from "./dashboardsClient";

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: HrAdminDashboard }
  | { kind: "forbidden" }
  | { kind: "error" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-11-20" as "20 Nov 2025". */
function formatDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

type Row = { name: string; value: number };

function Breakdown({
  id,
  title,
  rows,
  total,
  format,
}: {
  id: string;
  title: string;
  rows: Row[];
  total: number;
  format: (n: number) => string;
}) {
  return (
    <section className="card breakdown" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {rows.map((row) => (
        <div className="list-item" key={row.name}>
          <div className="row between">
            <span className="row-name">{row.name}</span>
            <span className="row-value">{format(row.value)}</span>
          </div>
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${total === 0 ? 0 : (row.value / total) * 100}%` }} />
          </div>
        </div>
      ))}
      <div className="list-item total row between">
        <span>Total</span>
        <span className="row-value">{format(total)}</span>
      </div>
    </section>
  );
}

function Stat({ value, label, note }: { value: string | number; label: string; note: string }) {
  return (
    <div className="card">
      <div className="stat">
        <strong>{value}</strong>
        <span className="stat-label">{label}</span>
        <span className="stat-note">{note}</span>
      </div>
    </div>
  );
}

export function HrAdminDashboardPage({ role }: { role: Role }) {
  const allowed = role === "hr_admin";
  const [state, setState] = useState<State>(allowed ? { kind: "loading" } : { kind: "forbidden" });

  async function load() {
    setState({ kind: "loading" });
    try {
      setState(await getHrAdminDashboard());
    } catch {
      setState({ kind: "error" });
    }
  }

  useEffect(() => {
    if (allowed) void load();
  }, [allowed]);

  const shown: State = allowed ? state : { kind: "forbidden" };
  const isEmpty =
    shown.kind === "ok" &&
    shown.data.headcount === 0 &&
    shown.data.leavers12m === 0 &&
    shown.data.leaveDays === 0;

  return (
    <RecordsLayout current="dashboard">
      <div className="page-head">
        <div>
          <h1>HR admin dashboard</h1>
          <p className="intro">Company-wide headcount and leave. Figures include every department.</p>
        </div>
      </div>

      {shown.kind === "loading" && (
        <div className="dashboard" aria-busy="true">
          <div className="grid-3">
            {[0, 1, 2].map((i) => (
              <div className="card" key={i}>
                <div className="skeleton skeleton-stat" />
              </div>
            ))}
          </div>
          <div className="grid-2">
            {[0, 1].map((i) => (
              <div className="card" key={i}>
                <div className="skeleton skeleton-breakdown" />
              </div>
            ))}
          </div>
          <p role="status">Loading headcount and leave figures…</p>
        </div>
      )}

      {shown.kind === "forbidden" && (
        <div className="alert alert-warning" role="alert">
          <Icon name="alert" />
          <p>You do not have access to the HR admin dashboard.</p>
        </div>
      )}

      {shown.kind === "error" && (
        <div className="state-block">
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" />
            <p>The dashboard did not load, so no figures are shown. Check your connection and try again.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}

      {isEmpty && (
        <div className="state-block">
          <div className="empty-state">
            <p>No headcount or leave data matches this dashboard yet.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      )}

      {shown.kind === "ok" && !isEmpty && (
        <div className="dashboard">
          <div className="grid-3">
            <Stat
              value={shown.data.headcount}
              label="Current headcount"
              note={`All ${shown.data.headcountByDepartment.length} departments`}
            />
            <Stat
              value={shown.data.leavers12m}
              label="Leavers, last 12 months"
              note={`Termination date on or after ${formatDate(shown.data.leaversSince)}`}
            />
            <Stat
              value={days(shown.data.leaveDays)}
              label="Total leave taken, company-wide"
              note="All leave types"
            />
          </div>
          <div className="grid-2">
            <Breakdown
              id="headcount-by-department"
              title="Headcount by department"
              rows={shown.data.headcountByDepartment.map((d) => ({ name: d.department, value: d.count }))}
              total={shown.data.headcount}
              format={String}
            />
            <Breakdown
              id="leave-by-type"
              title="Leave taken by leave type"
              rows={shown.data.leaveByType.map((t) => ({ name: t.kind, value: t.days }))}
              total={shown.data.leaveDays}
              format={days}
            />
          </div>
        </div>
      )}
    </RecordsLayout>
  );
}

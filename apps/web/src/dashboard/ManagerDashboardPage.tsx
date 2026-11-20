import { useCallback, useEffect, useState } from "react";
import { RecordsLayout } from "../employees/RecordsLayout";
import { getManagerDashboard, type ManagerDashboard } from "./dashboardClient";

const KIND_LABELS: Record<string, string> = { annual: "Annual Leave", sick: "Sick Leave" };
const kindLabel = (kind: string) => KIND_LABELS[kind] ?? kind;

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
const dayLabel = (iso: string) => fmt(iso, { weekday: "short", day: "numeric", month: "short" });
const shortDate = (iso: string) => fmt(iso, { day: "numeric", month: "short" });
const fullDate = (iso: string) => fmt(iso, { day: "numeric", month: "short", year: "numeric" });
const range = (from: string, to: string) =>
  from === to ? fullDate(from) : `${shortDate(from)} – ${fullDate(to)}`;

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: ManagerDashboard };

export function ManagerDashboardPage() {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    getManagerDashboard().then(
      (data) => setState({ status: "ready", data }),
      () => setState({ status: "error" }),
    );
  }, []);
  useEffect(load, [load]);

  return (
    <RecordsLayout active="dashboard">
      <div className="page">
        <div className="page-head">
          <h1>Manager dashboard</h1>
          <p>
            Leave for your direct reports only. Approving and rejecting happens in Leave
            Management.
          </p>
        </div>
        {state.status === "loading" && <Loading />}
        {state.status === "error" && (
          <div className="state-block">
            <div className="alert alert-danger" role="alert">
              <p>Your team's leave could not be loaded. Check your connection and try again.</p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={load}>
              Try again
            </button>
          </div>
        )}
        {state.status === "ready" &&
          (state.data.offDays.length === 0 && state.data.pending.length === 0 ? (
            <div className="state-block">
              <div className="empty-state">
                <p>No direct report has leave recorded.</p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={load}>
                Refresh
              </button>
            </div>
          ) : (
            <Summary data={state.data} />
          ))}
      </div>
    </RecordsLayout>
  );
}

function Loading() {
  return (
    <div className="page" aria-busy="true">
      <div className="grid-3">
        {[0, 1, 2].map((i) => (
          <div className="card" key={i}>
            <div className="skeleton skeleton-stat" />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="skeleton skeleton-table" />
      </div>
      <p role="status" className="viewing">
        Loading your team's leave and pending approvals…
      </p>
    </div>
  );
}

function Summary({ data }: { data: ManagerDashboard }) {
  const { viewer, pending, offDays } = data;
  const covering = pending.filter((p) => p.coveringFor !== null).length;
  const window = `${shortDate(data.today)} – ${fullDate(data.windowEnd)}`;
  return (
    <div className="page">
      {viewer.absent && viewer.absentFrom && viewer.absentTo && (
        <p className="viewing">
          Viewing as {viewer.displayName}
          {viewer.jobTitle ? `, ${viewer.jobTitle}` : ""} (absent {shortDate(viewer.absentFrom)} –{" "}
          {fullDate(viewer.absentTo)})
        </p>
      )}
      <div className="grid-3">
        <div className="card">
          <div className="stat">
            <strong>{data.directReportCount}</strong>
            <span className="stat-label">Direct reports</span>
            <span className="stat-note">Current team only</span>
          </div>
        </div>
        <div className="card">
          <div className="stat">
            <strong>{data.offTodayCount}</strong>
            <span className="stat-label">Off today</span>
            <span className="stat-note">{dayLabel(data.today)}</span>
          </div>
        </div>
        <div className="card">
          <div className="stat">
            <strong>{pending.length}</strong>
            <span className="stat-label">Pending approvals</span>
            {covering > 0 && <span className="stat-note">{covering} covering an absent manager</span>}
          </div>
        </div>
      </div>

      <section className="card" aria-labelledby="off-h">
        <div className="section-head">
          <div>
            <h2 id="off-h">Off in the next 30 days</h2>
            <p>{window}, every day covered by approved leave</p>
          </div>
        </div>
        {offDays.length === 0 ? (
          <div className="empty-state">
            <p>No direct report is off in the next 30 days.</p>
          </div>
        ) : (
          <table className="data-table">
            <caption className="viewing table-caption">Days with nobody off are not listed.</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Direct reports off</th>
              </tr>
            </thead>
            <tbody>
              {offDays.map((day) => (
                <tr key={day.date} className={day.date === data.today ? "today-row" : undefined}>
                  <td data-label="Day">{dayLabel(day.date)}</td>
                  <td data-label="Direct reports off">
                    <div className="people">
                      {day.people.map((p) => (
                        <span className="person" key={p.employeeId}>
                          {p.displayName}
                          <span className="badge badge-success">{kindLabel(p.kind)}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" aria-labelledby="pend-h">
        <div className="section-head">
          <div>
            <h2 id="pend-h">Pending approvals</h2>
            <p>
              {viewer.absent
                ? "Requests awaiting you"
                : "Requests awaiting you, including those from a manager who is absent"}
            </p>
          </div>
        </div>
        {pending.length === 0 ? (
          <div className="empty-state">
            <p>
              {viewer.absent
                ? "No requests are awaiting you. While you are absent, requests addressed to you go to your manager."
                : "No requests are awaiting you."}
            </p>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Leave type</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Days</th>
                  <th scope="col">Awaiting</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Employee">{p.employeeName}</td>
                    <td data-label="Leave type">{kindLabel(p.kind)}</td>
                    <td data-label="Dates">{range(p.startDate, p.endDate)}</td>
                    <td data-label="Days" className="num">
                      {p.days}
                    </td>
                    <td data-label="Awaiting">
                      <span className="badge badge-warning">Pending</span>{" "}
                      {p.coveringFor ? p.awaiting.displayName : "You"}
                      {p.coveringFor && (
                        <span className="cover-note">
                          {p.coveringFor} is absent, so this comes to you as their manager.
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="readonly-note">
              This list is read-only. Approve or reject requests in Leave Management.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

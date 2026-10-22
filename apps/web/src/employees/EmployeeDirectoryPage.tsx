import { useEffect, useRef, useState } from "react";
import type { Role } from "../auth/authClient";
import { EmployeeResults } from "./EmployeeResults";
import { Icon } from "./Icon";
import { StatusTabs } from "./StatusTabs";
import { listEmployees, type EmployeeList, type StatusFilter } from "./employeesClient";

const DEBOUNCE_MS = 150;

type Props = { role: Role; onAddEmployee?: () => void };

export function EmployeeDirectoryPage({ role, onAddEmployee }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [data, setData] = useState<EmployeeList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      listEmployees({ q, status }, controller.signal)
        .then((result) => {
          setData(result);
          setError(false);
          setLoading(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setError(true);
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, status]);

  const clear = () => {
    setQ("");
    setStatus("all");
    searchRef.current?.focus();
  };

  const isHr = role === "hr_admin";

  // Decided from the unfiltered total, so a search can never show the first-run screen.
  if (data && data.total === 0) {
    return (
      <div>
        <h1 className="page-title" style={{ marginBottom: "var(--space-4)" }}>
          Employees
        </h1>
        <div className="results">
          <div className="empty-state no-emp">
            <Icon name="user" />
            <strong>No employees yet</strong>
            <span>
              {isHr
                ? "Add the first employee so the directory and Leave have someone to refer to."
                : "HR admins add employees. They will appear here once added."}
            </span>
            {isHr && (
              <button type="button" className="btn btn-primary btn-tall" onClick={onAddEmployee}>
                <Icon name="plus" />
                Add employee
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const employees = data?.employees ?? null;
  const announcement =
    loading || !employees
      ? ""
      : `${employees.length} ${employees.length === 1 ? "employee" : "employees"} listed`;

  return (
    <div>
      <div className="toolbar">
        <h1 className="page-title">Employees</h1>
        {isHr && (
          <button type="button" className="btn btn-primary" onClick={onAddEmployee}>
            <Icon name="plus" />
            Add employee
          </button>
        )}
      </div>

      <div className="search-wrap">
        <label className="sr-only" htmlFor="dir-search">
          Search employees by name or email
        </label>
        <Icon name="search" />
        <input
          id="dir-search"
          ref={searchRef}
          className="input"
          type="search"
          placeholder="Search by name or email"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <StatusTabs selected={status} counts={data?.counts ?? null} onSelect={setStatus} />

      {error && (
        <div className="alert alert-danger" role="alert" style={{ marginBottom: "var(--space-3)" }}>
          Could not load employees. Refresh the page to try again.
        </div>
      )}

      <EmployeeResults employees={employees} loading={loading} onClear={clear} />
      <p className="result-count" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

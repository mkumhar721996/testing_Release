import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Role } from "../auth/authClient";
import { getEmployeeOptions, type ManagerOption } from "../employees/employeesClient";
import { Icon } from "../employees/Icon";
import { RecordsLayout } from "../employees/RecordsLayout";
import { Modal } from "./Modal";
import { listBalances, setBalance, type Balance } from "./leaveClient";

type Load = { kind: "idle" } | { kind: "loading" } | { kind: "error" } | { kind: "ready"; rows: Balance[] };

const daysText = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

export function LeaveBalancesPage({ role }: { role: Role }) {
  const [people, setPeople] = useState<ManagerOption[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [load, setLoad] = useState<Load>({ kind: "idle" });
  const [editing, setEditing] = useState<Balance | null>(null);
  const [refusal, setRefusal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const employee = people.find((p) => p.id === employeeId);

  useEffect(() => {
    getEmployeeOptions()
      .then((o) => setPeople(o.managers))
      .catch(() => setLoad({ kind: "error" }));
  }, []);

  const refresh = useCallback(async (id: string) => {
    if (!id) return setLoad({ kind: "idle" });
    setLoad({ kind: "loading" });
    const res = await listBalances(id);
    if (res.ok) setLoad({ kind: "ready", rows: res.value });
    else {
      if (res.reason === "forbidden") setRefusal(true);
      setLoad({ kind: "error" });
    }
  }, []);

  const choose = (id: string) => {
    setEmployeeId(id);
    setRefusal(false);
    setToast(null);
    void refresh(id);
  };

  const saved = (row: Balance, days: number) => {
    setLoad((prev) =>
      prev.kind === "ready"
        ? { kind: "ready", rows: prev.rows.map((r) => (r.leaveTypeId === row.leaveTypeId ? { ...r, days } : r)) }
        : prev,
    );
    setToast(`${row.name} balance is now ${daysText(days)}`);
    setEditing(null);
  };

  return (
    <RecordsLayout active="admin">
      <div className="section">
        <div className="page-head">
          <div>
            <h1>Employee leave balances</h1>
            <p className="muted sub">Admin · HR. Set or adjust the days each employee holds for a leave type.</p>
          </div>
          <a className="btn btn-secondary" href="/admin/leave-types">
            Leave types
          </a>
        </div>

        <div className="toolbar">
          <div className="field">
            <label className="field-label" htmlFor="balance-employee">
              Employee
            </label>
            <select
              id="balance-employee"
              className="select"
              value={employeeId}
              onChange={(e) => choose(e.target.value)}
            >
              <option value="">Choose an employee</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {refusal && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" />
            <div>
              <strong>Change refused.</strong> Your role is {role}. Only HR admins can set or adjust leave
              balances. The balance is unchanged.
            </div>
          </div>
        )}

        {load.kind === "loading" && (
          <div role="status" aria-label="Loading balances">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton sk-row" />
            ))}
          </div>
        )}

        {load.kind === "error" && !refusal && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" />
            <div>
              <p>Balances did not load.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void refresh(employeeId)}>
                Try again
              </button>
            </div>
          </div>
        )}

        {load.kind === "ready" && load.rows.length === 0 && (
          <div className="card empty-state">
            <h2>No leave types to set balances for</h2>
            <a className="btn btn-secondary" href="/admin/leave-types">
              Go to leave types
            </a>
          </div>
        )}

        {load.kind === "ready" && load.rows.length > 0 && employee && (
          <div className="card tbl-wrap">
            <table className="tbl">
              <caption>Leave balances for {employee.displayName}</caption>
              <thead>
                <tr>
                  <th scope="col">Leave type</th>
                  <th scope="col">Balance</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {load.rows.map((r) => {
                  const verb = r.days === null ? "Set" : "Adjust";
                  return (
                    <tr key={r.leaveTypeId}>
                      <td data-label="Leave type">
                        {r.name}
                        {r.exempt && (
                          <>
                            {" "}
                            <span className="badge badge-warning">Exempt</span>
                          </>
                        )}
                      </td>
                      <td data-label="Balance">
                        {r.days === null ? (
                          <span className="badge">Not set</span>
                        ) : (
                          <span className="num">{daysText(r.days)}</span>
                        )}
                      </td>
                      <td className="actions" data-label="Action">
                        <button
                          type="button"
                          className={`btn btn-sm ${r.days === null ? "btn-primary" : "btn-secondary"}`}
                          aria-label={`${verb} ${r.name} balance for ${employee.displayName}`}
                          onClick={() => setEditing(r)}
                        >
                          {verb} balance
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && employee && (
        <BalanceModal
          row={editing}
          employeeId={employee.id}
          employeeName={employee.displayName}
          onClose={() => setEditing(null)}
          onRefused={() => {
            setRefusal(true);
            setEditing(null);
          }}
          onSaved={(days) => saved(editing, days)}
        />
      )}

      {toast && (
        <div className="toast is-open" role="status">
          {toast}
        </div>
      )}
    </RecordsLayout>
  );
}

function BalanceModal({
  row,
  employeeId,
  employeeName,
  onClose,
  onRefused,
  onSaved,
}: {
  row: Balance;
  employeeId: string;
  employeeName: string;
  onClose: () => void;
  onRefused: () => void;
  onSaved: (days: number) => void;
}) {
  const [value, setValue] = useState(row.days === null ? "" : String(row.days));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const INVALID = "Enter a whole number of days, 0 or more.";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const days = Number(value);
    if (value.trim() === "" || !Number.isInteger(days) || days < 0) {
      setError(INVALID);
      return;
    }
    setBusy(true);
    const res = await setBalance(employeeId, row.leaveTypeId, days);
    setBusy(false);
    if (res.ok) onSaved(days);
    else if (res.reason === "forbidden") onRefused();
    else setError(res.reason === "invalid" ? INVALID : "The balance was not saved. Try again.");
  }

  return (
    <Modal title={`${row.days === null ? "Set" : "Adjust"} ${row.name} balance`} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="balance-days">
            {row.name} days for {employeeName}
          </label>
          <input
            id="balance-days"
            className={`input${error ? " is-invalid" : ""}`}
            type="number"
            min="0"
            step="1"
            value={value}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setValue(e.target.value)}
          />
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : (
            <p className="field-hint">Whole days, 0 or more.</p>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Save balance
          </button>
        </div>
      </form>
    </Modal>
  );
}

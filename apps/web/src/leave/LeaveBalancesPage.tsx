import { useEffect, useState } from "react";
import { AdminLayout } from "./AdminLayout";
import * as client from "./leaveClient";
import type { Balance, Employee } from "./leaveClient";
import {
  AlertBox,
  Modal,
  NeutralBadge,
  TableSkeleton,
  Toast,
  buttonPrimary,
  buttonSecondary,
  cellClass,
  inputClass,
} from "./ui";

type Load = "loading" | "ready" | "error" | "forbidden";

const FORBIDDEN = "Change refused. Only HR admins can change leave balances. The balance is unchanged.";
const dayText = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

export function LeaveBalancesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [balances, setBalances] = useState<Balance[]>([]);
  const [load, setLoad] = useState<Load>("loading");
  const [editing, setEditing] = useState<Balance | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    setLoad("loading");
    client.listEmployees().then((res) => {
      if (!live) return;
      if (res.ok) {
        setEmployees(res.value);
        setLoad("ready");
      } else {
        setLoad(res.reason === "forbidden" ? "forbidden" : "error");
      }
    });
    return () => {
      live = false;
    };
  }, [retry]);

  const choose = async (id: string) => {
    setEmployeeId(id);
    setBalances([]);
    if (!id) return;
    setLoad("loading");
    const res = await client.listBalances(id);
    if (res.ok) {
      setBalances(res.value);
      setLoad("ready");
    } else {
      setLoad(res.reason === "forbidden" ? "forbidden" : "error");
    }
  };

  const employee = employees.find((e) => e.id === employeeId);

  return (
    <AdminLayout>
      <div className="flex flex-col gap-t4">
        <div className="flex items-center justify-between gap-t3">
          <h1 className="text-t-xl font-semibold">Employee leave balances</h1>
          <a href="/admin/leave-types" className={buttonSecondary}>
            Leave types
          </a>
        </div>

        {load === "forbidden" && <AlertBox>{FORBIDDEN}</AlertBox>}
        {load === "error" && (
          <AlertBox>
            <p>Could not load leave balances.</p>
            <button type="button" className={buttonSecondary} onClick={() => setRetry((n) => n + 1)}>
              Try again
            </button>
          </AlertBox>
        )}

        {load !== "forbidden" && load !== "error" && (
          <div className="flex flex-col gap-t2">
            <label htmlFor="balance-employee" className="font-medium">
              Employee
            </label>
            <select
              id="balance-employee"
              className={inputClass}
              value={employeeId}
              onChange={(e) => void choose(e.target.value)}
            >
              <option value="">Select an employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.displayName}
                </option>
              ))}
            </select>
          </div>
        )}

        {load === "loading" && <TableSkeleton />}
        {load === "ready" && employee && balances.length === 0 && (
          <div className="flex flex-col gap-t2 rounded-t-md border border-border p-t4">
            <p className="font-medium">No leave types to set balances for</p>
            <a href="/admin/leave-types" className="text-primary-hover underline">
              Create a leave type
            </a>
          </div>
        )}
        {load === "ready" && employee && balances.length > 0 && (
          <table className="w-full border-collapse border border-border">
            <thead className="bg-bg-subtle max-md:hidden">
              <tr>
                <th className={cellClass}>Leave type</th>
                <th className={cellClass}>Balance</th>
                <th className={cellClass}>Action</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.leaveTypeId} className="border-t border-border max-md:block max-md:p-t3">
                  <td className={cellClass}>{b.name}</td>
                  <td className={cellClass}>
                    {b.days === null ? <NeutralBadge>Not set</NeutralBadge> : dayText(b.days)}
                  </td>
                  <td className={cellClass}>
                    <button
                      type="button"
                      className={b.days === null ? buttonPrimary : buttonSecondary}
                      aria-label={`${b.days === null ? "Set" : "Adjust"} ${b.name} balance for ${employee.displayName}`}
                      onClick={() => setEditing(b)}
                    >
                      {b.days === null ? "Set balance" : "Adjust balance"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && employee && (
        <BalanceModal
          balance={editing}
          employeeId={employee.id}
          onClose={() => setEditing(null)}
          onRefused={() => {
            setEditing(null);
            setLoad("forbidden");
          }}
          onSaved={(days) => {
            setBalances((prev) =>
              prev.map((b) => (b.leaveTypeId === editing.leaveTypeId ? { ...b, days } : b)),
            );
            setEditing(null);
            setToast(`${editing.name} balance is now ${dayText(days)}`);
          }}
        />
      )}
      <Toast message={toast} />
    </AdminLayout>
  );
}

function BalanceModal({
  balance,
  employeeId,
  onClose,
  onRefused,
  onSaved,
}: {
  balance: Balance;
  employeeId: string;
  onClose: () => void;
  onRefused: () => void;
  onSaved: (days: number) => void;
}) {
  const [text, setText] = useState(balance.days === null ? "" : String(balance.days));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const days = Number(text);
    if (text.trim() === "" || !Number.isInteger(days) || days < 0) {
      setError("Enter a whole number of days, 0 or more.");
      return;
    }
    setBusy(true);
    const res = await client.setBalance(employeeId, balance.leaveTypeId, days);
    setBusy(false);
    if (res.ok) return onSaved(days);
    if (res.reason === "forbidden") return onRefused();
    setError(
      res.reason === "invalid"
        ? "Enter a whole number of days, 0 or more."
        : "Could not save the balance. Try again.",
    );
  };

  return (
    <Modal title={`${balance.days === null ? "Set" : "Adjust"} ${balance.name} balance`} onClose={onClose}>
      <div className="flex flex-col gap-t2">
        <label htmlFor="balance-days" className="font-medium">
          Days
        </label>
        <input
          id="balance-days"
          type="number"
          min={0}
          step={1}
          className={inputClass}
          value={text}
          aria-invalid={error ? true : undefined}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="text-fg-muted">Whole days, 0 or more.</p>
        {error && <AlertBox>{error}</AlertBox>}
      </div>
      <div className="flex justify-end gap-t2">
        <button type="button" className={buttonSecondary} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={buttonPrimary} disabled={busy} onClick={() => void submit()}>
          Save balance
        </button>
      </div>
    </Modal>
  );
}

import { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "./AdminLayout";
import * as client from "./leaveClient";
import type { LeaveType } from "./leaveClient";
import {
  AlertBox,
  Badge,
  Modal,
  TableSkeleton,
  Toast,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  cellClass,
  inputClass,
} from "./ui";

type Load = "loading" | "ready" | "error";
type Dialog =
  | { id: "create" }
  | { id: "edit"; type: LeaveType }
  | { id: "delete"; type: LeaveType }
  | null;

const FORBIDDEN = "Change refused. Only HR admins can change leave types. Nothing was changed.";

export function LeaveTypesPage() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [load, setLoad] = useState<Load>("loading");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [forbidden, setForbidden] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoad("loading");
    const res = await client.listLeaveTypes();
    if (res.ok) {
      setTypes(res.value);
      setLoad("ready");
    } else {
      setLoad("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const done = (message: string) => {
    setDialog(null);
    setToast(message);
  };
  const refused = () => {
    setDialog(null);
    setForbidden(true);
  };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-t4">
        <div className="flex items-center justify-between gap-t3">
          <h1 className="text-t-xl font-semibold">Leave types</h1>
          <div className="flex gap-t2">
            <a href="/admin/leave-balances" className={buttonSecondary}>
              Employee leave balances
            </a>
            <button
              type="button"
              className={buttonPrimary}
              disabled={forbidden}
              onClick={() => setDialog({ id: "create" })}
            >
              New leave type
            </button>
          </div>
        </div>

        {forbidden && <AlertBox>{FORBIDDEN}</AlertBox>}

        {load === "loading" && <TableSkeleton />}
        {load === "error" && (
          <AlertBox>
            <p>Could not load leave types.</p>
            <button type="button" className={buttonSecondary} onClick={() => void refresh()}>
              Try again
            </button>
          </AlertBox>
        )}
        {load === "ready" && types.length === 0 && (
          <div className="flex flex-col gap-t2 rounded-t-md border border-border p-t4">
            <p className="font-medium">No leave types yet</p>
            <p className="text-fg-muted">Create a leave type so employees have something to request against.</p>
          </div>
        )}
        {load === "ready" && types.length > 0 && (
          <table className="w-full border-collapse border border-border">
            <thead className="bg-bg-subtle max-md:hidden">
              <tr>
                <th className={cellClass}>Name</th>
                <th className={cellClass}>Exempt</th>
                <th className={cellClass}>Employees with a balance</th>
                <th className={cellClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id} className="border-t border-border max-md:block max-md:p-t3">
                  <td className={cellClass}>{t.name}</td>
                  <td className={cellClass}>{t.exempt ? <Badge>Exempt</Badge> : "No"}</td>
                  <td className={cellClass}>{t.balanceCount}</td>
                  <td className={`${cellClass} flex gap-t2`}>
                    <button
                      type="button"
                      className={buttonSecondary}
                      disabled={forbidden}
                      aria-label={`Edit ${t.name}`}
                      onClick={() => setDialog({ id: "edit", type: t })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={buttonSecondary}
                      disabled={forbidden}
                      aria-label={`Delete ${t.name}`}
                      onClick={() => setDialog({ id: "delete", type: t })}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dialog && (dialog.id === "create" || dialog.id === "edit") && (
        <TypeModal
          type={dialog.id === "edit" ? dialog.type : null}
          onClose={() => setDialog(null)}
          onRefused={refused}
          onSaved={(saved, created) => {
            setTypes((prev) =>
              created
                ? [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
                : prev.map((t) => (t.id === saved.id ? { ...t, ...saved } : t)),
            );
            done(created ? `${saved.name} created` : `${saved.name} saved`);
          }}
        />
      )}
      {dialog?.id === "delete" && (
        <DeleteModal
          type={dialog.type}
          onClose={() => setDialog(null)}
          onRefused={refused}
          onDeleted={() => {
            setTypes((prev) => prev.filter((t) => t.id !== dialog.type.id));
            done(`${dialog.type.name} deleted`);
          }}
        />
      )}
      <Toast message={toast} />
    </AdminLayout>
  );
}

function TypeModal({
  type,
  onClose,
  onRefused,
  onSaved,
}: {
  type: LeaveType | null;
  onClose: () => void;
  onRefused: () => void;
  onSaved: (saved: LeaveType, created: boolean) => void;
}) {
  const [name, setName] = useState(type?.name ?? "");
  const [exempt, setExempt] = useState(type?.exempt ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for the leave type, for example Annual leave.");
      return;
    }
    setBusy(true);
    const input = { name: trimmed, exempt };
    const res = type
      ? await client.updateLeaveType(type.id, input)
      : await client.createLeaveType(input);
    setBusy(false);
    if (res.ok) return onSaved({ ...res.value, balanceCount: type?.balanceCount ?? 0 }, !type);
    if (res.reason === "forbidden") return onRefused();
    if (res.reason === "conflict") {
      setError(`A leave type named ${trimmed} already exists. Enter a different name.`);
    } else {
      setError("Could not save the leave type. Try again.");
    }
  };

  return (
    <Modal title={type ? `Edit ${type.name}` : "New leave type"} onClose={onClose}>
      <div className="flex flex-col gap-t2">
        <label htmlFor="leave-type-name" className="font-medium">
          Name
        </label>
        <input
          id="leave-type-name"
          className={inputClass}
          value={name}
          aria-invalid={error ? true : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        {error && <AlertBox>{error}</AlertBox>}
      </div>
      <div className="flex items-center gap-t2">
        <button
          type="button"
          role="switch"
          aria-checked={exempt}
          aria-label="Exempt"
          onClick={() => setExempt((v) => !v)}
          className={`rounded-t-md border border-border-strong px-t3 py-t2 ${
            exempt ? "bg-primary text-fg-inverse" : "bg-bg text-fg"
          }`}
        >
          {exempt ? "On" : "Off"}
        </button>
        <span className="text-fg-muted">Exempt leave types are not blocked by a low balance.</span>
      </div>
      <div className="flex justify-end gap-t2">
        <button type="button" className={buttonSecondary} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={buttonPrimary} disabled={busy} onClick={() => void submit()}>
          {type ? "Save changes" : "Create leave type"}
        </button>
      </div>
    </Modal>
  );
}

function DeleteModal({
  type,
  onClose,
  onRefused,
  onDeleted,
}: {
  type: LeaveType;
  onClose: () => void;
  onRefused: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    const res = await client.deleteLeaveType(type.id);
    setBusy(false);
    if (res.ok) return onDeleted();
    if (res.reason === "forbidden") return onRefused();
    if (res.reason === "conflict") {
      const n = type.balanceCount;
      setError(
        n > 0
          ? `Deletion refused. ${type.name} has a balance for ${n} ${n === 1 ? "employee" : "employees"}. Remove those balances first; the leave type stays in the list.`
          : `Deletion refused. ${type.name} is used by leave requests; the leave type stays in the list.`,
      );
    } else {
      setError("Could not delete the leave type. Try again.");
    }
  };

  return (
    <Modal title={`Delete ${type.name}?`} onClose={onClose}>
      <p>This cannot be restored.</p>
      {error && <AlertBox>{error}</AlertBox>}
      <div className="flex justify-end gap-t2">
        <button type="button" className={buttonSecondary} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={buttonDanger} disabled={busy} onClick={() => void confirm()}>
          Delete leave type
        </button>
      </div>
    </Modal>
  );
}

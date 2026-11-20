import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Role } from "../auth/authClient";
import { Icon } from "../employees/Icon";
import { RecordsLayout } from "../employees/RecordsLayout";
import { Modal } from "./Modal";
import {
  createLeaveType,
  deleteLeaveType,
  listLeaveTypes,
  updateLeaveType,
  type LeaveType,
} from "./leaveClient";

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; types: LeaveType[] };
type Dialog =
  | { kind: "type"; editing: LeaveType | null }
  | { kind: "delete"; target: LeaveType; refused: boolean };

const byName = (a: LeaveType, b: LeaveType) => a.name.localeCompare(b.name);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function LeaveTypesPage({ role }: { role: Role }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [refusal, setRefusal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const canChange = role === "hr_admin";

  const refresh = useCallback(async () => {
    setLoad({ kind: "loading" });
    const res = await listLeaveTypes();
    if (res.ok) setLoad({ kind: "ready", types: res.value });
    else setLoad({ kind: "error" });
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const apply = (change: (types: LeaveType[]) => LeaveType[], message: string) => {
    setLoad((prev) => (prev.kind === "ready" ? { kind: "ready", types: change(prev.types).sort(byName) } : prev));
    setToast(message);
    setDialog(null);
  };
  const refuse = () => {
    setRefusal(true);
    setDialog(null);
  };

  const types = load.kind === "ready" ? load.types : [];

  return (
    <RecordsLayout active="admin">
      <div className="section">
        <div className="page-head">
          <div>
            <h1>Leave types</h1>
            <p className="muted sub">
              Admin · HR. Define the leave types employees can hold a balance for.
            </p>
          </div>
          <div className="toolbar">
            <a className="btn btn-secondary" href="/admin/leave-balances">
              Employee balances
            </a>
            {!(load.kind === "ready" && types.length === 0) && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setDialog({ kind: "type", editing: null })}
              >
                New leave type
              </button>
            )}
          </div>
        </div>

        {refusal && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" />
            <div>
              <strong>Change refused.</strong> Your role is {role}. Only HR admins can create, edit or
              delete leave types. Ask an HR admin to make this change.
            </div>
          </div>
        )}

        {load.kind === "loading" && (
          <div role="status" aria-label="Loading leave types">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton sk-row" />
            ))}
          </div>
        )}

        {load.kind === "error" && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" />
            <div>
              <p>Leave types did not load.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void refresh()}>
                Try again
              </button>
            </div>
          </div>
        )}

        {load.kind === "ready" && types.length === 0 && (
          <div className="card empty-state">
            <h2>No leave types yet</h2>
            <p>
              Employees have nothing to request against until you create a leave type, such as Annual
              leave.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setDialog({ kind: "type", editing: null })}
            >
              New leave type
            </button>
          </div>
        )}

        {load.kind === "ready" && types.length > 0 && (
          <div className="card tbl-wrap">
            <table className="tbl">
              <caption>Leave types, with the number of employees who have a balance</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Exempt</th>
                  <th scope="col">Employees with a balance</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr key={t.id}>
                    <td data-label="Name">{t.name}</td>
                    <td data-label="Exempt">
                      {t.exempt ? <span className="badge badge-warning">Exempt</span> : <span className="muted">No</span>}
                    </td>
                    <td data-label="Employees with a balance">{t.balanceCount}</td>
                    <td className="actions" data-label="Actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-label={`Edit ${t.name}`}
                        disabled={!canChange}
                        onClick={() => setDialog({ kind: "type", editing: t })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-label={`Delete ${t.name}`}
                        disabled={!canChange}
                        onClick={() => setDialog({ kind: "delete", target: t, refused: false })}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialog?.kind === "type" && (
        <TypeModal
          editing={dialog.editing}
          onClose={() => setDialog(null)}
          onRefused={refuse}
          onSaved={(saved, created) =>
            apply(
              (all) => (created ? [...all, saved] : all.map((t) => (t.id === saved.id ? saved : t))),
              `${saved.name} ${created ? "created" : "saved"}`,
            )
          }
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteModal
          target={dialog.target}
          refused={dialog.refused}
          onClose={() => setDialog(null)}
          onRefused={refuse}
          onInUse={() => setDialog({ ...dialog, refused: true })}
          onDeleted={() =>
            apply((all) => all.filter((t) => t.id !== dialog.target.id), `${dialog.target.name} deleted`)
          }
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

function TypeModal({
  editing,
  onClose,
  onRefused,
  onSaved,
}: {
  editing: LeaveType | null;
  onClose: () => void;
  onRefused: () => void;
  onSaved: (saved: LeaveType, created: boolean) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [exempt, setExempt] = useState(editing?.exempt ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for the leave type, for example Annual leave.");
      return;
    }
    setBusy(true);
    const input = { name: trimmed, exempt };
    const res = editing ? await updateLeaveType(editing.id, input) : await createLeaveType(input);
    setBusy(false);
    if (res.ok) {
      // The list endpoint supplies the balance count; a fresh type has none.
      onSaved({ ...res.value, balanceCount: editing?.balanceCount ?? 0 }, !editing);
    } else if (res.reason === "forbidden") onRefused();
    else if (res.code === "leave_type_name_taken") {
      setError(`A leave type named ${trimmed} already exists. Enter a different name.`);
    } else if (res.reason === "invalid") {
      setError("Enter a name for the leave type, for example Annual leave.");
    } else setError("The leave type was not saved. Try again.");
  }

  return (
    <Modal title={editing ? "Edit leave type" : "New leave type"} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="leave-type-name">
            Name
          </label>
          <input
            id="leave-type-name"
            className={`input${error ? " is-invalid" : ""}`}
            value={name}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setName(e.target.value)}
          />
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="switch-row">
          <input
            id="leave-type-exempt"
            className="switch"
            type="checkbox"
            role="switch"
            checked={exempt}
            onChange={(e) => setExempt(e.target.checked)}
          />
          <div>
            <label className="field-label" htmlFor="leave-type-exempt">
              Exempt
            </label>
            <p className="field-hint">Exempt types are not blocked by the balance check.</p>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {editing ? "Save changes" : "Create leave type"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteModal({
  target,
  refused,
  onClose,
  onRefused,
  onInUse,
  onDeleted,
}: {
  target: LeaveType;
  refused: boolean;
  onClose: () => void;
  onRefused: () => void;
  onInUse: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const res = await deleteLeaveType(target.id);
    setBusy(false);
    if (res.ok) onDeleted();
    else if (res.reason === "forbidden") onRefused();
    else onInUse();
  }

  return (
    <Modal title={`Delete ${target.name}?`} onClose={onClose}>
      {refused ? (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" />
          <p>
            Deletion refused. {target.name} has a balance for {plural(target.balanceCount, "employee")}. Remove
            those balances first; the leave type stays in the list.
          </p>
        </div>
      ) : (
        <p>It is removed from the leave types list and cannot be restored.</p>
      )}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {refused ? "Close" : "Cancel"}
        </button>
        {!refused && (
          <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void confirm()}>
            Delete leave type
          </button>
        )}
      </div>
    </Modal>
  );
}

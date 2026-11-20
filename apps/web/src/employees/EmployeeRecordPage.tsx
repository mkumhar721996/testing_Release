import { useEffect, useState } from "react";
import type { Role } from "../auth/authClient";
import {
  EmployeeFormFields,
  parsePay,
  toInput,
  valuesFrom,
  type FormValues,
} from "./EmployeeFormFields";
import { Icon } from "./Icon";
import { RecordsLayout } from "./RecordsLayout";
import { navigate } from "./navigate";
import {
  getEmployee,
  getEmployeeOptions,
  updateEmployee,
  type Employee,
  type EmployeeOptions,
} from "./employeesClient";

const NO_OPTIONS: EmployeeOptions = { departments: [], managers: [] };
const dash = (v: string | null) => v || "—";

function formatPay(e: Employee) {
  if (e.payAnnualMinor === null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: e.payCurrency ?? "GBP",
    minimumFractionDigits: e.payAnnualMinor % 100 === 0 ? 0 : 2,
  }).format(e.payAnnualMinor / 100);
}

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; employee: Employee };

export function EmployeeRecordPage({ id, role }: { id: string; role: Role }) {
  const isHr = role === "hr_admin";
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [options, setOptions] = useState<EmployeeOptions>(NO_OPTIONS);
  const [managerName, setManagerName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<FormValues | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "danger"; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const employee = await getEmployee(id);
        if (!live) return;
        setLoad({ kind: "ready", employee });
        const opts = isHr ? await getEmployeeOptions().catch(() => NO_OPTIONS) : NO_OPTIONS;
        if (!live) return;
        setOptions(opts);
        const fromOptions = opts.managers.find((m) => m.id === employee.managerId)?.displayName;
        if (fromOptions) return setManagerName(fromOptions);
        if (employee.managerId) {
          const manager = await getEmployee(employee.managerId).catch(() => null);
          if (live) setManagerName(manager?.displayName ?? null);
        }
      } catch {
        if (live) setLoad({ kind: "error" });
      }
    })();
    return () => {
      live = false;
    };
  }, [id, isHr]);

  const back = (
    <button type="button" className="btn btn-ghost back" onClick={() => navigate("/employees")}>
      <Icon name="back" />
      Employee records
    </button>
  );

  if (load.kind !== "ready") {
    return (
      <RecordsLayout>
        {back}
        {load.kind === "error" ? (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" />
            <div>This employee record could not be loaded. Go back to the records list and try again.</div>
          </div>
        ) : (
          <div aria-busy="true" className="skeleton" style={{ height: "var(--space-6)", width: "30%" }} />
        )}
      </RecordsLayout>
    );
  }

  const employee = load.employee;
  const nameOf = (managerId: string | null) =>
    options.managers.find((m) => m.id === managerId)?.displayName ?? null;
  const executive = options.managers.find((m) => m.id === employee.managerId)?.isExecutive;

  function startEdit() {
    setValues(valuesFrom(employee));
    setNotice(null);
    setEditing(true);
  }

  async function onSave() {
    if (!values) return;
    if (!values.managerId) {
      setNotice({ kind: "danger", text: "Choose one manager before saving." });
      return;
    }
    const result = await updateEmployee(id, toInput(values));
    if (!result.ok) {
      setNotice({
        kind: "danger",
        text:
          result.code === "contact_email_taken"
            ? "Another employee already has this contact email. No changes were saved."
            : "No changes were saved. Check the fields and save again.",
      });
      return;
    }
    const saved = result.employee;
    const newManager = nameOf(saved.managerId);
    setLoad({ kind: "ready", employee: saved });
    setManagerName(newManager);
    setEditing(false);
    setNotice({
      kind: "success",
      text:
        saved.managerId !== employee.managerId && newManager
          ? `Changes saved. ${newManager} is now ${saved.displayName}’s only manager.`
          : "Changes saved.",
    });
  }

  const readOnly = isHr ? null : <span className="badge">Read-only</span>;

  return (
    <RecordsLayout>
      {back}
      {notice && (
        <div
          className={`alert alert-${notice.kind}`}
          role={notice.kind === "success" ? "status" : "alert"}
        >
          <Icon name={notice.kind === "success" ? "check" : "alert"} />
          <div>{notice.text}</div>
        </div>
      )}
      {!isHr && (
        <div className="alert alert-info">
          <Icon name="info" />
          <div>You can view this record. Only HR admins can change job, manager or pay.</div>
        </div>
      )}

      {editing && values ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!Number.isNaN(parsePay(values.payAnnual))) void onSave();
            else setNotice({ kind: "danger", text: "Enter annual pay as a number." });
          }}
        >
          <div className="page-head">
            <h1>Edit {employee.displayName}</h1>
            <div className="cluster">
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save changes
              </button>
            </div>
          </div>
          <EmployeeFormFields
            idPrefix="e"
            values={values}
            options={options}
            managerHint={`One manager only. Saving replaces ${managerName ?? "the current manager"}.`}
            currency={employee.payCurrency ?? undefined}
            onChange={setValues}
          />
        </form>
      ) : (
        <>
          <div className="page-head">
            <div className="title-line">
              <h1>{employee.displayName}</h1>
            </div>
            {isHr && (
              <button type="button" className="btn btn-primary" onClick={startEdit}>
                <Icon name="edit" />
                Edit record
              </button>
            )}
          </div>
          <div className="cards">
            <section className="card">
              <h2 className="card-title">Profile</h2>
              <dl className="facts">
                <dt>Full name</dt>
                <dd>{employee.displayName}</dd>
                <dt>Employee ID</dt>
                <dd className="mono">{employee.id}</dd>
              </dl>
            </section>
            <section className="card">
              <h2 className="card-title">Job {readOnly}</h2>
              <dl className="facts">
                <dt>Job title</dt>
                <dd>{dash(employee.jobTitle)}</dd>
                <dt>Department</dt>
                <dd>{dash(employee.department)}</dd>
                <dt>Manager</dt>
                <dd>
                  {employee.managerId ? (managerName ?? "Assigned") : "—"}
                  {executive && <span className="badge"> Executive</span>}
                </dd>
              </dl>
            </section>
            <section className="card">
              <h2 className="card-title">Pay {readOnly}</h2>
              <dl className="facts">
                <dt>Annual pay</dt>
                <dd>{formatPay(employee)}</dd>
              </dl>
            </section>
            <section className="card">
              <h2 className="card-title">Contact details</h2>
              <dl className="facts">
                <dt>Email</dt>
                <dd>{dash(employee.contactEmail)}</dd>
                <dt>Phone</dt>
                <dd>{dash(employee.phone)}</dd>
              </dl>
            </section>
          </div>
        </>
      )}
    </RecordsLayout>
  );
}

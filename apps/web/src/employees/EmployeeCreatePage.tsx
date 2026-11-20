import { useEffect, useState } from "react";
import {
  EMPTY_VALUES,
  EmployeeFormFields,
  parsePay,
  toInput,
  type FieldErrors,
  type FormValues,
} from "./EmployeeFormFields";
import { Icon } from "./Icon";
import { RecordsLayout } from "./RecordsLayout";
import { navigate } from "./navigate";
import {
  createEmployee,
  getEmployeeOptions,
  searchEmployees,
  type Employee,
  type EmployeeOptions,
} from "./employeesClient";

const MANAGER_REQUIRED = "Manager is required. Choose one manager for this employee.";

type Banner = { kind: "manager" | "email" | "fields" | "failed"; text: string } | null;

export function EmployeeCreatePage() {
  const [options, setOptions] = useState<EmployeeOptions>({ departments: [], managers: [] });
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<Banner>(null);
  const [sameName, setSameName] = useState(false);
  const [saved, setSaved] = useState<Employee | null>(null);

  useEffect(() => {
    getEmployeeOptions()
      .then(setOptions)
      .catch(() => setBanner({ kind: "failed", text: "Departments and managers could not be loaded. Reload the page." }));
  }, []);

  async function checkName() {
    const name = values.displayName.trim().toLowerCase();
    if (!name) return setSameName(false);
    try {
      const matches = await searchEmployees(values.displayName.trim());
      setSameName(matches.some((m) => m.displayName.trim().toLowerCase() === name));
    } catch {
      setSameName(false);
    }
  }

  async function onSave() {
    setBanner(null);
    setErrors({});
    if (!values.managerId) {
      setErrors({ managerId: MANAGER_REQUIRED });
      setBanner({ kind: "manager", text: "No record was created. Choose a manager and save again." });
      return;
    }
    const blank = [values.displayName, values.jobTitle, values.department, values.contactEmail, values.phone].some(
      (v) => !v.trim(),
    );
    if (blank || Number.isNaN(parsePay(values.payAnnual))) {
      setBanner({ kind: "fields", text: "No record was created. Fill in every field, with pay as a number, and save again." });
      return;
    }
    const result = await createEmployee(toInput(values));
    if (result.ok) return setSaved(result.employee);
    if (result.code === "contact_email_taken") {
      setErrors({ contactEmail: "This email belongs to another employee. Enter a different contact email." });
      setBanner({
        kind: "email",
        text: `An employee with contact email ${values.contactEmail.trim().toLowerCase()} already exists. No record was created.`,
      });
    } else if (result.code === "manager_required") {
      setErrors({ managerId: MANAGER_REQUIRED });
      setBanner({ kind: "manager", text: "No record was created. Choose a manager and save again." });
    } else {
      setBanner({ kind: "failed", text: "No record was created. Check the fields and save again." });
    }
  }

  return (
    <RecordsLayout>
      <button type="button" className="btn btn-ghost back" onClick={() => navigate("/employees")}>
        <Icon name="back" />
        Employee records
      </button>
      <div className="page-head">
        <div>
          <h1>Create employee</h1>
          <p className="muted sub">Fill in every field. Each employee has exactly one manager.</p>
        </div>
      </div>

      {saved ? (
        <div>
          <div className="alert alert-success" role="status">
            <Icon name="check" />
            <div>Employee record created for {saved.displayName}.</div>
          </div>
          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/employees")}>
              Back to records
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/employees/${saved.id}`)}>
              Open record
            </button>
          </div>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void onSave();
          }}
        >
          {banner && (
            <div className="alert alert-danger" role="alert">
              <Icon name="alert" />
              <div>{banner.text}</div>
            </div>
          )}
          <EmployeeFormFields
            idPrefix="c"
            values={values}
            options={options}
            errors={errors}
            managerHint="Required. Choose one manager."
            managerLabel={errors.managerId ? "Manager (required)" : "Manager"}
            onChange={setValues}
            onNameBlur={() => void checkName()}
          />
          {sameName && (
            <div className="alert alert-info" style={{ marginTop: "var(--space-4)", marginBottom: 0 }}>
              <Icon name="info" />
              <div>
                Another employee is also named {values.displayName.trim()}. This new record will be created because the
                contact email differs.
              </div>
            </div>
          )}
          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/employees")}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save employee
            </button>
          </div>
        </form>
      )}
    </RecordsLayout>
  );
}

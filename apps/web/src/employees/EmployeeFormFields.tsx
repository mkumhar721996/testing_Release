import type { Employee, EmployeeInput, EmployeeOptions } from "./employeesClient";

export type FormValues = {
  displayName: string;
  jobTitle: string;
  department: string;
  managerId: string;
  payAnnual: string;
  contactEmail: string;
  phone: string;
};

export type FieldErrors = { managerId?: string; contactEmail?: string };

export const EMPTY_VALUES: FormValues = {
  displayName: "",
  jobTitle: "",
  department: "",
  managerId: "",
  payAnnual: "",
  contactEmail: "",
  phone: "",
};

export function valuesFrom(e: Employee): FormValues {
  return {
    displayName: e.displayName,
    jobTitle: e.jobTitle ?? "",
    department: e.department ?? "",
    managerId: e.managerId ?? "",
    payAnnual: e.payAnnualMinor === null ? "" : String(e.payAnnualMinor / 100),
    contactEmail: e.contactEmail ?? "",
    phone: e.phone ?? "",
  };
}

/** Parses "52,000" into 52000; NaN when it is not a number. */
export function parsePay(text: string): number {
  const cleaned = text.replace(/[,\s]/g, "");
  return cleaned === "" ? NaN : Number(cleaned);
}

export function toInput(values: FormValues): EmployeeInput {
  return { ...values, payAnnual: parsePay(values.payAnnual) };
}

type Props = {
  idPrefix: string;
  values: FormValues;
  options: EmployeeOptions;
  errors?: FieldErrors;
  /** Hint under the manager select. */
  managerHint: string;
  managerLabel?: string;
  currency?: string;
  onChange: (values: FormValues) => void;
  onNameBlur?: () => void;
};

export function EmployeeFormFields({
  idPrefix,
  values,
  options,
  errors = {},
  managerHint,
  managerLabel = "Manager",
  currency = "GBP",
  onChange,
  onNameBlur,
}: Props) {
  const set = (key: keyof FormValues) => (e: { target: { value: string } }) =>
    onChange({ ...values, [key]: e.target.value });
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="form-grid">
      <div className="field">
        <label className="field-label" htmlFor={id("name")}>
          Full name
        </label>
        <input
          className="input"
          id={id("name")}
          autoComplete="off"
          value={values.displayName}
          onChange={set("displayName")}
          onBlur={onNameBlur}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor={id("title")}>
          Job title
        </label>
        <input
          className="input"
          id={id("title")}
          placeholder="e.g. Recruiter"
          value={values.jobTitle}
          onChange={set("jobTitle")}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor={id("dept")}>
          Department
        </label>
        <select className="select" id={id("dept")} value={values.department} onChange={set("department")}>
          <option value="">Select department</option>
          {options.departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="field-label" htmlFor={id("mgr")}>
          {managerLabel}
        </label>
        <select
          className={`select${errors.managerId ? " is-invalid" : ""}`}
          id={id("mgr")}
          value={values.managerId}
          aria-invalid={errors.managerId ? true : undefined}
          aria-describedby={errors.managerId ? id("mgr-err") : id("mgr-hint")}
          onChange={set("managerId")}
        >
          <option value="">Select manager</option>
          {options.managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
              {m.isExecutive ? " (Executive)" : ""}
            </option>
          ))}
        </select>
        {errors.managerId ? (
          <span className="field-error" id={id("mgr-err")} role="alert">
            {errors.managerId}
          </span>
        ) : (
          <span className="field-hint" id={id("mgr-hint")}>
            {managerHint}
          </span>
        )}
      </div>
      <div className="field">
        <label className="field-label" htmlFor={id("pay")}>
          Pay (annual, {currency})
        </label>
        <input
          className="input"
          id={id("pay")}
          inputMode="decimal"
          placeholder="e.g. 52,000"
          value={values.payAnnual}
          onChange={set("payAnnual")}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor={id("email")}>
          Contact email
        </label>
        <input
          className={`input${errors.contactEmail ? " is-invalid" : ""}`}
          id={id("email")}
          type="email"
          placeholder="name@acme.example"
          value={values.contactEmail}
          aria-invalid={errors.contactEmail ? true : undefined}
          aria-describedby={errors.contactEmail ? id("email-err") : undefined}
          onChange={set("contactEmail")}
        />
        {errors.contactEmail && (
          <span className="field-error" id={id("email-err")}>
            {errors.contactEmail}
          </span>
        )}
      </div>
      <div className="field">
        <label className="field-label" htmlFor={id("phone")}>
          Phone
        </label>
        <input
          className="input"
          id={id("phone")}
          type="tel"
          placeholder="+44 20 0000 0000"
          value={values.phone}
          onChange={set("phone")}
        />
      </div>
    </div>
  );
}

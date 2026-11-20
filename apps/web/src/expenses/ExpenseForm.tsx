import { useEffect, useRef, useState } from "react";
import { Icon } from "../employees/Icon";
import { validateAmount, validateDate, validateReceipt, windowStart } from "./expenseRules";
import { createExpenseDraft, type DraftValues, type ExpenseOptions } from "./expensesClient";

const NO_FILE = "No file attached. Optional for a draft.";
const TOAST_MS = 4000;

type Errors = { amount?: string; date?: string; receipt?: string };

const emptyValues = (options: ExpenseOptions): DraftValues => ({
  amount: "",
  date: "",
  category: options.categories[0] ?? "",
  description: "",
});

export function ExpenseForm({ options, onSaved }: { options: ExpenseOptions; onSaved: () => void }) {
  const [values, setValues] = useState<DraftValues>(() => emptyValues(options));
  const [errors, setErrors] = useState<Errors>({});
  const [receipt, setReceipt] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number>();
  const today = () => new Date();

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const checks = {
    amount: (v: string) => validateAmount(v) ?? undefined,
    date: (v: string) => validateDate(v, today()) ?? undefined,
  };

  function setField(key: keyof DraftValues, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    if (key === "amount" || key === "date") setErrors((e) => ({ ...e, [key]: checks[key](value) }));
  }

  function validateField(key: "amount" | "date") {
    setErrors((e) => ({ ...e, [key]: checks[key](values[key]) }));
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const message = validateReceipt(file, options.maxReceiptBytes);
    setErrors((e) => ({ ...e, receipt: message ?? undefined }));
    setReceipt(message ? null : file);
  }

  async function onSave() {
    setFailed(false);
    const found = { amount: checks.amount(values.amount), date: checks.date(values.date) };
    setErrors((e) => ({ ...e, ...found }));
    if (found.amount || found.date) return;
    setSaving(true);
    const result = await createExpenseDraft(values, receipt);
    setSaving(false);
    if (!result.ok) return setFailed(true);
    setValues(emptyValues(options));
    setReceipt(null);
    setErrors({});
    setToast(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(false), TOAST_MS);
    onSaved();
  }

  const invalid = (key: keyof Errors) => (errors[key] ? { "aria-invalid": true } : {});

  return (
    <>
      <form
        noValidate
        className="form-col"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave();
        }}
      >
        {failed && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" />
            <div>The draft could not be saved. Check the fields and try again.</div>
          </div>
        )}
        <div className="field">
          <label className="field-label" htmlFor="amount">
            Amount ({options.currency})
          </label>
          <input
            className={`input${errors.amount ? " is-invalid" : ""}`}
            id="amount"
            placeholder="0.00"
            inputMode="decimal"
            autoComplete="off"
            value={values.amount}
            aria-describedby="amount-msg"
            {...invalid("amount")}
            onChange={(e) => setField("amount", e.target.value)}
            onBlur={() => validateField("amount")}
          />
          <div className="field-error" id="amount-msg" role="alert" hidden={!errors.amount}>
            {errors.amount}
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="date">
            Date
          </label>
          <input
            className={`input${errors.date ? " is-invalid" : ""}`}
            id="date"
            placeholder="DD/MM/YYYY"
            autoComplete="off"
            value={values.date}
            aria-describedby="date-hint date-msg"
            {...invalid("date")}
            onChange={(e) => setField("date", e.target.value)}
            onBlur={() => validateField("date")}
          />
          <div className="field-hint" id="date-hint">
            Not in the future, and no more than {options.windowDays} days ago (since {windowStart(today())}).
          </div>
          <div className="field-error" id="date-msg" role="alert" hidden={!errors.date}>
            {errors.date}
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="category">
            Category
          </label>
          <select
            className="select"
            id="category"
            value={values.category}
            onChange={(e) => setField("category", e.target.value)}
          >
            {options.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="description">
            Description
          </label>
          <textarea
            className="textarea"
            id="description"
            rows={3}
            value={values.description}
            onChange={(e) => setField("description", e.target.value)}
          />
        </div>
        <div className={`receipt-box${errors.receipt ? " is-invalid" : ""}`}>
          <strong className="field-label">Receipt</strong>
          <p className="muted" style={{ margin: 0 }}>
            {receipt ? `Attached: ${receipt.name}` : NO_FILE}
          </p>
          <input
            ref={fileInput}
            type="file"
            hidden
            aria-label="Receipt file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()}>
            <Icon name="image" /> Choose file
          </button>
          <div className="field-error" role="alert" hidden={!errors.receipt}>
            {errors.receipt}
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            Save draft
          </button>
        </div>
      </form>
      {toast && (
        <div className="toast is-open" role="status">
          Draft saved
        </div>
      )}
    </>
  );
}

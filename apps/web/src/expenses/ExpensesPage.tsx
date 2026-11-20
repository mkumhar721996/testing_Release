import { useEffect, useState } from "react";
import { Icon } from "../employees/Icon";
import { RecordsLayout } from "../employees/RecordsLayout";
import { ExpenseForm } from "./ExpenseForm";
import { getExpenseOptions, type ExpenseOptions } from "./expensesClient";

export function ExpensesPage() {
  const [options, setOptions] = useState<ExpenseOptions | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setFailed(false);
    getExpenseOptions()
      .then(setOptions)
      .catch(() => setFailed(true));
  }, [attempt]);

  return (
    <RecordsLayout>
      <div className="page-head">
        <h1>My expenses</h1>
      </div>
      <h2>New expense</h2>
      {options ? (
        <ExpenseForm options={options} onSaved={() => undefined} />
      ) : failed ? (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" />
          <div>
            <p>The expense form could not be loaded. Check your connection and try again.</p>
            <button type="button" className="btn btn-secondary" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div className="form-col" aria-busy="true">
          <div className="skeleton skel-row" />
          <div className="skeleton skel-row" />
          <div className="skeleton skel-row" />
          <div className="skeleton skel-row" />
        </div>
      )}
    </RecordsLayout>
  );
}

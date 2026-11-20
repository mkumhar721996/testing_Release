import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../employees/Icon";
import { RecordsLayout } from "../employees/RecordsLayout";
import {
  PATH_STATUSES,
  getDefect,
  moveDefect,
  type Defect,
  type DefectMove,
  type DefectStatus,
} from "./defectsClient";

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; defect: Defect };
type Outcome =
  | { kind: "success"; to: DefectStatus; from: DefectStatus }
  | { kind: "refused"; message: string; status: DefectStatus };

type MoveOption = { id: DefectMove; label: string; action: string };

// Display order of the "Move to" select; the id is what is sent to the API.
const MOVES: MoveOption[] = [
  { id: "triage", label: "Triaged", action: "move a defect to Triaged" },
  { id: "start", label: "In Progress", action: "move a defect to In Progress" },
  { id: "fix", label: "Fixed", action: "mark a defect Fixed" },
  { id: "verify", label: "Verified", action: "move a defect to Verified" },
  { id: "close", label: "Closed", action: "move a defect to Closed" },
  { id: "reject", label: "Rejected (needs reason)", action: "reject a defect" },
  { id: "duplicate", label: "Duplicate (needs original defect)", action: "mark a defect Duplicate" },
  {
    id: "fail_verification",
    label: "Failed verification (back to In Progress)",
    action: "record a failed verification",
  },
  { id: "reopen", label: "Reopen (needs reason)", action: "reopen a defect" },
];

const NEXT_STEP: Partial<Record<DefectStatus, { id: DefectMove; label: string }>> = {
  New: { id: "triage", label: "Move to Triaged" },
  Triaged: { id: "start", label: "Move to In Progress" },
  "In Progress": { id: "fix", label: "Move to Fixed" },
  Fixed: { id: "verify", label: "Move to Verified" },
  Verified: { id: "close", label: "Move to Closed" },
  Closed: { id: "reopen", label: "Reopen defect" },
};

const QA_MOVES: DefectMove[] = ["verify", "close", "fail_verification", "reopen"];
const REASON_MOVES: DefectMove[] = ["reject", "reopen"];
const TOAST_MS = 4000;

const statusClass = (status: DefectStatus) => `s-${status.toLowerCase().replace(/\s/g, "")}`;
const dash = (v: string | null) => v || "—";

function whoCan(move: DefectMove): string {
  if (QA_MOVES.includes(move)) return "QA";
  if (move === "fix") return "a developer";
  return "a triager or a developer";
}

function refusalText(code: string, move: DefectMove, status: DefectStatus): string {
  const option = MOVES.find((m) => m.id === move)!;
  switch (code) {
    case "illegal_transition":
      return `Cannot ${option.action} from ${status}.`;
    case "forbidden":
      return `Only ${whoCan(move)} can ${option.action}.`;
    case "original_required":
      return "Name the original defect to mark this one as Duplicate.";
    case "reason_required":
      return `Give a reason to ${move === "reopen" ? "reopen" : "reject"} this defect.`;
    default:
      return "The move could not be completed. Try again.";
  }
}

export function DefectRecordPage({ defectKey }: { defectKey: string }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [target, setTarget] = useState<DefectMove>("triage");
  const [original, setOriginal] = useState("");
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<"original" | "reason" | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [moving, setMoving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let live = true;
    setLoad({ kind: "loading" });
    getDefect(defectKey).then(
      (defect) => {
        if (!live) return;
        setTarget(defect.allowedMoves[0] ?? "triage");
        setLoad({ kind: "ready", defect });
      },
      () => live && setLoad({ kind: "error" }),
    );
    return () => {
      live = false;
    };
  }, [defectKey, attempt]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (load.kind === "error") {
    return (
      <RecordsLayout>
        <div className="empty-state">
          <Icon name="alert" />
          <h2 className="card-title">Defect could not be loaded</h2>
          <p role="alert">
            The record service did not respond, so the status is not shown. Try again; if it keeps
            failing, check the Audit Log for the last known status.
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      </RecordsLayout>
    );
  }

  if (load.kind === "loading") {
    return (
      <RecordsLayout>
        <div className="record-head" aria-busy="true">
          <div className="skeleton" style={{ height: "var(--space-4)", width: "60%" }} />
          <div className="skeleton" style={{ height: "var(--space-4)", width: "90%" }} />
        </div>
        <div className="body-grid">
          <div className="card" aria-busy="true">
            <div className="skeleton" style={{ height: "var(--space-4)", width: "30%" }} />
            <div className="skeleton" style={{ height: "var(--space-4)" }} />
          </div>
          <div className="card" aria-busy="true">
            <div className="skeleton" style={{ height: "var(--space-6)" }} />
          </div>
        </div>
        <p className="muted">Loading defect…</p>
      </RecordsLayout>
    );
  }

  const { defect } = load;
  const status = defect.status;
  const stepIndex = PATH_STATUSES.indexOf(status as (typeof PATH_STATUSES)[number]);
  const next = NEXT_STEP[status];
  const final = defect.allowedMoves.length === 0;
  const needsOriginal = target === "duplicate";
  const needsReason = REASON_MOVES.includes(target);

  function choose(move: DefectMove) {
    setTarget(move);
    setFieldError(null);
  }

  async function run(move: DefectMove) {
    setOutcome(null);
    setFieldError(null);
    const refuse = (field: "original" | "reason") => {
      setFieldError(field);
      setOutcome({ kind: "refused", message: refusalText(`${field}_required`, move, status), status });
    };
    if (move === "duplicate" && !original.trim()) return refuse("original");
    if (REASON_MOVES.includes(move) && !reason.trim()) return refuse("reason");

    setMoving(true);
    const result = await moveDefect(defect.key, move, {
      ...(move === "duplicate" ? { originalKey: original.trim() } : {}),
      ...(REASON_MOVES.includes(move) ? { reason: reason.trim() } : {}),
    });
    setMoving(false);
    if (!result.ok) {
      if (result.code === "original_required") setFieldError("original");
      if (result.code === "reason_required") setFieldError("reason");
      setOutcome({ kind: "refused", message: refusalText(result.code, move, status), status });
      return;
    }
    setLoad({ kind: "ready", defect: result.defect });
    setTarget(result.defect.allowedMoves[0] ?? "triage");
    setOriginal("");
    setReason("");
    setOutcome({ kind: "success", from: status, to: result.defect.status });
    setToast(`Status is now ${result.defect.status}`);
  }

  function quick(move: DefectMove) {
    choose(move);
    if (move === "reopen" && !reason.trim()) {
      setFieldError("reason");
      reasonRef.current?.focus();
      return;
    }
    void run(move);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(target);
  }

  return (
    <RecordsLayout>
      <header className="record-head">
        <p className="crumbs">
          Records / Defects / <span className="mono">{defect.key}</span>
        </p>
        <div className="head-row">
          <h1 className="record-title">
            <span className="mono">{defect.key}</span> {defect.title}
          </h1>
          <div className="head-status">
            <span className="muted">Status</span>
            <span
              className={`badge s-badge ${statusClass(status)}`}
              role="status"
              aria-live="polite"
              aria-label="Defect status"
            >
              {status}
            </span>
          </div>
        </div>
        <ol className="path" aria-label="Status path">
          {PATH_STATUSES.map((step, index) => (
            <li
              key={step}
              className={stepIndex > index ? "done" : undefined}
              aria-current={step === status ? "step" : undefined}
            >
              {stepIndex > index && <Icon name="check" />}
              {step}
            </li>
          ))}
        </ol>
      </header>

      <div className="body-grid">
        <div className="stack">
          <section className="card" aria-labelledby="h-details">
            <h2 className="card-title" id="h-details">Details</h2>
            <dl className="facts">
              <dt>Severity</dt><dd>{defect.severity}</dd>
              <dt>Component</dt><dd>{defect.component}</dd>
              <dt>Reporter</dt><dd>{defect.reporterName}</dd>
              <dt>Owner</dt><dd>{dash(defect.ownerName)}</dd>
              <dt>Created</dt><dd>{defect.createdAt.slice(0, 10)}</dd>
              <dt>Environment</dt><dd>{defect.environment}</dd>
            </dl>
          </section>
          <section className="card" aria-labelledby="h-desc">
            <h2 className="card-title" id="h-desc">Description</h2>
            <p>{defect.description}</p>
          </section>
          <section className="card" aria-labelledby="h-steps">
            <h2 className="card-title" id="h-steps">Steps to reproduce</h2>
            <ol>
              {defect.stepsToReproduce.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        </div>

        <div className="move-col stack">
          <section className="card" aria-labelledby="h-move">
            <h2 className="card-title" id="h-move">Move defect</h2>
            <p className="muted">
              {final
                ? `${status} is final. No further moves are available.`
                : `From ${status} this defect can move to: ${defect.allowedMoves
                    .map((id) => MOVES.find((m) => m.id === id)!.label.replace(/ \(.*\)$/, ""))
                    .join(", ")}.`}
            </p>
            {next && (
              <div className="btn-row">
                <button type="button" className="btn btn-primary" disabled={moving} onClick={() => quick(next.id)}>
                  {next.label}
                </button>
                {status === "Fixed" && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={moving}
                    onClick={() => quick("fail_verification")}
                  >
                    Record failed verification
                  </button>
                )}
              </div>
            )}

            <form className="stack-sm" onSubmit={submit} noValidate>
              <div className="field">
                <label className="field-label" htmlFor="target">Move to</label>
                <select
                  className="select"
                  id="target"
                  value={target}
                  disabled={final}
                  onChange={(e) => choose(e.target.value as DefectMove)}
                >
                  {MOVES.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <span className="field-hint">
                  Any status can be chosen; moves that skip the path are refused.
                </span>
              </div>
              {needsOriginal && (
                <div className="field">
                  <label className="field-label" htmlFor="original">Original defect</label>
                  <input
                    className={`input${fieldError === "original" ? " is-invalid" : ""}`}
                    id="original"
                    placeholder="e.g. DEF-0988"
                    autoComplete="off"
                    value={original}
                    aria-invalid={fieldError === "original" || undefined}
                    onChange={(e) => setOriginal(e.target.value)}
                  />
                  {fieldError === "original" && (
                    <span className="field-error">Enter the ID of the original defect, such as DEF-0988.</span>
                  )}
                </div>
              )}
              {(needsReason || fieldError === "reason") && (
                <div className="field">
                  <label className="field-label" htmlFor="reason">Reason</label>
                  <textarea
                    className={`textarea${fieldError === "reason" ? " is-invalid" : ""}`}
                    id="reason"
                    rows={3}
                    ref={reasonRef}
                    value={reason}
                    aria-invalid={fieldError === "reason" || undefined}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  {fieldError === "reason" && (
                    <span className="field-error">Enter a reason for this move.</span>
                  )}
                </div>
              )}
              <div className="btn-row">
                <button type="submit" className="btn btn-secondary" disabled={final || moving}>
                  {moving ? "Moving…" : "Move defect"}
                </button>
              </div>
            </form>

            {outcome?.kind === "success" && (
              <div className="alert alert-success" role="status">
                <Icon name="check" />
                <div>
                  <strong>Status is now {outcome.to}.</strong> Moved from {outcome.from}.
                </div>
              </div>
            )}
            {outcome?.kind === "refused" && (
              <div className="alert alert-danger" role="alert">
                <Icon name="alert" />
                <div>
                  <strong>Move refused.</strong> {outcome.message} Status stays {outcome.status}.
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
      {toast && (
        <div className="toast is-open" aria-hidden="true">
          {toast}
        </div>
      )}
    </RecordsLayout>
  );
}

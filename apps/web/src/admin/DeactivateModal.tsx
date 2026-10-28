import { useState } from "react";
import { BTN_GHOST, BTN_PRIMARY, Overlay } from "./Overlay";

export function DeactivateModal({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => Promise<string | void>;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setPending(true);
    setError(null);
    const failure = await onConfirm();
    if (failure) {
      setError(failure);
      setPending(false);
    }
  };

  return (
    <Overlay variant="modal" role="alertdialog" labelledBy="da-h" describedBy="da-text" onClose={onCancel}>
      <h2 id="da-h" className="mb-s3 text-lg font-semibold">
        Deactivate account
      </h2>
      <p id="da-text" className="m-0">
        {name} will be signed out at once and cannot sign in until the account is reactivated.
      </p>
      {error && (
        <div role="alert" className="mt-s3 text-xs text-danger">
          {error}
        </div>
      )}
      <div className="mt-s4 flex justify-end gap-s2">
        <button type="button" className={BTN_GHOST} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={BTN_PRIMARY} disabled={pending} onClick={confirm}>
          {pending ? "Deactivating…" : "Deactivate"}
        </button>
      </div>
    </Overlay>
  );
}

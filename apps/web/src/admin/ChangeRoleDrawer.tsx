import { useState } from "react";
import type { Role } from "../auth/authClient";
import type { AdminUser } from "./adminUsersClient";
import { BTN_GHOST, BTN_PRIMARY, Overlay } from "./Overlay";
import { ROLE_OPTIONS } from "./roles";

export function ChangeRoleDrawer({
  user,
  onSave,
  onCancel,
}: {
  user: AdminUser;
  onSave: (role: Role) => Promise<string | void>;
  onCancel: () => void;
}) {
  const [role, setRole] = useState<Role>(user.role);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setPending(true);
    setError(null);
    const failure = await onSave(role);
    if (failure) {
      setError(failure);
      setPending(false);
    }
  };

  return (
    <Overlay variant="drawer" labelledBy="cr-h" onClose={onCancel}>
      <h2 id="cr-h" className="mb-s3 text-lg font-semibold">
        Change role
      </h2>
      <p className="mb-s3 text-sm text-fg-muted">
        <strong>{user.displayName ?? user.email}</strong> holds one role. Selecting another replaces it.
      </p>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-s2 p-0 text-sm font-medium">Role</legend>
        {ROLE_OPTIONS.map((r) => (
          <label
            key={r.id}
            className={`mt-s2 flex min-h-11 cursor-pointer items-start gap-s3 rounded-md border px-s3 py-s2 first:mt-0 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${
              role === r.id ? "border-primary bg-primary-subtle" : "border-border"
            }`}
          >
            <input
              type="radio"
              name="role"
              value={r.id}
              checked={role === r.id}
              onChange={() => setRole(r.id)}
              className="mt-s1 accent-primary"
            />
            <span>
              <strong className="block text-sm">{r.label}</strong>
              <small className="text-xs text-fg-muted">{r.note}</small>
            </span>
          </label>
        ))}
      </fieldset>
      {error && (
        <div role="alert" className="mt-s3 text-xs text-danger">
          {error}
        </div>
      )}
      <div className="mt-s4 flex justify-end gap-s2">
        <button type="button" className={BTN_GHOST} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={BTN_PRIMARY} disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save role"}
        </button>
      </div>
    </Overlay>
  );
}

import { useState } from "react";
import type { Role } from "../auth/authClient";
import { BTN_GHOST, BTN_PRIMARY, INPUT, Overlay } from "./Overlay";
import { ROLE_OPTIONS } from "./roles";

type Invite = { displayName: string; email: string; role: Role };

export function InviteUserModal({
  onSend,
  onCancel,
}: {
  onSend: (invite: Invite) => Promise<string | void>;
  onCancel: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = displayName.trim() !== "" && email.trim() !== "" && role !== "";

  const send = async () => {
    if (!complete || pending || !role) return;
    setPending(true);
    setError(null);
    const failure = await onSend({ displayName: displayName.trim(), email: email.trim(), role });
    if (failure) {
      setError(failure);
      setPending(false);
    }
  };

  return (
    <Overlay variant="modal" labelledBy="invite-h" onClose={onCancel}>
      <h2 id="invite-h" className="mb-s3 text-lg font-semibold">
        Invite user
      </h2>
      <p className="mb-s3 text-sm text-fg-muted">
        The joiner receives an activation email. Their account stays inactive until they follow it.
      </p>
      <div className="flex flex-col gap-s3">
        <div className="flex flex-col gap-s1">
          <label htmlFor="invite-name" className="text-sm font-medium">
            Full name
          </label>
          <input
            id="invite-name"
            className={INPUT}
            autoComplete="off"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-s1">
          <label htmlFor="invite-email" className="text-sm font-medium">
            Work email
          </label>
          <input
            id="invite-email"
            type="email"
            className={INPUT}
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-s1">
          <label htmlFor="invite-role" className="text-sm font-medium">
            Role
          </label>
          <select
            id="invite-role"
            className={`${INPUT} ${role === "" ? "border-danger" : ""}`}
            aria-describedby="invite-role-hint"
            value={role}
            onChange={(e) => setRole(e.target.value as Role | "")}
          >
            <option value="">Select a role</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          {role === "" && (
            <div id="invite-role-hint" role="alert" className="text-xs text-danger">
              Choose a role to send the invitation.
            </div>
          )}
        </div>
        {error && (
          <div role="alert" className="text-xs text-danger">
            {error}
          </div>
        )}
      </div>
      <div className="mt-s4 flex justify-end gap-s2">
        <button type="button" className={BTN_GHOST} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={BTN_PRIMARY}
          aria-disabled={!complete || pending}
          onClick={send}
        >
          {pending ? "Sending…" : "Send invitation"}
        </button>
      </div>
    </Overlay>
  );
}

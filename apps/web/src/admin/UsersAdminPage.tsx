import { useEffect, useState } from "react";
import type { Role } from "../auth/authClient";
import {
  changeRole,
  deactivateUser,
  inviteUser,
  listUsers,
  reactivateUser,
  type AdminUser,
  type MutationResult,
  type UserStatus,
} from "./adminUsersClient";
import { ChangeRoleDrawer } from "./ChangeRoleDrawer";
import { DeactivateModal } from "./DeactivateModal";
import { InviteUserModal } from "./InviteUserModal";
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, INPUT } from "./Overlay";
import { roleLabel } from "./roles";

type Dialog =
  | { id: "invite" }
  | { id: "role"; user: AdminUser }
  | { id: "deactivate"; user: AdminUser }
  | null;

const STATUS_BADGE: Record<UserStatus, { label: string; tone: string; icon: string }> = {
  active: { label: "Active", tone: "bg-success-subtle text-success", icon: "✓" },
  deactivated: { label: "Deactivated", tone: "bg-danger-subtle text-danger", icon: "✕" },
  pending: { label: "Pending", tone: "bg-warning-subtle text-warning", icon: "" },
};

const nameOf = (u: AdminUser) => u.displayName ?? u.email;
const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

export function UsersAdminPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    listUsers().then(setUsers, () => setLoadError(true));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const replace = (user: AdminUser) =>
    setUsers((all) => (all ?? []).map((u) => (u.id === user.id ? user : u)));

  /** Applies a successful result and closes the dialog; returns the failure message otherwise. */
  const finish = (result: MutationResult, message: (u: AdminUser) => string, add = false) => {
    if (!result.ok) return result.message;
    if (add) setUsers((all) => [...(all ?? []), result.user]);
    else replace(result.user);
    setDialog(null);
    setToast(message(result.user));
  };

  const reactivate = async (user: AdminUser) => {
    setBusyId(user.id);
    const result = await reactivateUser(user.id);
    setBusyId(null);
    const failure = finish(result, (u) => `${nameOf(u)} reactivated. They can sign in again.`);
    if (failure) setToast(failure);
  };

  const q = query.trim().toLowerCase();
  const rows = (users ?? []).filter(
    (u) => !q || nameOf(u).toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
  );

  return (
    <div className="mx-auto max-w-5xl p-s5">
      <div className="flex flex-wrap items-center justify-between gap-s3">
        <h1 className="m-0 text-xl font-semibold">Users</h1>
        <button type="button" className={BTN_PRIMARY} onClick={() => setDialog({ id: "invite" })}>
          + Invite user
        </button>
      </div>

      <div className="mb-s3 mt-s4 flex flex-wrap items-center gap-s3">
        <input
          type="search"
          className={`${INPUT} max-w-sm`}
          placeholder="Search users"
          aria-label="Search users"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="text-sm text-fg-muted" role="status" aria-live="polite">
          {users && `${rows.length} ${rows.length === 1 ? "user" : "users"}`}
        </span>
      </div>

      {loadError && (
        <div role="alert" className="rounded-md bg-danger-subtle px-s4 py-s3 text-sm text-danger">
          Could not load users. Reload the page to try again.
        </div>
      )}

      {!users && !loadError && (
        <div aria-hidden="true" data-testid="users-loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="mb-s2 h-12 animate-pulse rounded-sm bg-bg-inset" />
          ))}
        </div>
      )}

      {users && rows.length > 0 && (
        <ul className="m-0 list-none rounded-md border border-border bg-bg p-0">
          {rows.map((u) => {
            const status = STATUS_BADGE[u.status];
            const name = nameOf(u);
            return (
              <li
                key={u.id}
                className="grid grid-cols-[1fr_auto] items-center gap-s3 border-t border-border px-s3 py-s2 first:border-t-0 md:grid-cols-[minmax(0,1.6fr)_10rem_9rem_auto]"
              >
                <div className="col-span-2 flex min-w-0 items-center gap-s3 md:col-span-1">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary"
                  >
                    {initials(name)}
                  </span>
                  <div className="min-w-0">
                    <strong
                      className={`block break-words text-sm font-medium ${u.status === "deactivated" ? "text-fg-muted" : ""}`}
                    >
                      {name}
                    </strong>
                    <small className="block break-words text-xs text-fg-muted">{u.email}</small>
                  </div>
                </div>
                <span>
                  <span className="inline-flex items-center gap-s1 rounded-sm bg-bg-inset px-s2 py-s1 text-xs font-medium text-fg-muted">
                    {roleLabel(u.role)}
                  </span>
                </span>
                <span>
                  <span
                    className={`inline-flex items-center gap-s1 rounded-sm px-s2 py-s1 text-xs font-medium ${status.tone}`}
                  >
                    {status.icon && <span aria-hidden="true">{status.icon}</span>}
                    {status.label}
                  </span>
                </span>
                <div className="col-span-2 flex gap-s2 md:col-span-1 md:justify-end">
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    aria-label={`Change role for ${name}`}
                    onClick={() => setDialog({ id: "role", user: u })}
                  >
                    Change role
                  </button>
                  {u.status === "active" && (
                    <button
                      type="button"
                      className={BTN_GHOST}
                      aria-label={`Deactivate ${name}`}
                      onClick={() => setDialog({ id: "deactivate", user: u })}
                    >
                      Deactivate
                    </button>
                  )}
                  {u.status === "deactivated" && (
                    <button
                      type="button"
                      className={BTN_GHOST}
                      aria-label={`Reactivate ${name}`}
                      disabled={busyId === u.id}
                      onClick={() => reactivate(u)}
                    >
                      {busyId === u.id ? "Reactivating…" : "Reactivate"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {users && rows.length === 0 && (
        <div className="flex flex-col items-center gap-s2 rounded-md border border-border px-s4 py-s6 text-center text-fg-muted">
          <div>No users match this search.</div>
          <button type="button" className={BTN_SECONDARY} onClick={() => setQuery("")}>
            Clear search
          </button>
        </div>
      )}

      {dialog?.id === "invite" && (
        <InviteUserModal
          onCancel={() => setDialog(null)}
          onSend={async (invite) =>
            finish(
              await inviteUser(invite),
              (u) => `Invitation sent to ${nameOf(u)} as ${roleLabel(u.role)}.`,
              true,
            )
          }
        />
      )}
      {dialog?.id === "role" && (
        <ChangeRoleDrawer
          user={dialog.user}
          onCancel={() => setDialog(null)}
          onSave={async (role: Role) =>
            finish(
              await changeRole(dialog.user.id, role),
              (u) => `${nameOf(u)} is now ${roleLabel(u.role)}.`,
            )
          }
        />
      )}
      {dialog?.id === "deactivate" && (
        <DeactivateModal
          name={nameOf(dialog.user)}
          onCancel={() => setDialog(null)}
          onConfirm={async () =>
            finish(
              await deactivateUser(dialog.user.id),
              (u) => `${nameOf(u)} deactivated. Their session has ended.`,
            )
          }
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-s4 right-s4 z-40 rounded-md bg-fg px-s4 py-s3 text-sm text-fg-inverse shadow-md"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

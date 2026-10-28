import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";

export function AccountMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const onSignOut = async () => {
    setOpen(false);
    try {
      await signOut();
    } catch {
      // the local session is cleared regardless; nothing more to do here
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-radius-md px-space-3 py-space-2 text-token-sm text-fg hover:bg-bg-inset"
      >
        Account
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-space-1 flex flex-col gap-space-1 rounded-radius-lg border border-border bg-bg p-space-2 shadow-token-md"
        >
          <span
            title={user?.email}
            className="max-w-xs truncate px-space-3 py-space-2 text-token-sm text-fg-muted"
          >
            {user?.email}
          </span>
          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            className="rounded-radius-md px-space-3 py-space-2 text-left text-token-sm text-fg hover:bg-bg-inset"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

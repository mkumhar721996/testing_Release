import { useId, type ReactNode } from "react";

export const buttonPrimary =
  "rounded-t-md bg-primary px-t3 py-t2 text-fg-inverse hover:bg-primary-hover disabled:opacity-50";
export const buttonSecondary =
  "rounded-t-md border border-border-strong bg-bg px-t3 py-t2 text-fg disabled:opacity-50";
export const buttonDanger = "rounded-t-md bg-danger px-t3 py-t2 text-fg-inverse disabled:opacity-50";
export const inputClass =
  "w-full rounded-t-md border border-border-strong bg-bg px-t2 py-t2 text-fg";
export const cellClass = "px-t3 py-t2 text-left align-middle max-md:block max-md:px-0";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-t-sm bg-warning-subtle px-t2 py-t1 text-t-xs text-fg">
      {children}
    </span>
  );
}

export function NeutralBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-t-sm bg-bg-inset px-t2 py-t1 text-t-xs text-fg">
      {children}
    </span>
  );
}

export function AlertBox({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex gap-t2 rounded-t-md bg-danger-subtle p-t3 text-fg">
      <span aria-hidden="true" className="text-danger">
        !
      </span>
      <div>{children}</div>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-t5 right-t5 rounded-t-md bg-bg px-t4 py-t3 text-fg shadow-t-md"
    >
      {message}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--color-overlay)] p-t3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex w-full max-w-md flex-col gap-t3 rounded-t-lg bg-bg p-t4 shadow-t-md"
      >
        <h2 id={titleId} className="text-t-lg font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-t2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-t5 rounded-t-sm bg-bg-inset" />
      ))}
    </div>
  );
}

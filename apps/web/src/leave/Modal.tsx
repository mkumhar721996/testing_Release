import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea';

/** Design-system modal that traps focus, closes on Esc and returns focus to the trigger. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onCloseRef.current();
      if (e.key !== "Tab" || !el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div ref={ref} className="modal is-open" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </>
  );
}

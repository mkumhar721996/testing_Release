import { useEffect, useRef, type ReactNode } from "react";

type OverlayProps = {
  variant: "modal" | "drawer";
  role?: "dialog" | "alertdialog";
  labelledBy: string;
  describedBy?: string;
  onClose: () => void;
  children: ReactNode;
};

/** Backdrop plus a modal or right-hand drawer panel; Escape and a backdrop click close it. */
export function Overlay({ variant, role = "dialog", labelledBy, describedBy, onClose, children }: OverlayProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("input,select,button")?.focus();
    return () => trigger?.focus?.();
  }, []);

  const position =
    variant === "drawer"
      ? "justify-end"
      : "items-center justify-center p-s4";
  const shape =
    variant === "drawer"
      ? "h-full w-full max-w-md rounded-l-lg"
      : "w-full max-w-md rounded-lg";

  return (
    <div
      className={`fixed inset-0 z-30 flex bg-overlay ${position}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`overflow-auto bg-bg p-s5 shadow-md ${shape}`}
      >
        {children}
      </div>
    </div>
  );
}

export const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-s2 rounded-md border border-transparent px-s3 py-s2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-50 disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_PRIMARY = `${BUTTON_BASE} bg-primary text-fg-inverse hover:bg-primary-hover`;
export const BTN_SECONDARY = `${BUTTON_BASE} border-border-strong bg-bg text-fg hover:bg-bg-subtle`;
export const BTN_GHOST = `${BUTTON_BASE} bg-transparent text-fg hover:bg-bg-inset`;
export const INPUT =
  "w-full rounded-md border border-border-strong bg-bg px-s3 py-s2 text-sm text-fg focus:border-primary focus:outline-none";

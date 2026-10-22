import { useRef, type KeyboardEvent } from "react";
import type { StatusFilter } from "./employeesClient";

const TABS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "on_leave", label: "On leave" },
  { id: "inactive", label: "Inactive" },
];

type Props = {
  selected: StatusFilter;
  counts: Record<StatusFilter, number> | null;
  onSelect: (status: StatusFilter) => void;
};

export function StatusTabs({ selected, counts, onSelect }: Props) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === selected);
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    onSelect(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label="Employee status" onKeyDown={onKeyDown}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => {
            refs.current[tab.id] = el;
          }}
          type="button"
          className="tab"
          role="tab"
          aria-selected={tab.id === selected}
          tabIndex={tab.id === selected ? 0 : -1}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}{" "}
          <span className="count">{counts ? counts[tab.id] : ""}</span>
        </button>
      ))}
    </div>
  );
}

import { NavLink } from "react-router-dom";

const ITEMS = [
  { id: "people", label: "People", to: "/people" },
  { id: "leave", label: "Leave", to: "/leave" },
];

export function MainNav() {
  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-space-1">
        {ITEMS.map((item) => (
          <li key={item.id}>
            <NavLink
              to={item.to}
              className="block rounded-radius-md px-space-3 py-space-2 text-token-sm font-medium text-fg-muted hover:bg-bg-inset aria-[current=page]:bg-primary-subtle aria-[current=page]:text-primary"
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

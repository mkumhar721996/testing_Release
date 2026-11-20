const PATHS = {
  plus: ["M5 12h14", "M12 5v14"],
  search: ["M21 21l-4.3-4.3", "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z"],
  alert: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 8v4", "M12 16h.01"],
  info: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 16v-4", "M12 8h.01"],
  user: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"],
  check: ["M20 6L9 17l-5-5"],
  edit: ["M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  back: ["M15 18l-6-6 6-6"],
  image: ["M3 3h18v18H3z", "M8.5 8.5h.01", "M21 15l-5-5L5 21"],
} as const;

export type IconName = keyof typeof PATHS;

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" aria-hidden="true" viewBox="0 0 24 24" width="1.25em" height="1.25em" {...STROKE}>
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

import { Icon, type IconName } from "./Icon";
import type { EmployeeStatus } from "./employeesClient";

const BADGES: Record<EmployeeStatus, { label: string; className: string; icon: IconName }> = {
  active: { label: "Active", className: "badge-success", icon: "check" },
  on_leave: { label: "On leave", className: "badge-warning", icon: "calendar" },
  inactive: { label: "Inactive", className: "badge-neutral", icon: "minus" },
};

export function StatusBadge({ status }: { status: EmployeeStatus }) {
  const { label, className, icon } = BADGES[status];
  return (
    <span className={`badge ${className}`}>
      <Icon name={icon} />
      {label}
    </span>
  );
}

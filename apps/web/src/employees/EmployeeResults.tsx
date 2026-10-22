import { Icon } from "./Icon";
import { StatusBadge } from "./StatusBadge";
import type { Employee } from "./employeesClient";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

function SkeletonRows() {
  return (
    <>
      <table className="dir">
        <tbody>
          {[0, 1, 2, 3].map((i) => (
            <tr key={i} className="sk-row">
              <td>
                <div className="skeleton sk" style={{ width: "60%" }} />
              </td>
              <td>
                <div className="skeleton sk" />
              </td>
              <td>
                <div className="skeleton sk" />
              </td>
              <td>
                <div className="skeleton sk" style={{ width: "70%" }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul id="employee-list" aria-label="Loading employees">
        {[0, 1].map((i) => (
          <li key={i} className="emp-card">
            <div className="skeleton sk" style={{ width: "100%" }} />
          </li>
        ))}
      </ul>
    </>
  );
}

type Props = {
  employees: Employee[] | null;
  loading: boolean;
  onClear: () => void;
};

export function EmployeeResults({ employees, loading, onClear }: Props) {
  let body;
  if (loading || !employees) {
    body = <SkeletonRows />;
  } else if (employees.length === 0) {
    body = (
      <div className="empty-state no-match">
        <Icon name="search" />
        <strong>No employees match</strong>
        <span>Check the spelling, search by email, or choose another status tab.</span>
        <button type="button" className="btn btn-secondary btn-tall" onClick={onClear}>
          Clear search and show All
        </button>
      </div>
    );
  } else {
    body = (
      <>
        <table className="dir">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">Department</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td>
                  <div className="person">
                    <span className="avatar" aria-hidden="true">
                      {initials(e.name)}
                    </span>
                    <span className="person-text">
                      <span className="person-name">{e.name}</span>
                      <span className="email">{e.email}</span>
                    </span>
                  </div>
                </td>
                <td>{e.role}</td>
                <td>{e.department}</td>
                <td>
                  <StatusBadge status={e.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul id="employee-list" aria-label="Employees">
          {employees.map((e) => (
            <li key={e.id} className="emp-card">
              <span className="person">
                <span className="avatar" aria-hidden="true">
                  {initials(e.name)}
                </span>
                <span className="person-text">
                  <span className="person-name">{e.name}</span>
                  <span className="meta">
                    {e.role}, {e.department}
                  </span>
                </span>
              </span>
              <StatusBadge status={e.status} />
            </li>
          ))}
        </ul>
      </>
    );
  }
  return (
    <div className="results" aria-busy={loading || !employees}>
      {body}
    </div>
  );
}

import { Role } from '../auth/role';

export type Action =
  | 'record:read'
  | 'record:write'
  | 'leave:read'
  | 'dashboards:read'
  | 'admin:view'
  | 'employees:search'
  | 'employees:create'
  | 'reports:read'
  | 'expenses:write';

export interface Actor {
  id: string;
  role: Role;
  employeeId: string | null;
}

export interface RecordTarget {
  employeeId: string;
  managerEmployeeId: string | null;
}

const canAccessRecord = (actor: Actor, target?: RecordTarget): boolean => {
  if (!target) return false;
  if (actor.role === 'hr_admin') return true;
  if (actor.employeeId === null) return false;
  if (target.employeeId === actor.employeeId) return true;
  return (
    actor.role === 'manager' && target.managerEmployeeId === actor.employeeId
  );
};

export function can(
  actor: Actor,
  action: Action,
  target?: RecordTarget,
): boolean {
  switch (action) {
    case 'record:read':
      return canAccessRecord(actor, target);
    case 'record:write':
      // Until Employee Records defines who may edit, only HR admins can.
      return actor.role === 'hr_admin' && target !== undefined;
    case 'leave:read':
      return true;
    case 'dashboards:read':
      return actor.role !== 'employee';
    case 'reports:read':
      return actor.role === 'manager' && actor.employeeId !== null;
    case 'expenses:write':
      return actor.employeeId !== null && actor.role !== 'read_only_executive';
    case 'employees:search':
    case 'employees:create':
    case 'admin:view':
      return actor.role === 'hr_admin';
  }
}

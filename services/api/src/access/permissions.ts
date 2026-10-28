import { Role } from '../auth/role';

export type Action =
  | 'record:read'
  | 'record:write'
  | 'leave:read'
  | 'dashboards:read'
  | 'admin:view';

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
    case 'admin:view':
      return actor.role === 'hr_admin';
  }
}

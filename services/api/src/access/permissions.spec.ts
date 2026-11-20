import { Role } from '../auth/role';
import { Actor, can, RecordTarget } from './permissions';

const actor = (role: Role, employeeId: string | null = 'e1'): Actor => ({
  id: 'u1',
  role,
  employeeId,
});
const target = (
  employeeId: string,
  managerEmployeeId: string | null = null,
): RecordTarget => ({ employeeId, managerEmployeeId });

describe('can', () => {
  it('lets an employee read their own record (AC1)', () => {
    expect(can(actor('employee'), 'record:read', target('e1', 'e9'))).toBe(
      true,
    );
  });

  it("refuses an employee another employee's record (AC2)", () => {
    expect(can(actor('employee'), 'record:read', target('e2'))).toBe(false);
  });

  it('lets a manager read a direct report (AC3)', () => {
    expect(can(actor('manager', 'm1'), 'record:read', target('e1', 'm1'))).toBe(
      true,
    );
  });

  it('refuses a manager a non-report and an indirect report (AC4)', () => {
    const manager = actor('manager', 'm1');
    expect(can(manager, 'record:read', target('e3', 'someoneElse'))).toBe(
      false,
    );
    // e5 reports to e1, who reports to m1
    expect(can(manager, 'record:read', target('e5', 'e1'))).toBe(false);
  });

  it('lets an HR admin read any record (AC5)', () => {
    expect(can(actor('hr_admin'), 'record:read', target('zz', 'yy'))).toBe(
      true,
    );
  });

  it('refuses the executive any write and other people records (AC6)', () => {
    const exec = actor('read_only_executive');
    expect(can(exec, 'record:write', target('e1'))).toBe(false);
    expect(can(exec, 'record:read', target('e2'))).toBe(false);
  });

  it('limits record writes to HR admins', () => {
    expect(can(actor('hr_admin'), 'record:write', target('e2'))).toBe(true);
    expect(can(actor('employee'), 'record:write', target('e1'))).toBe(false);
    expect(
      can(actor('manager', 'm1'), 'record:write', target('e1', 'm1')),
    ).toBe(false);
    expect(can(actor('manager', 'm1'), 'record:write', target('m1'))).toBe(
      false,
    );
  });

  it('refuses a user with no employee row any record', () => {
    expect(can(actor('manager', null), 'record:read', target('e1'))).toBe(
      false,
    );
  });

  it.each<Role>(['manager', 'hr_admin', 'read_only_executive'])(
    'lets %s read their own record (AC7)',
    (role) => {
      expect(can(actor(role), 'record:read', target('e1'))).toBe(true);
    },
  );

  it.each<Role>(['employee', 'manager', 'hr_admin', 'read_only_executive'])(
    'lets %s read their own leave (AC8)',
    (role) => {
      expect(can(actor(role), 'leave:read', target('e1'))).toBe(true);
    },
  );

  it('allows dashboards for manager, HR admin and executive only (AC12)', () => {
    expect(can(actor('read_only_executive'), 'dashboards:read')).toBe(true);
    expect(can(actor('manager'), 'dashboards:read')).toBe(true);
    expect(can(actor('hr_admin'), 'dashboards:read')).toBe(true);
    expect(can(actor('employee'), 'dashboards:read')).toBe(false);
  });

  it('allows admin:view for HR admin only (AC10, AC11)', () => {
    expect(can(actor('hr_admin'), 'admin:view')).toBe(true);
    for (const role of [
      'employee',
      'manager',
      'read_only_executive',
    ] as Role[]) {
      expect(can(actor(role), 'admin:view')).toBe(false);
    }
  });
});

describe('employee search and create', () => {
  it('allows only HR admins to search and create (AC1, AC3)', () => {
    expect(can(actor('hr_admin'), 'employees:search')).toBe(true);
    expect(can(actor('hr_admin'), 'employees:create')).toBe(true);
    for (const role of [
      'employee',
      'manager',
      'read_only_executive',
    ] as Role[]) {
      expect(can(actor(role), 'employees:search')).toBe(false);
      expect(can(actor(role), 'employees:create')).toBe(false);
    }
  });
});

describe('expenses:write', () => {
  it('lets a linked employee record expenses', () => {
    expect(can(actor('employee'), 'expenses:write')).toBe(true);
  });

  it('refuses the read-only executive and users without an employee', () => {
    expect(can(actor('read_only_executive'), 'expenses:write')).toBe(false);
    expect(can(actor('employee', null), 'expenses:write')).toBe(false);
  });
});

describe('leave:manage', () => {
  it('lets only an HR admin manage leave (AC5)', () => {
    expect(can(actor('hr_admin'), 'leave:manage')).toBe(true);
    for (const role of [
      'employee',
      'manager',
      'read_only_executive',
    ] as Role[]) {
      expect(can(actor(role), 'leave:manage')).toBe(false);
    }
  });
});

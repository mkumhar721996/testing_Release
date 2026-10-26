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
    expect(
      can(actor('manager', 'm1'), 'record:read', target('e1', 'm1')),
    ).toBe(true);
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

  it('limits manager writes to direct reports', () => {
    const manager = actor('manager', 'm1');
    expect(can(manager, 'record:write', target('e1', 'm1'))).toBe(true);
    expect(can(manager, 'record:write', target('e1', 'x'))).toBe(false);
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

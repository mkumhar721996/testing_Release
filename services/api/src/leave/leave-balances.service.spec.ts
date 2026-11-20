import { DataSource, Repository } from 'typeorm';
import { AuditEntry } from '../audit/audit-entry.entity';
import { Employee } from '../employees/employee.entity';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveType } from './leave-type.entity';

describe('LeaveBalancesService', () => {
  const types = [
    { id: 'annual', name: 'Annual leave', exempt: false },
    { id: 'sick', name: 'Sick leave', exempt: false },
    { id: 'toil', name: 'TOIL', exempt: true },
  ];

  const setup = (existing: Partial<LeaveBalance> | null = null) => {
    const em = {
      existsBy: jest.fn().mockResolvedValue(true),
      findOneBy: jest.fn().mockResolvedValue(existing),
      findOneByOrFail: jest.fn().mockResolvedValue({ id: 'b1' }),
      upsert: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const dataSource = {
      transaction: jest.fn(async (fn) => fn(em)),
      getRepository: jest.fn(() => ({
        existsBy: jest.fn().mockResolvedValue(true),
        findBy: jest.fn().mockResolvedValue([
          { employeeId: 'e1', leaveTypeId: 'annual', days: 10 },
          { employeeId: 'e1', leaveTypeId: 'toil', days: 0 },
        ]),
      })),
    };
    const typeRepo = {
      find: jest.fn().mockResolvedValue(types),
    };
    const service = new LeaveBalancesService(
      dataSource as unknown as DataSource,
      typeRepo as unknown as Repository<LeaveType>,
    );
    return { service, em };
  };

  it('upserts only the given pair and audits it (AC2, AC4)', async () => {
    const { service, em } = setup();
    await service.set('e1', 'annual', 10, 'u1');
    expect(em.upsert).toHaveBeenCalledTimes(1);
    expect(em.upsert).toHaveBeenCalledWith(
      LeaveBalance,
      { employeeId: 'e1', leaveTypeId: 'annual', days: 10 },
      ['employeeId', 'leaveTypeId'],
    );
    expect(em.save).toHaveBeenCalledTimes(1);
    expect(em.save).toHaveBeenCalledWith(
      AuditEntry,
      expect.objectContaining({
        entity: 'leave_balance',
        action: 'create',
        changes: {
          employeeId: 'e1',
          leaveTypeId: 'annual',
          days: 10,
          previousDays: null,
        },
      }),
    );
  });

  it('records an adjustment as an update with the previous days (AC3)', async () => {
    const { service, em } = setup({ id: 'b1', days: 10 });
    await service.set('e1', 'annual', 7, 'u1');
    expect(em.save).toHaveBeenCalledWith(
      AuditEntry,
      expect.objectContaining({
        action: 'update',
        changes: expect.objectContaining({ days: 7, previousDays: 10 }),
      }),
    );
  });

  it('accepts 0 as a real balance', async () => {
    const { service, em } = setup();
    await expect(service.set('e1', 'sick', 0, 'u1')).resolves.toEqual({
      leaveTypeId: 'sick',
      days: 0,
    });
    expect(em.upsert).toHaveBeenCalledWith(
      LeaveBalance,
      { employeeId: 'e1', leaveTypeId: 'sick', days: 0 },
      ['employeeId', 'leaveTypeId'],
    );
  });

  it.each([
    ['employee', 'employee_not_found'],
    ['type', 'leave_type_not_found'],
  ])('answers 404 and writes nothing for an unknown %s', async (which, code) => {
    const { service, em } = setup();
    em.existsBy.mockImplementation(async (entity: unknown) =>
      which === 'employee' ? entity !== Employee : entity !== LeaveType,
    );
    await expect(service.set('e1', 'annual', 5, 'u1')).rejects.toMatchObject({
      response: { code },
    });
    expect(em.upsert).not.toHaveBeenCalled();
    expect(em.save).not.toHaveBeenCalled();
  });

  it.each([-1, 2.5, '3', NaN, undefined])('rejects days %p', async (days) => {
    const { service, em } = setup();
    await expect(
      service.set('e1', 'annual', days as number, 'u1'),
    ).rejects.toMatchObject({ response: { code: 'balance_invalid' } });
    expect(em.upsert).not.toHaveBeenCalled();
  });

  it('lists one row per type, null when not set, 0 when stored as 0 (AC11)', async () => {
    const { service } = setup();
    const rows = await service.list('e1');
    expect(rows.map((r) => r.name)).toEqual(['Annual leave', 'Sick leave', 'TOIL']);
    expect(rows.find((r) => r.name === 'Sick leave')!.days).toBeNull();
    expect(rows.find((r) => r.name === 'TOIL')!.days).toBe(0);
    expect(rows.find((r) => r.name === 'Annual leave')!.days).toBe(10);
  });
});

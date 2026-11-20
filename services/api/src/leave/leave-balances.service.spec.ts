import { Repository } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveType } from './leave-type.entity';

describe('LeaveBalancesService', () => {
  const annual = { id: 'annual', name: 'Annual leave', exempt: false };
  const sick = { id: 'sick', name: 'Sick leave', exempt: false };
  const build = (balances: Partial<LeaveBalance>[] = []) => {
    const types = {
      find: jest.fn().mockResolvedValue([annual, sick]),
      existsBy: jest.fn().mockResolvedValue(true),
    };
    const repo = {
      findBy: jest.fn().mockResolvedValue(balances),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    const employees = { existsBy: jest.fn().mockResolvedValue(true) };
    const service = new LeaveBalancesService(
      repo as unknown as Repository<LeaveBalance>,
      types as unknown as Repository<LeaveType>,
      employees as unknown as Repository<Employee>,
    );
    return { service, repo, types, employees };
  };

  it('upserts only the given pair (AC2, AC4)', async () => {
    const { service, repo } = build();
    await expect(service.set('e1', 'annual', 10)).resolves.toEqual({
      leaveTypeId: 'annual',
      days: 10,
    });
    expect(repo.upsert).toHaveBeenCalledTimes(1);
    expect(repo.upsert).toHaveBeenCalledWith(
      { employeeId: 'e1', leaveTypeId: 'annual', days: 10 },
      ['employeeId', 'leaveTypeId'],
    );
  });

  it.each([-1, 2.5, '3', null, NaN])('rejects days %p', async (days) => {
    const { service, repo } = build();
    await expect(
      service.set('e1', 'annual', days as number),
    ).rejects.toMatchObject({ response: { code: 'balance_invalid' } });
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('reports unknown employee or leave type as not found', async () => {
    const a = build();
    a.employees.existsBy.mockResolvedValue(false);
    await expect(a.service.set('x', 'annual', 1)).rejects.toMatchObject({
      status: 404,
    });
    const b = build();
    b.types.existsBy.mockResolvedValue(false);
    await expect(b.service.set('e1', 'x', 1)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('lists null for not set, distinct from a stored 0 (AC11)', async () => {
    const { service } = build([
      { leaveTypeId: 'annual', days: 0 },
    ]);
    const rows = await service.list('e1');
    expect(rows.find((r) => r.name === 'Sick leave')?.days).toBeNull();
    expect(rows.find((r) => r.name === 'Annual leave')?.days).toBe(0);
  });
});

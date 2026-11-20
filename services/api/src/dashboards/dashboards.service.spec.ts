import { Repository } from 'typeorm';
import { Clock } from '../auth/clock';
import { Employee } from '../employees/employee.entity';
import { LeaveEntry } from '../leave/leave-entry.entity';
import { DashboardsService, leaversWindowStart } from './dashboards.service';

describe('leaversWindowStart', () => {
  it('is the same day one year earlier (AC7)', () => {
    expect(leaversWindowStart('2026-11-20')).toBe('2025-11-20');
  });

  it('falls back to 28 Feb when the day does not exist a year earlier', () => {
    expect(leaversWindowStart('2028-02-29')).toBe('2027-02-28');
  });
});

describe('DashboardsService', () => {
  const clock = { now: () => new Date('2026-11-20T09:00:00Z') } as Clock;

  const builder = (raw: unknown[], count = 0) => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(raw),
      getCount: jest.fn().mockResolvedValue(count),
    };
    return qb;
  };

  const setup = (opts: {
    departments?: unknown[];
    leavers?: number;
    leave?: unknown[];
  }) => {
    const headcountQb = builder(opts.departments ?? []);
    const leaversQb = builder([], opts.leavers ?? 0);
    const leaveQb = builder(opts.leave ?? []);
    const employees = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(headcountQb)
        .mockReturnValueOnce(leaversQb),
    };
    const leave = { createQueryBuilder: jest.fn().mockReturnValue(leaveQb) };
    const service = new DashboardsService(
      employees as unknown as Repository<Employee>,
      leave as unknown as Repository<LeaveEntry>,
      clock,
    );
    return { service, headcountQb, leaversQb, leaveQb };
  };

  it('sums headcount across every department (AC1, AC2)', async () => {
    const { service } = setup({
      departments: [
        { department: 'Finance', count: '2' },
        { department: 'Unassigned', count: '1' },
      ],
    });
    const summary = await service.hrAdminSummary();
    expect(summary.headcount).toBe(3);
    expect(summary.headcountByDepartment).toEqual([
      { department: 'Finance', count: 2 },
      { department: 'Unassigned', count: 1 },
    ]);
    expect(summary.asOf).toBe('2026-11-20');
  });

  it('excludes employees terminated on or before today from headcount', async () => {
    const { service, headcountQb } = setup({});
    await service.hrAdminSummary();
    expect(headcountQb.where).toHaveBeenCalledWith(
      expect.stringContaining('"terminationDate" IS NULL'),
      { today: '2026-11-20' },
    );
  });

  it('counts leavers in the last 12 months, start inclusive (AC6, AC7)', async () => {
    const { service, leaversQb } = setup({ leavers: 2 });
    const summary = await service.hrAdminSummary();
    expect(summary.leavers12m).toBe(2);
    expect(summary.leaversSince).toBe('2025-11-20');
    expect(leaversQb.where).toHaveBeenCalledWith(
      expect.stringContaining('>= :since'),
      { since: '2025-11-20', today: '2026-11-20' },
    );
  });

  it('sums leave company-wide by kind (AC3, AC8)', async () => {
    const { service, leaveQb } = setup({
      leave: [
        { kind: 'annual', days: '5' },
        { kind: 'sick', days: '2' },
      ],
    });
    const summary = await service.hrAdminSummary();
    expect(summary.leaveDays).toBe(7);
    expect(summary.leaveByType).toEqual([
      { kind: 'annual', days: 5 },
      { kind: 'sick', days: 2 },
    ]);
    expect(leaveQb.where).toHaveBeenCalledWith('l."startDate" <= :today', {
      today: '2026-11-20',
    });
  });

  it('returns zeros and empty lists with no data (AC9)', async () => {
    const { service } = setup({});
    expect(await service.hrAdminSummary()).toMatchObject({
      headcount: 0,
      leavers12m: 0,
      leaveDays: 0,
      headcountByDepartment: [],
      leaveByType: [],
    });
  });

  it('never selects or returns pay (AC5)', async () => {
    const { service, headcountQb, leaversQb, leaveQb } = setup({});
    const summary = await service.hrAdminSummary();
    expect(JSON.stringify(summary)).not.toMatch(/pay|salary/i);
    for (const qb of [headcountQb, leaversQb, leaveQb]) {
      const sql = JSON.stringify([
        ...qb.select.mock.calls,
        ...qb.addSelect.mock.calls,
      ]);
      expect(sql).not.toMatch(/pay/i);
    }
  });
});
